import type { EIP1193Provider } from 'viem';
/** EIP-6963 wallet metadata, as each wallet announces itself. */
export interface WalletInfo {
    uuid: string;
    /** Display name, like "MetaMask" or "Phantom". */
    name: string;
    /** Data URI of the wallet's icon, ready for an <img src>. */
    icon: string;
    /** Reverse-DNS id, like "io.metamask". Stable across page loads; used to reconnect. */
    rdns: string;
}
export interface DiscoveredWallet {
    info: WalletInfo;
    provider: EIP1193Provider;
}
type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> & {
    ethereum?: EIP1193Provider;
};
/**
 * Lists installed wallets as they announce themselves (EIP-6963) and calls
 * `onChange` with the full list each time one appears. Wallets that only inject
 * `window.ethereum` show up as "Browser wallet". Returns a stop function.
 */
export declare function watchWallets(onChange: (wallets: DiscoveredWallet[]) => void, target?: Target | undefined): () => void;
/** One-shot version of watchWallets: waits `ms` for announcements, then returns the list. */
export declare function discoverWallets(ms?: number, target?: Target | undefined): Promise<DiscoveredWallet[]>;
export {};
