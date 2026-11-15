import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  maxUint256,
  webSocket,
  type Address,
  type EIP1193Provider,
  type WalletClient,
} from 'viem'
import { casinoAbi, chipAbi, randomnessAbi } from './abi'
import type { CasinoClient, PlacedBet, RoundState, RoundStatus } from './types'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

const env = import.meta.env
const httpUrl = env.VITE_RPC_HTTP || 'https://testnet-rpc.monad.xyz'
const wsUrl = env.VITE_RPC_WS || undefined

// UNVERIFIED: chain ID 10143 and the RPC URL are from memory. Check Monad's docs.
export const monadTestnet = defineChain({
  id: Number(env.VITE_CHAIN_ID || 10143),
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: wsUrl ? { http: [httpUrl], webSocket: [wsUrl] } : { http: [httpUrl] } },
})

const STATUS: RoundStatus[] = ['none', 'requested', 'settled', 'expired']

export function createChainClient(): CasinoClient {
  const casino = env.VITE_CASINO_ADDRESS as Address | undefined
  const chip = env.VITE_CHIP_ADDRESS as Address | undefined
  if (!casino || !chip) throw new Error('Set VITE_CASINO_ADDRESS and VITE_CHIP_ADDRESS in frontend/.env')

  const pub = createPublicClient({ chain: monadTestnet, transport: wsUrl ? webSocket(wsUrl) : http(httpUrl) })
  let wallet: WalletClient | undefined
  let account: Address | undefined

  function need() {
    if (!wallet || !account) throw new Error('Connect a wallet first')
    return { wallet, account }
  }

  // Takes a request from simulateContract. viem's types for those don't line up
  // with writeContract across payable and non-payable calls, hence the cast.
  async function send(request: object) {
    const { wallet } = need()
    const hash = await wallet.writeContract(request as Parameters<WalletClient['writeContract']>[0])
    await pub.waitForTransactionReceipt({ hash })
  }

  return {
    mode: 'chain',
    label: 'MONAD TESTNET',
    autoSettles: false,

    async init() {
      const read = (functionName: 'genesisBlock' | 'roundLength' | 'bettingWindow' | 'minBet' | 'maxBet') =>
        pub.readContract({ address: casino, abi: casinoAbi, functionName })
      const [genesisBlock, roundLength, bettingWindow, minBet, maxBet] = await Promise.all([
        read('genesisBlock'),
        read('roundLength'),
        read('bettingWindow'),
        read('minBet'),
        read('maxBet'),
      ])
      return { genesisBlock, roundLength, bettingWindow, minBet, maxBet }
    },

    subscribeBlocks(cb) {
      return pub.watchBlocks({
        emitMissed: true,
        onBlock: (b) =>
          cb({
            number: b.number,
            hash: b.hash,
            txCount: b.transactions.length,
            gasUsed: b.gasUsed,
            gasLimit: b.gasLimit,
            timestamp: Number(b.timestamp),
          }),
      })
    },

    async connect() {
      if (!window.ethereum) throw new Error('No browser wallet found')
      wallet = createWalletClient({ chain: monadTestnet, transport: custom(window.ethereum) })
      ;[account] = await wallet.requestAddresses()
      try {
        await wallet.switchChain({ id: monadTestnet.id })
      } catch {
        await wallet.addChain({ chain: monadTestnet })
      }
      return account
    },

    async balance() {
      if (!account) return 0n
      return pub.readContract({ address: chip, abi: chipAbi, functionName: 'balanceOf', args: [account] })
    },

    async faucet() {
      const { account } = need()
      const { request } = await pub.simulateContract({ address: chip, abi: chipAbi, functionName: 'faucet', account })
      await send(request)
    },

    async placeBet(gameId, choice, amount): Promise<PlacedBet> {
      const { account } = need()
      const allowance = await pub.readContract({
        address: chip,
        abi: chipAbi,
        functionName: 'allowance',
        args: [account, casino],
      })
      if (allowance < amount) {
        const { request } = await pub.simulateContract({
          address: chip,
          abi: chipAbi,
          functionName: 'approve',
          args: [casino, maxUint256],
          account,
        })
        await send(request)
      }
      const { request, result } = await pub.simulateContract({
        address: casino,
        abi: casinoAbi,
        functionName: 'placeBet',
        args: [gameId, choice, amount],
        account,
      })
      await send(request)
      return { roundId: result[0], index: Number(result[1]), gameId, choice, amount }
    },

    async roundState(roundId): Promise<RoundState> {
      const [status, , seed] = await pub.readContract({
        address: casino,
        abi: casinoAbi,
        functionName: 'rounds',
        args: [roundId],
      })
      return { status: STATUS[status] ?? 'none', seed: status === 2 ? seed : undefined }
    },

    async requestSettlement(roundId) {
      const { account } = need()
      const source = await pub.readContract({ address: casino, abi: casinoAbi, functionName: 'randomness' })
      const fee = await pub.readContract({ address: source, abi: randomnessAbi, functionName: 'fee' })
      const { request } = await pub.simulateContract({
        address: casino,
        abi: casinoAbi,
        functionName: 'requestSettlement',
        args: [roundId],
        value: fee,
        account,
      })
      await send(request)
    },

    async claim(bet) {
      const { account } = need()
      const { request } = await pub.simulateContract({
        address: casino,
        abi: casinoAbi,
        functionName: 'claim',
        args: [bet.roundId, BigInt(bet.index)],
        account,
      })
      await send(request)
    },
  }
}
