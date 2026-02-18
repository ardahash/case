import { base, baseSepolia } from "viem/chains";

export const isTestnet =
  process.env.NEXT_PUBLIC_CHAIN === "base-sepolia" ||
  process.env.NEXT_PUBLIC_USE_TESTNET === "true";

export const activeChain = isTestnet ? baseSepolia : base;

export const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL || activeChain.rpcUrls.default.http[0];

export const chainLabel = isTestnet ? "Base Sepolia" : "Base";

export const explorerBaseUrl = isTestnet
  ? "https://sepolia.basescan.org"
  : "https://basescan.org";

