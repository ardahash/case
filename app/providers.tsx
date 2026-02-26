"use client";

import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { wagmiConfig } from "@/lib/wagmi";
import { MiniKitReady } from "@/components/shared/MiniKitReady";
import { activeChain, rpcUrl } from "@/lib/chains";
import { MiniAppProvider } from "@/app/providers/MiniAppProvider";
import { GrowthTracker } from "@/components/growth/GrowthTracker";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY}
          chain={activeChain}
          rpcUrl={rpcUrl}
          miniKit={{ enabled: true, autoConnect: true }}
        >
          <MiniAppProvider>
            <MiniKitReady />
            <GrowthTracker />
            {children}
          </MiniAppProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
