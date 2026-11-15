import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  maxUint256,
  numberToHex,
  parseEventLogs,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { blockCasinoAbi, chipTokenAbi, randomnessSourceAbi } from '../../exports/abis'
import { CHAINS } from './chains'
import type { DiscoveredWallet, WalletInfo } from './discovery'
import { WalletError, toWalletError } from './errors'

// ------------------------------------------------------------------ types

/** The parts of backend/exports/<network>/deployment.json the SDK needs. */
export interface CasinoDeployment {
  chainId: number
  rpc?: string
  contracts: { blockCasino: Address; chipToken: Address }
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'wrong-network'

export interface WalletState {
  status: ConnectionStatus
  /** The wallet in use, from discovery. */
  wallet: WalletInfo | null
  address: Address | null
  /** The chain the wallet is on right now. */
  chainId: number | null
  /** The chain the casino is deployed on. */
  targetChainId: number
}

export interface Balances {
  /** Native MON, for gas and the VRF fee. 18 decimals. */
  mon: bigint
  /** Play chips. 18 decimals. */
  chips: bigint
  /** How many chips the casino may move for this player (approve). */
  allowance: bigint
}

export interface RoundConfig {
  genesisBlock: bigint
  roundLength: bigint
  bettingWindow: bigint
  settleTimeout: bigint
  minBet: bigint
  maxBet: bigint
}

export type RoundStatus = 'none' | 'requested' | 'settled' | 'expired'

export interface RoundInfo {
  status: RoundStatus
  /** The VRF seed once settled, else 0x00..00. */
  seed: `0x${string}`
  totalStaked: bigint
}

export interface Bet {
  roundId: bigint
  betIndex: bigint
  player: Address
  gameId: number
  choice: number
  amount: bigint
  /** Claimed or refunded. */
  closed: boolean
}

export interface TxResult {
  hash: Hash
}

export interface PlacedBet extends TxResult {
  roundId: bigint
  betIndex: bigint
}

export interface ClaimResult extends TxResult {
  won: boolean
  payout: bigint
}

export interface SessionOptions {
  deployment: CasinoDeployment
  /** Where to remember the last wallet for reconnect(). Defaults to localStorage when available. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  /** Overrides the chain definition (RPC, name) used for reads and for wallet_addEthereumChain. */
  chain?: Chain
}

const STATUS: RoundStatus[] = ['none', 'requested', 'settled', 'expired']
const STORAGE_KEY = 'block-casino:wallet'

function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// ------------------------------------------------------------------ session

/**
 * One player's wallet connection plus every casino action. Framework-free:
 * subscribe() for state changes, and await the actions.
 *
 *   const session = createWalletSession({ deployment })
 *   const wallets = await discoverWallets()
 *   await session.connect(wallets[0])
 *   await session.getChips()
 *   const bet = await session.placeBet(0, 1, parseEther('10'))
 */
export function createWalletSession(opts: SessionOptions) {
  const { deployment } = opts
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage
  const base = opts.chain ?? CHAINS[deployment.chainId]
  if (!base) throw new WalletError('UNKNOWN', { message: `No chain definition for chain ${deployment.chainId}. Pass options.chain.` })
  const chain: Chain = deployment.rpc ? { ...base, rpcUrls: { default: { http: [deployment.rpc] } } } : base

  const casino = { address: deployment.contracts.blockCasino, abi: blockCasinoAbi } as const
  const chip = { address: deployment.contracts.chipToken, abi: chipTokenAbi } as const
  // Reads go straight to the RPC, so they work before a wallet connects and on any wallet network.
  const reader: PublicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })

  let state: WalletState = { status: 'disconnected', wallet: null, address: null, chainId: null, targetChainId: chain.id }
  let provider: EIP1193Provider | null = null
  let walletClient: WalletClient | null = null
  const listeners = new Set<(s: WalletState) => void>()

  function set(patch: Partial<WalletState>) {
    state = { ...state, ...patch }
    if (state.address && state.chainId !== null) state.status = state.chainId === chain.id ? 'connected' : 'wrong-network'
    listeners.forEach((l) => l(state))
  }

  // ---- provider events
  const onAccounts = (accounts: string[]) => {
    if (accounts.length === 0) return void detach('disconnected')
    set({ address: accounts[0] as Address })
  }
  const onChain = (hex: string) => set({ chainId: Number(hex) })
  const onDisconnect = () => void detach('disconnected')

  function attach(p: EIP1193Provider) {
    provider = p
    walletClient = createWalletClient({ chain, transport: custom(p) })
    p.on('accountsChanged', onAccounts)
    p.on('chainChanged', onChain)
    p.on('disconnect', onDisconnect)
  }

  function detach(status: ConnectionStatus) {
    if (provider) {
      provider.removeListener('accountsChanged', onAccounts)
      provider.removeListener('chainChanged', onChain)
      provider.removeListener('disconnect', onDisconnect)
    }
    provider = null
    walletClient = null
    set({ status, wallet: null, address: null, chainId: null })
  }

  async function adopt(w: DiscoveredWallet, accounts: string[]) {
    attach(w.provider)
    const chainId = Number(await w.provider.request({ method: 'eth_chainId' }))
    set({ wallet: w.info, address: accounts[0] as Address, chainId })
    storage?.setItem(STORAGE_KEY, w.info.rdns)
  }

  const wrongNetwork = () => new WalletError('WRONG_NETWORK', { message: `Switch your wallet to ${chain.name} to play.` })

  /** The connected account on the right network, or a WalletError. */
  function need(): { wallet: WalletClient; account: Address } {
    if (!walletClient || !state.address) throw new WalletError('NO_WALLET')
    if (state.status === 'wrong-network') throw wrongNetwork()
    return { wallet: walletClient, account: state.address }
  }

  /** Simulates (so reverts surface as readable errors before the wallet pops up), sends, waits. */
  async function send(params: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[]; value?: bigint }) {
    const { wallet, account } = need()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { request } = await reader.simulateContract({ ...(params as any), account })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await wallet.writeContract({ ...(request as any), account, chain })
      const receipt = await reader.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new WalletError('UNKNOWN', { message: 'Transaction reverted.' })
      return { hash, receipt }
    } catch (e) {
      throw toWalletError(e)
    }
  }

  const api = {
    deployment,
    chain,

    // -------------------------------------------------------------- state

    getState: (): WalletState => state,

    /** Calls `listener` on every state change. Returns an unsubscribe function. */
    subscribe(listener: (s: WalletState) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // -------------------------------------------------------------- connection

    /** Asks the wallet for an account (opens its popup), then switches it to the casino's chain. */
    async connect(w: DiscoveredWallet): Promise<WalletState> {
      if (provider) detach('disconnected')
      set({ status: 'connecting', wallet: w.info })
      try {
        const accounts = (await w.provider.request({ method: 'eth_requestAccounts' })) as string[]
        if (!accounts?.length) throw new WalletError('NO_WALLET')
        await adopt(w, accounts)
        if (state.status === 'wrong-network') await api.switchNetwork()
        return state
      } catch (e) {
        const err = toWalletError(e)
        // A refused network switch leaves the wallet connected on the wrong chain. Anything else: back to disconnected.
        if (!(err.code === 'USER_REJECTED' && state.address)) detach('disconnected')
        throw err
      }
    },

    /**
     * Silent reconnect on page load: if the last-used wallet is installed and
     * already authorized this site, connects without a popup. Returns true if it did.
     */
    async reconnect(wallets: DiscoveredWallet[]): Promise<boolean> {
      const rdns = storage?.getItem(STORAGE_KEY)
      const w = rdns ? wallets.find((x) => x.info.rdns === rdns) : undefined
      if (!w) return false
      try {
        const accounts = (await w.provider.request({ method: 'eth_accounts' })) as string[]
        if (!accounts?.length) return false
        await adopt(w, accounts)
        return true
      } catch {
        return false
      }
    },

    /** Forgets the wallet on this site. Wallets have no standard "log out", so this is local. */
    disconnect(): void {
      storage?.removeItem(STORAGE_KEY)
      detach('disconnected')
    },

    /** Switches the wallet to the casino's chain, adding the chain to the wallet first if needed. */
    async switchNetwork(): Promise<void> {
      if (!provider) throw new WalletError('NO_WALLET')
      const chainId = numberToHex(chain.id)
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
      } catch (e) {
        const code = (e as { code?: number; data?: { originalError?: { code?: number } } })?.code
        const nested = (e as { data?: { originalError?: { code?: number } } })?.data?.originalError?.code
        if (code !== 4902 && nested !== 4902) throw toWalletError(e)
        await provider
          .request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: chain.rpcUrls.default.http as string[],
                blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
              },
            ],
          })
          .catch((err) => {
            throw toWalletError(err)
          })
        // Adding a chain doesn't have to switch to it (EIP-3085). Ask again if we're not there.
        if (Number(await provider.request({ method: 'eth_chainId' })) !== chain.id) {
          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }).catch((err) => {
            throw toWalletError(err)
          })
        }
      }
      // Some wallets switch without emitting chainChanged. Read it back.
      set({ chainId: Number(await provider.request({ method: 'eth_chainId' })) })
      if (state.status === 'wrong-network') throw wrongNetwork()
    },

    // -------------------------------------------------------------- reads (no wallet needed)

    async config(): Promise<RoundConfig> {
      const read = (functionName: 'genesisBlock' | 'roundLength' | 'bettingWindow' | 'settleTimeout' | 'minBet' | 'maxBet') =>
        reader.readContract({ ...casino, functionName })
      const [genesisBlock, roundLength, bettingWindow, settleTimeout, minBet, maxBet] = await Promise.all([
        read('genesisBlock'),
        read('roundLength'),
        read('bettingWindow'),
        read('settleTimeout'),
        read('minBet'),
        read('maxBet'),
      ])
      return { genesisBlock, roundLength, bettingWindow, settleTimeout, minBet, maxBet }
    },

    async balances(address: Address | null = state.address): Promise<Balances> {
      if (!address) throw new WalletError('NO_WALLET')
      const [mon, chips, allowance] = await Promise.all([
        reader.getBalance({ address }),
        reader.readContract({ ...chip, functionName: 'balanceOf', args: [address] }),
        reader.readContract({ ...chip, functionName: 'allowance', args: [address, casino.address] }),
      ])
      return { mon, chips, allowance }
    },

    /** When the free chips faucet is next available for this player (unix seconds; 0 = now). */
    async faucetAvailableAt(address: Address | null = state.address): Promise<bigint> {
      if (!address) throw new WalletError('NO_WALLET')
      const [last, cooldown] = await Promise.all([
        reader.readContract({ ...chip, functionName: 'lastFaucetAt', args: [address] }),
        reader.readContract({ ...chip, functionName: 'FAUCET_COOLDOWN' }),
      ])
      return last === 0n ? 0n : last + cooldown
    },

    async round(roundId: bigint): Promise<RoundInfo> {
      const [status, , seed, totalStaked] = await reader.readContract({ ...casino, functionName: 'rounds', args: [roundId] })
      return { status: STATUS[status], seed, totalStaked }
    },

    /** This player's bets in a round, for restoring the UI after a reload. */
    async myBets(roundId: bigint, address: Address | null = state.address): Promise<Bet[]> {
      if (!address) throw new WalletError('NO_WALLET')
      const indexes = await reader.readContract({ ...casino, functionName: 'betsOf', args: [roundId, address] })
      return Promise.all(
        indexes.map(async (betIndex) => {
          const b = await reader.readContract({ ...casino, functionName: 'getBet', args: [roundId, betIndex] })
          return { roundId, betIndex, player: b.player, gameId: b.gameId, choice: b.choice, amount: b.amount, closed: b.closed }
        }),
      )
    },

    /** VRF fee in MON wei for requestSettlement. */
    async settlementFee(): Promise<bigint> {
      const source = await reader.readContract({ ...casino, functionName: 'randomness' })
      return reader.readContract({ address: source, abi: randomnessSourceAbi, functionName: 'fee' })
    },

    // -------------------------------------------------------------- actions (wallet popups)

    /** Free play chips, once a day. */
    async getChips(): Promise<TxResult> {
      const { hash } = await send({ ...chip, functionName: 'faucet' })
      return { hash }
    },

    /** Lets the casino move chips. Approves the maximum once, so later bets need one popup, not two. */
    async approveChips(): Promise<TxResult> {
      const { hash } = await send({ ...chip, functionName: 'approve', args: [casino.address, maxUint256] })
      return { hash }
    },

    /**
     * Bets on the current round. Approves first if the allowance is too low
     * (one extra popup, the first time only). Returns the round and bet index
     * the contract actually used, read from the BetPlaced event.
     */
    async placeBet(gameId: number, choice: number, amount: bigint): Promise<PlacedBet> {
      const { account } = need()
      const allowance = await reader.readContract({ ...chip, functionName: 'allowance', args: [account, casino.address] })
      if (allowance < amount) await api.approveChips()
      const { hash, receipt } = await send({ ...casino, functionName: 'placeBet', args: [gameId, choice, amount] })
      const [ev] = parseEventLogs({ abi: blockCasinoAbi, eventName: 'BetPlaced', logs: receipt.logs })
      if (!ev) throw new WalletError('UNKNOWN', { message: 'Bet sent, but no BetPlaced event was found.' })
      return { hash, roundId: ev.args.roundId, betIndex: ev.args.betIndex }
    },

    /** Requests the round's random result. The caller pays the VRF fee (≈0.124 MON on testnet). */
    async requestSettlement(roundId: bigint): Promise<TxResult> {
      const fee = await api.settlementFee()
      const { hash } = await send({ ...casino, functionName: 'requestSettlement', args: [roundId], value: fee })
      return { hash }
    },

    /** Pays out a settled bet (losing bets close with payout 0). Anyone can call it; chips go to the bettor. */
    async claim(roundId: bigint, betIndex: bigint): Promise<ClaimResult> {
      const { hash, receipt } = await send({ ...casino, functionName: 'claim', args: [roundId, betIndex] })
      const [ev] = parseEventLogs({ abi: blockCasinoAbi, eventName: 'BetClaimed', logs: receipt.logs })
      return { hash, won: ev?.args.won ?? false, payout: ev?.args.payout ?? 0n }
    },

    /** Returns the stake if the round never got its random result within the settle timeout. */
    async refund(roundId: bigint, betIndex: bigint): Promise<TxResult> {
      const { hash } = await send({ ...casino, functionName: 'refund', args: [roundId, betIndex] })
      return { hash }
    },
  }
  return api
}

export type WalletSession = ReturnType<typeof createWalletSession>
