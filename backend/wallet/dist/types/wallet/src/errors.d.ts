import type { DiscoveredWallet } from './discovery';
export type WalletErrorCode = 'NO_WALLET' | 'CHOOSE_WALLET' | 'USER_REJECTED' | 'WRONG_NETWORK' | 'INSUFFICIENT_GAS' | 'FAUCET_COOLDOWN' | 'BETTING_CLOSED' | 'BAD_BET' | 'NOT_ENOUGH_CHIPS' | 'NOT_SETTLED' | 'ALREADY_DONE' | 'NOT_REFUNDABLE' | 'NOT_LOCKED' | 'NO_BETS' | 'UNKNOWN';
/** Every error the SDK throws. `code` is for logic, `message` is safe to show players. */
export declare class WalletError extends Error {
    readonly code: WalletErrorCode;
    /** Contract error name, if a contract reverted (for example "FaucetCooldown"). */
    readonly revert?: string;
    /** Contract error arguments, for example [availableAt] for FaucetCooldown. */
    readonly args?: readonly unknown[];
    readonly cause?: unknown;
    /** CHOOSE_WALLET only: the installed wallets, to show in a picker. */
    readonly wallets?: readonly DiscoveredWallet[];
    constructor(code: WalletErrorCode, opts?: {
        message?: string;
        revert?: string;
        args?: readonly unknown[];
        cause?: unknown;
        wallets?: readonly DiscoveredWallet[];
    });
}
/** Turns anything a wallet, viem or a contract throws into a WalletError. */
export declare function toWalletError(e: unknown): WalletError;
