"use client";

import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Identity, Avatar, Name, Address } from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { useIsMiniKit } from "@/hooks/useIsMiniKit";
import { shortAddress } from "@/lib/format";

export function WalletStatus() {
  const { address, isConnected } = useAccount();
  const isMiniKit = useIsMiniKit();

  if (isMiniKit) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="uppercase tracking-[0.2em] text-[10px]">MiniKit</span>
        <span>{isConnected ? shortAddress(address) : "Linked"}</span>
      </div>
    );
  }

  return (
    <Wallet>
      <ConnectWallet className="rounded-full" disconnectedLabel="Connect Wallet">
        <Avatar className="h-5 w-5" />
        <Name />
      </ConnectWallet>
      <WalletDropdown>
        <Identity className="px-4 pb-3 pt-4" hasCopyAddressOnClick>
          <Avatar />
          <Name />
          <Address className="text-xs text-muted-foreground" />
        </Identity>
        <WalletDropdownDisconnect />
      </WalletDropdown>
    </Wallet>
  );
}

