"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { xCaseStakingAbi } from "@/lib/abis/xCaseStaking";
import { erc20Abi } from "@/lib/abis/erc20";
import { contractAddresses, contractFlags, CASE_DECIMALS, USDC_DECIMALS } from "@/lib/contracts";

export function XCaseStakePanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: xCaseBalance } = useReadContract({
    address: contractAddresses.xCaseToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: stakedBalance } = useReadContract({
    address: contractAddresses.xCaseStaking,
    abi: xCaseStakingAbi,
    functionName: "stakedBalance",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: pendingRewards } = useReadContract({
    address: contractAddresses.xCaseStaking,
    abi: xCaseStakingAbi,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const xCaseLabel = useMemo(() => {
    if (!xCaseBalance) return "0";
    return Number(formatUnits(xCaseBalance, CASE_DECIMALS)).toFixed(4);
  }, [xCaseBalance]);

  const stakedLabel = useMemo(() => {
    if (!stakedBalance) return "0";
    return Number(formatUnits(stakedBalance, CASE_DECIMALS)).toFixed(4);
  }, [stakedBalance]);

  const pendingLabel = useMemo(() => {
    if (!pendingRewards) return "0";
    return Number(formatUnits(pendingRewards, USDC_DECIMALS)).toFixed(4);
  }, [pendingRewards]);

  const parsedAmount = useMemo(() => {
    if (!amount) return null;
    try {
      return parseUnits(amount, CASE_DECIMALS);
    } catch {
      return null;
    }
  }, [amount]);

  const handleStake = async () => {
    if (!parsedAmount || parsedAmount <= 0n) {
      toast.error("Enter a stake amount.");
      return;
    }

    if (contractFlags.usingMockAddresses) {
      toast.message("Stake simulated. Wire xCASE staking onchain.");
      return;
    }

    try {
      setIsSubmitting(true);
      await writeContractAsync({
        address: contractAddresses.xCaseStaking,
        abi: xCaseStakingAbi,
        functionName: "stake",
        args: [parsedAmount],
      });
      toast.success("xCASE staked.");
    } catch (error) {
      console.error(error);
      toast.error("Stake failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnstake = async () => {
    if (!parsedAmount || parsedAmount <= 0n) {
      toast.error("Enter an unstake amount.");
      return;
    }

    if (contractFlags.usingMockAddresses) {
      toast.message("Unstake simulated. Wire xCASE staking onchain.");
      return;
    }

    try {
      setIsSubmitting(true);
      await writeContractAsync({
        address: contractAddresses.xCaseStaking,
        abi: xCaseStakingAbi,
        functionName: "unstake",
        args: [parsedAmount],
      });
      toast.success("Unstake submitted.");
    } catch (error) {
      console.error(error);
      toast.error("Unstake failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaim = async () => {
    if (contractFlags.usingMockAddresses) {
      toast.message("Claim simulated. Wire xCASE staking onchain.");
      return;
    }

    try {
      setIsSubmitting(true);
      await writeContractAsync({
        address: contractAddresses.xCaseStaking,
        abi: xCaseStakingAbi,
        functionName: "claim",
      });
      toast.success("Rewards claimed.");
    } catch (error) {
      console.error(error);
      toast.error("Claim failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Stake xCASE</CardTitle>
        <CardDescription>Stake xCASE to earn platform fee rewards (USDC for MVP).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>xCASE balance</span>
          <span className="font-mono text-muted-foreground">{xCaseLabel} xCASE</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>Staked</span>
          <span className="font-mono text-muted-foreground">{stakedLabel} xCASE</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>Pending rewards</span>
          <span className="font-mono text-muted-foreground">{pendingLabel} USDC</span>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="xcase-amount">Amount</Label>
          <Input
            id="xcase-amount"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleStake} disabled={isSubmitting || !address}>
            Stake
          </Button>
          <Button onClick={handleUnstake} variant="secondary" disabled={isSubmitting || !address}>
            Unstake
          </Button>
          <Button onClick={handleClaim} variant="outline" disabled={isSubmitting || !address}>
            Claim Rewards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
