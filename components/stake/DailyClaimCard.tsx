"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { stakingAbi } from "@/lib/abis/staking";
import { contractAddresses, contractFlags } from "@/lib/contracts";

export function DailyClaimCard() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cooldownLabel = useMemo(() => {
    if (!isConnected) return "Connect wallet";
    return "Onchain (24h)";
  }, [isConnected]);

  const handleClaim = async () => {
    if (!address) {
      toast.error("Connect your wallet to claim.");
      return;
    }

    if (contractFlags.usingMockAddresses) {
      toast.message("Claim simulated. Wire the live staking contract.");
      return;
    }

    try {
      setIsSubmitting(true);
      await writeContractAsync({
        address: contractAddresses.xCaseStaking,
        abi: stakingAbi,
        functionName: "claimDailyMiniCase",
      });
      toast.success("Daily mini-case claimed.");
    } catch (error) {
      console.error(error);
      toast.error("Daily claim failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Daily Mini-Case</CardTitle>
        <CardDescription>Reward range $0.001 - $0.10 worth of cbBTC (onchain enforced).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>Cooldown</span>
          <span className="font-mono text-muted-foreground">{cooldownLabel}</span>
        </div>
        <Button onClick={handleClaim} disabled={!isConnected || isSubmitting}>
          {isSubmitting ? "Claiming..." : "Claim Daily Mini-Case"}
        </Button>
      </CardContent>
    </Card>
  );
}
