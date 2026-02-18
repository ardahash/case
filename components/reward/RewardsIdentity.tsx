"use client";

import {
  Address,
  Avatar,
  Identity,
  Name,
  isBasename,
  useName,
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeChain } from "@/lib/chains";

export function RewardsIdentity() {
  const { address } = useAccount();

  const { data: resolvedName, isLoading: isNameLoading } = useName({
    address,
    chain: activeChain,
  });
  const nameLabel = resolvedName
    ? isBasename(resolvedName)
      ? "Basename"
      : "ENS"
    : "Basename / ENS";

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Identity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!address ? (
          <p className="text-muted-foreground">
            Connect your wallet to display your Basename or Farcaster handle.
          </p>
        ) : (
          <>
            <Identity
              address={address}
              chain={activeChain}
              hasCopyAddressOnClick
              className="flex flex-row items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4"
            >
              <Avatar className="h-10 w-10" />
              <div className="flex flex-col">
                <Name className="text-base font-semibold" />
                <Address className="text-xs text-muted-foreground" />
              </div>
            </Identity>

            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{nameLabel}</span>
                <span className="max-w-[60%] truncate font-medium">
                  {resolvedName ??
                    (isNameLoading ? "Resolving..." : "Not set")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Farcaster</span>
                <span className="max-w-[60%] truncate font-medium">Not set</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
