import { type Chain } from 'viem';
/** Verified 2026-11-15: chain ID 10143 (live eth_chainId), RPC and explorers from docs.monad.xyz. */
export declare const monadTestnet: {
    blockExplorers: {
        readonly default: {
            readonly name: "Monadscan";
            readonly url: "https://testnet.monadscan.com";
        };
    };
    contracts?: import("viem").Prettify<{
        [key: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
    } & {
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        universalSignatureVerifier?: import("viem").ChainContract | undefined;
    }> | undefined;
    id: 10143;
    name: "Monad Testnet";
    nativeCurrency: {
        readonly name: "Monad";
        readonly symbol: "MON";
        readonly decimals: 18;
    };
    rpcUrls: {
        readonly default: {
            readonly http: readonly ["https://testnet-rpc.monad.xyz"];
        };
    };
    sourceId?: number | undefined;
    testnet: true;
    custom?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
};
/** Local anvil from `cd backend && npm run dev`. */
export declare const localAnvil: {
    blockExplorers?: {
        [key: string]: {
            name: string;
            url: string;
            apiUrl?: string | undefined;
        };
        default: {
            name: string;
            url: string;
            apiUrl?: string | undefined;
        };
    } | undefined;
    contracts?: import("viem").Prettify<{
        [key: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
    } & {
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        universalSignatureVerifier?: import("viem").ChainContract | undefined;
    }> | undefined;
    id: 31337;
    name: "Local (anvil)";
    nativeCurrency: {
        readonly name: "Monad";
        readonly symbol: "MON";
        readonly decimals: 18;
    };
    rpcUrls: {
        readonly default: {
            readonly http: readonly ["http://127.0.0.1:8545"];
        };
    };
    sourceId?: number | undefined;
    testnet: true;
    custom?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
};
export declare const CHAINS: Record<number, Chain>;
/** Where players get testnet MON for gas. The host answered on 2026-11-15 (rate-limited, so its page wasn't checked). */
export declare const MON_FAUCET_URL = "https://faucet.monad.xyz";
