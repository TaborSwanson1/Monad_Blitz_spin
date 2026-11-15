import { type Address, type Chain, type Hash } from 'viem';
import type { DiscoveredWallet, WalletInfo } from './discovery';
/** The parts of backend/exports/<network>/deployment.json the SDK needs. */
export interface CasinoDeployment {
    chainId: number;
    rpc?: string;
    contracts: {
        blockCasino: Address;
        chipToken: Address;
    };
}
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'wrong-network';
export interface WalletState {
    status: ConnectionStatus;
    /** The wallet in use, from discovery. */
    wallet: WalletInfo | null;
    address: Address | null;
    /** The chain the wallet is on right now. */
    chainId: number | null;
    /** The chain the casino is deployed on. */
    targetChainId: number;
}
export interface Balances {
    /** Native MON, for gas and the VRF fee. 18 decimals. */
    mon: bigint;
    /** Play chips. 18 decimals. */
    chips: bigint;
    /** How many chips the casino may move for this player (approve). */
    allowance: bigint;
}
export interface RoundConfig {
    genesisBlock: bigint;
    roundLength: bigint;
    bettingWindow: bigint;
    settleTimeout: bigint;
    minBet: bigint;
    maxBet: bigint;
}
export type RoundStatus = 'none' | 'requested' | 'settled' | 'expired';
export interface RoundInfo {
    status: RoundStatus;
    /** The VRF seed once settled, else 0x00..00. */
    seed: `0x${string}`;
    totalStaked: bigint;
}
export interface Bet {
    roundId: bigint;
    betIndex: bigint;
    player: Address;
    gameId: number;
    choice: number;
    amount: bigint;
    /** Claimed or refunded. */
    closed: boolean;
}
export interface TxResult {
    hash: Hash;
}
export interface PlacedBet extends TxResult {
    roundId: bigint;
    betIndex: bigint;
}
export interface ClaimResult extends TxResult {
    won: boolean;
    payout: bigint;
}
export interface SessionOptions {
    deployment: CasinoDeployment;
    /** Where to remember the last wallet for reconnect(). Defaults to localStorage when available. */
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
    /** Overrides the chain definition (RPC, name) used for reads and for wallet_addEthereumChain. */
    chain?: Chain;
}
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
export declare function createWalletSession(opts: SessionOptions): {
    deployment: CasinoDeployment;
    chain: Chain;
    getState: () => WalletState;
    /** Calls `listener` on every state change. Returns an unsubscribe function. */
    subscribe(listener: (s: WalletState) => void): () => void;
    /** Asks the wallet for an account (opens its popup), then switches it to the casino's chain. */
    connect(w: DiscoveredWallet): Promise<WalletState>;
    /**
     * Silent reconnect on page load: if the last-used wallet is installed and
     * already authorized this site, connects without a popup. Returns true if it did.
     */
    reconnect(wallets: DiscoveredWallet[]): Promise<boolean>;
    /** Forgets the wallet on this site. Wallets have no standard "log out", so this is local. */
    disconnect(): void;
    /** Switches the wallet to the casino's chain, adding the chain to the wallet first if needed. */
    switchNetwork(): Promise<void>;
    config(): Promise<RoundConfig>;
    balances(address?: Address | null): Promise<Balances>;
    /** When the free chips faucet is next available for this player (unix seconds; 0 = now). */
    faucetAvailableAt(address?: Address | null): Promise<bigint>;
    round(roundId: bigint): Promise<RoundInfo>;
    /** This player's bets in a round, for restoring the UI after a reload. */
    myBets(roundId: bigint, address?: Address | null): Promise<Bet[]>;
    /** VRF fee in MON wei for requestSettlement. */
    settlementFee(): Promise<bigint>;
    /** Free play chips, once a day. */
    getChips(): Promise<TxResult>;
    /** Lets the casino move chips. Approves the maximum once, so later bets need one popup, not two. */
    approveChips(): Promise<TxResult>;
    /**
     * Bets on the current round. Approves first if the allowance is too low
     * (one extra popup, the first time only). Returns the round and bet index
     * the contract actually used, read from the BetPlaced event.
     */
    placeBet(gameId: number, choice: number, amount: bigint): Promise<PlacedBet>;
    /** Requests the round's random result. The caller pays the VRF fee (≈0.124 MON on testnet). */
    requestSettlement(roundId: bigint): Promise<TxResult>;
    /** Pays out a settled bet (losing bets close with payout 0). Anyone can call it; chips go to the bettor. */
    claim(roundId: bigint, betIndex: bigint): Promise<ClaimResult>;
    /** Returns the stake if the round never got its random result within the settle timeout. */
    refund(roundId: bigint, betIndex: bigint): Promise<TxResult>;
};
export type WalletSession = ReturnType<typeof createWalletSession>;
