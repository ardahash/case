import { createConfig, http, type CreateConnectorFn } from "wagmi";
import { fallback } from "viem";
import { coinbaseWallet, metaMask, walletConnect } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { activeChain, rpcUrl, rpcUrls } from "./chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const appUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

const buildConfig = () => {
  const connectors = [
    farcasterMiniApp(),
    coinbaseWallet({
      appName: "Case",
      preference: "all",
    }),
    metaMask(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "Case",
              description: "Case mini-app",
              url: appUrl,
              icons: [`${appUrl}/icon.png`],
            },
          }) as unknown as ReturnType<typeof createConfig>["connectors"][number],
        ]
      : []),
  ] as unknown as CreateConnectorFn[];

  const transport =
    rpcUrls.length > 1 ? fallback(rpcUrls.map((url) => http(url))) : http(rpcUrl);

  return createConfig({
    chains: [activeChain],
    transports: {
      [activeChain.id]: transport,
    } as Record<number, typeof transport>,
    connectors,
    ssr: true,
  });
};

const globalForWagmi = globalThis as typeof globalThis & {
  __caseWagmiConfig?: ReturnType<typeof createConfig>;
};

export const wagmiConfig = globalForWagmi.__caseWagmiConfig ?? buildConfig();

if (!globalForWagmi.__caseWagmiConfig) {
  globalForWagmi.__caseWagmiConfig = wagmiConfig;
}
