import { createConfig, http } from "wagmi";
import { coinbaseWallet, metaMask, walletConnect } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { activeChain, rpcUrl } from "./chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const appUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

const buildConfig = () => {
  const connectors = [
    farcasterMiniApp(),
    coinbaseWallet({
      appName: "Case",
      preference: "all",
    }),
    metaMask(),
  ];

  if (walletConnectProjectId) {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: "Case",
          description: "Case mini-app",
          url: appUrl,
          icons: [`${appUrl}/icon.png`],
        },
      }),
    );
  }

  return createConfig({
    chains: [activeChain],
    transports: {
      [activeChain.id]: http(rpcUrl),
    },
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
