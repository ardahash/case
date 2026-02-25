"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { caseStakingAbi } from "@/lib/abis/caseStaking";
import { erc20Abi } from "@/lib/abis/erc20";
import { contractAddresses, contractFlags, CASE_DECIMALS } from "@/lib/contracts";

export function StakePanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
  const caseTokenAddress = contractAddresses.caseToken as `0x${string}`;
  const xCaseTokenAddress = contractAddresses.xCaseToken as `0x${string}`;
  const caseStakingAddress = contractAddresses.caseStaking as `0x${string}`;

  const { data: tokenBalance } = useReadContract({
    address: caseTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: xCaseBalance } = useReadContract({
    address: xCaseTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: caseTokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, caseStakingAddress] : undefined,
    query: { enabled: Boolean(address) },
  });

  const approveReceipt = useWaitForTransactionReceipt({
    hash: approveHash ?? undefined,
    query: { enabled: Boolean(approveHash), refetchInterval: 4000, refetchOnWindowFocus: true },
  });

  const walletLabel = useMemo(() => {
    if (!tokenBalance) return "0";
    return Number(formatUnits(tokenBalance, CASE_DECIMALS)).toFixed(4);
  }, [tokenBalance]);

  const xCaseLabel = useMemo(() => {
    if (!xCaseBalance) return "0";
    return Number(formatUnits(xCaseBalance, CASE_DECIMALS)).toFixed(4);
  }, [xCaseBalance]);

  const parsedAmount = useMemo(() => {
    if (!amount) return null;
    try {
      return parseUnits(amount, CASE_DECIMALS);
    } catch {
      return null;
    }
  }, [amount]);

  const hasAllowance = useMemo(() => {
    if (!parsedAmount || !allowance) return false;
    return allowance >= parsedAmount;
  }, [allowance, parsedAmount]);

  const handleApprove = async () => {
    if (!parsedAmount || parsedAmount <= 0n) {
      toast.error("Enter an amount to approve.");
      return;
    }

    if (contractFlags.usingMockAddresses) {
      toast.message("Approval simulated. Wire CaseStaking onchain.");
      return;
    }

    try {
      setIsSubmitting(true);
      const hash = await writeContractAsync({
        address: caseTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [caseStakingAddress, parsedAmount],
      });
      setApproveHash(hash);
      toast.message("Approval sent.");
    } catch (error) {
      console.error(error);
      toast.error("Approval failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStake = async () => {
    if (!parsedAmount || parsedAmount <= 0n) {
      toast.error("Enter a stake amount.");
      return;
    }
    if (!hasAllowance) {
      toast.error("Approve CASE first.");
      return;
    }

    if (contractFlags.usingMockAddresses) {
      toast.message("Stake simulated. Wire CaseStaking onchain.");
      return;
    }

    try {
      setIsSubmitting(true);
      await writeContractAsync({
        address: caseStakingAddress,
        abi: caseStakingAbi,
        functionName: "stake",
        args: [parsedAmount],
      });
      toast.success("CASE staked. xCASE minted.");
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
      toast.message("Unstake simulated. Wire CaseStaking onchain.");
      return;
    }

    try {
      setIsSubmitting(true);
      await writeContractAsync({
        address: caseStakingAddress,
        abi: caseStakingAbi,
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

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      refetchAllowance();
      toast.success("CASE approved.");
    }
  }, [approveReceipt.isSuccess, refetchAllowance]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Stake CASE</CardTitle>
        <CardDescription>Stake CASE to mint xCASE at a 1:1 ratio.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>Wallet balance</span>
          <span className="font-mono text-muted-foreground">{walletLabel} CASE</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>xCASE balance</span>
          <span className="font-mono text-muted-foreground">{xCaseLabel} xCASE</span>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="stake-amount">Amount</Label>
          <Input
            id="stake-amount"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleApprove} variant="outline" disabled={isSubmitting || !address || hasAllowance}>
            {approveReceipt.isLoading ? "Approving..." : hasAllowance ? "Approved" : "Approve CASE"}
          </Button>
          <Button onClick={handleStake} disabled={isSubmitting || !address || !hasAllowance}>
            Stake
          </Button>
          <Button onClick={handleUnstake} variant="secondary" disabled={isSubmitting || !address}>
            Unstake
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
