"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { activeChain, chainLabel } from "@/lib/chains";
import { useIsMiniKit } from "@/hooks/useIsMiniKit";
import { Button } from "@/components/ui/button";

export function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const isMiniKit = useIsMiniKit();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isConnected || isMiniKit) {
    return null;
  }

  if (chainId === activeChain.id) {
    return null;
  }

  const handleSwitch = async () => {
    try {
      setIsSwitching(true);
      await switchChainAsync({ chainId: activeChain.id });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-destructive/10 px-4 py-3 text-sm text-foreground">
      <span className="font-medium">Wrong network</span>
      <span className="text-muted-foreground">
        Switch to {chainLabel} to continue.
      </span>
      <Button onClick={handleSwitch} size="sm" disabled={isSwitching}>
        {isSwitching ? "Switching..." : `Switch to ${chainLabel}`}
      </Button>
    </div>
  );
}

