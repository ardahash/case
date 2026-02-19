"use client";

import { useEffect, useMemo, useState } from "react";
import { Identity, Avatar, Name, Address } from "@coinbase/onchainkit/identity";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useIsMiniKit } from "@/hooks/useIsMiniKit";
import { shortAddress } from "@/lib/format";

export function WalletStatus() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const isMiniKit = useIsMiniKit();
  const [showPicker, setShowPicker] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [hasCoinbase, setHasCoinbase] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as typeof window & { ethereum?: any }).ethereum;
    const providers = Array.isArray(eth?.providers)
      ? eth.providers
      : eth
        ? [eth]
        : [];

    const nextHasMetaMask = providers.some((provider: any) => provider?.isMetaMask);
    const nextHasCoinbase = providers.some((provider: any) => provider?.isCoinbaseWallet);
    setHasMetaMask(nextHasMetaMask);
    setHasCoinbase(nextHasCoinbase);
  }, []);

  const metaMaskConnector = useMemo(
    () => connectors.find((connector) => connector.id === "metaMask"),
    [connectors],
  );
  const coinbaseConnector = useMemo(
    () => connectors.find((connector) => connector.id === "coinbaseWallet"),
    [connectors],
  );
  const walletConnectConnector = useMemo(
    () => connectors.find((connector) => connector.id === "walletConnect"),
    [connectors],
  );
  const availableConnectors = useMemo(
    () =>
      connectors.filter((connector) => connector.id !== "farcasterMiniApp"),
    [connectors],
  );

  const handleConnect = async () => {
    if (hasMetaMask && hasCoinbase) {
      setShowPicker((prev) => !prev);
      return;
    }

    const connector = hasMetaMask
      ? metaMaskConnector
      : hasCoinbase
        ? coinbaseConnector
        : walletConnectConnector;

    if (!connector) {
      setShowPicker(true);
      return;
    }

    try {
      await connectAsync({ connector });
    } catch (error) {
      console.error(error);
      toast.error("Wallet connection failed. Try a different wallet.");
    }
  };

  const handlePick = async (connectorId: string) => {
    const connector = availableConnectors.find((item) => item.id === connectorId);
    if (!connector) return;
    try {
      await connectAsync({ connector });
      setShowPicker(false);
    } catch (error) {
      console.error(error);
      toast.error("Wallet connection failed. Try a different wallet.");
    }
  };

  if (isMiniKit) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="uppercase tracking-[0.2em] text-[10px]">MiniKit</span>
        <span>{isConnected ? shortAddress(address) : "Linked"}</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Identity className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs">
          <Avatar className="h-4 w-4" />
          <Name />
          <Address className="text-xs text-muted-foreground" />
        </Identity>
        <Button size="sm" variant="secondary" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button onClick={handleConnect} disabled={isPending}>
        {isPending ? "Connecting..." : "Connect Wallet"}
      </Button>
      {showPicker && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-background p-2 shadow-lg">
          <div className="px-2 pb-2 text-xs text-muted-foreground">
            Choose a wallet
          </div>
          <div className="flex flex-col gap-2">
            {availableConnectors.map((connector) => (
              <Button
                key={connector.id}
                variant="secondary"
                onClick={() => handlePick(connector.id)}
              >
                {connector.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

