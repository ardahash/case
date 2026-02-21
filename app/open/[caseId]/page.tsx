"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, parseEventLogs, parseUnits } from "viem";
import { toast } from "sonner";
import { caseSaleAbi } from "@/lib/abis/caseSale";
import { erc20Abi } from "@/lib/abis/erc20";
import { contractAddresses, contractFlags, USDC_DECIMALS } from "@/lib/contracts";
import { getCaseType } from "@/config/caseTypes";
import { formatToken, formatUsd } from "@/lib/format";
import { getExplorerTxUrl } from "@/lib/explorer";
import { Stepper, type StepStatus } from "@/components/shared/Stepper";
import { NetworkGuard } from "@/components/shared/NetworkGuard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpeningsStore } from "@/stores/useOpeningsStore";
import { useCaseAvailability } from "@/hooks/useCaseAvailability";
import { ModelViewer } from "@/components/shared/ModelViewer";

type RewardResponse = {
  openingId: string;
  rewardUsd: number;
  rewardCbBtc: number;
  cbBtcUsdPrice: number;
  randomness: {
    source: string;
    commitment: string;
    serverSeed: string;
    clientSeed: string;
    revealedImmediately: boolean;
  };
};

type StoredFlow = {
  approveHash?: `0x${string}`;
  purchaseHash?: `0x${string}`;
  openingId?: string;
  mockApproved?: boolean;
  mockPaymentConfirmed?: boolean;
  updatedAt?: number;
};

export default function OpenCasePage() {
  const params = useParams();
  const caseType = getCaseType(params.caseId as string);
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const addOpening = useOpeningsStore((state) => state.addOpening);
  const { available, soldOut } = useCaseAvailability(caseType ?? undefined);

  const usdcAddress = contractAddresses.usdc as `0x${string}`;
  const caseSaleAddress = contractAddresses.caseSale as `0x${string}`;

  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
  const [purchaseHash, setPurchaseHash] = useState<`0x${string}` | null>(null);
  const [reward, setReward] = useState<RewardResponse | null>(null);
  const [isVideoDone, setIsVideoDone] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [mockApproved, setMockApproved] = useState(false);
  const [mockPaymentConfirmed, setMockPaymentConfirmed] = useState(false);
  const [openingId, setOpeningId] = useState<bigint | null>(null);
  const [flowLoaded, setFlowLoaded] = useState(false);

  const storageKey = useMemo(() => {
    if (!caseType) return null;
    if (contractFlags.caseSaleConfigured && !address) return null;
    const owner = (address ?? "guest").toLowerCase();
    return `case-open-flow:${caseType.id}:${owner}`;
  }, [caseType, address]);

  const steps = useMemo(
    () => [
      "Approve USDC",
      `Pay ${caseType?.priceUSDC ?? 0} USDC`,
      "Confirmation",
      "Opening video",
      "Reward reveal",
    ],
    [caseType?.priceUSDC],
  );

  const priceUnits = useMemo(() => {
    if (!caseType) return 0n;
    return parseUnits(caseType.priceUSDC.toFixed(2), USDC_DECIMALS);
  }, [caseType]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, caseSaleAddress] : undefined,
    query: {
      enabled: Boolean(address) && contractFlags.caseSaleConfigured,
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  });

  const approveReceipt = useWaitForTransactionReceipt({
    hash: approveHash ?? undefined,
    query: { enabled: Boolean(approveHash), refetchInterval: 4000, refetchOnWindowFocus: true },
  });

  const hasAllowance = allowance ? allowance >= priceUnits : false;
  const effectiveAllowance = !contractFlags.caseSaleConfigured
    ? mockApproved || Boolean(purchaseHash)
    : hasAllowance || approveReceipt.isSuccess || Boolean(purchaseHash);

  const purchaseReceipt = useWaitForTransactionReceipt({
    hash: purchaseHash ?? undefined,
    query: {
      enabled: Boolean(purchaseHash) && contractFlags.caseSaleConfigured,
      refetchInterval: 4000,
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      refetchAllowance();
      toast.success("USDC approved.");
    }
  }, [approveReceipt.isSuccess, refetchAllowance]);

  useEffect(() => {
    if (mockPaymentConfirmed && purchaseHash) {
      toast.success("Payment confirmed. Opening case...");
      void fetchReward(purchaseHash);
      return;
    }

    if (purchaseReceipt.isSuccess && purchaseReceipt.data && contractFlags.caseSaleConfigured) {
      const logs = parseEventLogs({
        abi: caseSaleAbi,
        logs: purchaseReceipt.data.logs,
        eventName: "CasePurchased",
      });
      const matched = logs[0]?.args?.openingId;
      if (matched !== undefined) {
        setOpeningId(matched as bigint);
        toast.success("Payment confirmed. Awaiting randomness...");
      }
    }
  }, [purchaseReceipt.isSuccess, purchaseReceipt.data, purchaseHash, mockPaymentConfirmed]);

  const { data: openingData } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "getOpening",
    args: openingId ? [openingId] : undefined,
    query: {
      enabled: Boolean(openingId) && contractFlags.caseSaleConfigured,
      refetchInterval: 6000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: btcUsdDecimals } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "btcUsdDecimals",
    query: { enabled: contractFlags.caseSaleConfigured },
  });

  useEffect(() => {
    if (!openingData || !contractFlags.caseSaleConfigured) return;
    if (!openingData.rewarded) return;
    const rewardCbBtc = Number(formatUnits(openingData.rewardAmount, 8));
    const decimals =
      typeof btcUsdDecimals === "number"
        ? btcUsdDecimals
        : typeof btcUsdDecimals === "bigint"
          ? Number(btcUsdDecimals)
          : 8;
    const priceFromFeed =
      openingData.btcUsdPrice && decimals >= 0
        ? Number(openingData.btcUsdPrice) / 10 ** decimals
        : undefined;
    const cbBtcUsdPrice =
      priceFromFeed || Number(process.env.NEXT_PUBLIC_CBBTC_USD) || 60000;
    setReward({
      openingId: openingId?.toString() ?? "0",
      rewardUsd: rewardCbBtc * cbBtcUsdPrice,
      rewardCbBtc,
      cbBtcUsdPrice,
      randomness: {
        source: "onchain-entropy",
        commitment: "n/a",
        serverSeed: "n/a",
        clientSeed: "n/a",
        revealedImmediately: false,
      },
    });
  }, [openingData, openingId]);

  const alreadyClaimed = Boolean(openingData?.claimed);

  useEffect(() => {
    if (!storageKey) return;
    setFlowLoaded(false);
    setApproveHash(null);
    setPurchaseHash(null);
    setOpeningId(null);
    setMockApproved(false);
    setMockPaymentConfirmed(false);
    setReward(null);
    setIsVideoDone(false);
    setHasRecorded(false);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || flowLoaded) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setFlowLoaded(true);
        return;
      }
      const stored = JSON.parse(raw) as StoredFlow;
      if (stored.approveHash) setApproveHash(stored.approveHash);
      if (stored.purchaseHash) setPurchaseHash(stored.purchaseHash);
      if (stored.openingId) setOpeningId(BigInt(stored.openingId));
      if (stored.mockApproved) setMockApproved(true);
      if (stored.mockPaymentConfirmed) setMockPaymentConfirmed(true);
    } catch (error) {
      console.warn("Failed to restore open flow state", error);
    } finally {
      setFlowLoaded(true);
    }
  }, [storageKey, flowLoaded]);

  useEffect(() => {
    if (!storageKey || !flowLoaded) return;
    const stored: StoredFlow = {
      approveHash: approveHash ?? undefined,
      purchaseHash: purchaseHash ?? undefined,
      openingId: openingId ? openingId.toString() : undefined,
      mockApproved: mockApproved || undefined,
      mockPaymentConfirmed: mockPaymentConfirmed || undefined,
      updatedAt: Date.now(),
    };

    if (
      !stored.approveHash &&
      !stored.purchaseHash &&
      !stored.openingId &&
      !stored.mockApproved &&
      !stored.mockPaymentConfirmed
    ) {
      localStorage.removeItem(storageKey);
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(stored));
  }, [
    storageKey,
    flowLoaded,
    approveHash,
    purchaseHash,
    openingId,
    mockApproved,
    mockPaymentConfirmed,
  ]);

  useEffect(() => {
    if (!storageKey || !flowLoaded) return;
    if (alreadyClaimed) {
      localStorage.removeItem(storageKey);
    }
  }, [alreadyClaimed, storageKey, flowLoaded]);

  useEffect(() => {
    if (reward && isVideoDone && !hasRecorded && purchaseHash && caseType) {
      addOpening({
        id: reward.openingId,
        caseTypeId: caseType.id,
        caseName: caseType.name,
        rewardCbBtc: reward.rewardCbBtc,
        rewardUsd: reward.rewardUsd,
        txHash: purchaseHash,
        timestamp: Date.now(),
      });
      setHasRecorded(true);
    }
  }, [reward, isVideoDone, hasRecorded, purchaseHash, addOpening, caseType]);

  const fetchReward = async (txHash: string) => {
    if (!caseType) return;
    try {
      const response = await fetch("/api/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseTypeId: caseType.id,
          txHash,
          clientSeed: address || "guest",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch reward");
      }
      const data = (await response.json()) as RewardResponse;
      setReward(data);
    } catch (error) {
      console.error(error);
      toast.error("Reward fetch failed. Try again.");
    }
  };

  const handleApprove = async () => {
    if (!address || !caseType) return;
    if (!contractFlags.caseSaleConfigured) {
      setMockApproved(true);
      toast.message("Mock approval recorded.");
      return;
    }
    try {
      setIsBusy(true);
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [caseSaleAddress, priceUnits],
      });
      setApproveHash(hash);
      toast.message("Approval sent.");
    } catch (error) {
      console.error(error);
      toast.error("Approval failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePurchase = async () => {
    if (!address || !caseType) return;
    if (soldOut) {
      toast.error("Sold out. Please check back soon.");
      return;
    }
    if (!effectiveAllowance) {
      toast.error("Approve USDC first.");
      return;
    }

    if (!contractFlags.caseSaleConfigured) {
      const mockHash = (`0x${crypto.getRandomValues(new Uint8Array(32)).reduce(
        (acc, value) => acc + value.toString(16).padStart(2, "0"),
        "",
      )}`) as `0x${string}`;
      setPurchaseHash(mockHash);
      setMockPaymentConfirmed(true);
      toast.message("Mock payment recorded.");
      void fetchReward(mockHash);
      return;
    }

    try {
      setIsBusy(true);
      const hash = await writeContractAsync({
        address: caseSaleAddress,
        abi: caseSaleAbi,
        functionName: "purchaseCase",
        args: [BigInt(caseType.id)],
      });
      setPurchaseHash(hash);
      toast.message("Payment sent.");
    } catch (error) {
      console.error(error);
      toast.error("Payment failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!reward) return;
    if (!contractFlags.caseSaleConfigured) {
      toast.message("Withdraw is a TODO until contracts are deployed.");
      return;
    }

    try {
      setIsBusy(true);
      await writeContractAsync({
        address: caseSaleAddress,
        abi: caseSaleAbi,
        functionName: "claimReward",
        args: [BigInt(reward.openingId)],
      });
      toast.success("Claim submitted.");
    } catch (error) {
      console.error(error);
      toast.error("Withdraw failed.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!caseType) {
    return (
      <div className="container py-10">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Case not found</CardTitle>
            <CardDescription>Return to the store to choose an available case.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className="text-primary">
              Back to Store
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepStates: { label: string; status: StepStatus }[] = [
    { label: steps[0], status: effectiveAllowance ? "done" : "active" },
    {
      label: steps[1],
      status: purchaseHash ? "done" : effectiveAllowance ? "active" : "pending",
    },
    {
      label: steps[2],
      status:
        purchaseReceipt.isSuccess || mockPaymentConfirmed
          ? "done"
          : purchaseHash
            ? "active"
            : "pending",
    },
    {
      label: steps[3],
      status: reward ? (isVideoDone ? "done" : "active") : "pending",
    },
    {
      label: steps[4],
      status: reward && isVideoDone ? "done" : reward ? "active" : "pending",
    },
  ];

  const paymentConfirmed = purchaseReceipt.isSuccess || mockPaymentConfirmed;

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">Case #{caseType.id}</Badge>
          <span>{formatUsd(caseType.priceUSDC)} USDC</span>
          {available !== null && (
            <span>{available.toString()} in stock</span>
          )}
        </div>
        <h1 className="text-3xl font-semibold">Open {caseType.name}</h1>
        <p className="text-muted-foreground">
          Approve USDC, pay, and reveal a random cbBTC reward after the opening video.
        </p>
      </div>

      <NetworkGuard />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Open Flow</CardTitle>
            <CardDescription>Complete each step to reveal your reward.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Stepper steps={stepStates} />

            <div className="flex flex-col gap-3">
              <Button onClick={handleApprove} disabled={!isConnected || effectiveAllowance || isBusy}>
                {approveReceipt.isLoading
                  ? "Approving..."
                  : effectiveAllowance
                    ? "USDC Approved"
                    : "Approve USDC"}
              </Button>
              <Button
                onClick={handlePurchase}
                variant="secondary"
                disabled={!isConnected || !effectiveAllowance || Boolean(purchaseHash) || isBusy || soldOut}
              >
                {purchaseReceipt.isLoading
                  ? "Paying..."
                  : soldOut
                    ? "SOLD OUT"
                    : purchaseHash
                      ? "Payment Sent"
                      : `Pay ${caseType.priceUSDC} USDC`}
              </Button>
            </div>

            {soldOut && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Sold out. This case will restock after cbBTC is funded into the sale contract.
              </div>
            )}

            {paymentConfirmed && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Payment confirmed. Randomness is computed onchain during your purchase.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Opening</CardTitle>
            <CardDescription>Wobbling case during payment, opening video after confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              {!paymentConfirmed ? (
                caseType.media.model ? (
                  <ModelViewer
                    src={caseType.media.model}
                    poster={caseType.media.image}
                    className="h-56 w-full"
                  />
                ) : (
                  <img
                    src={caseType.media.image}
                    alt={`${caseType.name} preview`}
                    className="h-56 w-full object-cover"
                  />
                )
              ) : (
                <video
                  key={reward ? "reward-ready" : "waiting"}
                  className="h-56 w-full object-cover"
                  src={caseType.media.video}
                  muted
                  playsInline
                  controls={paymentConfirmed}
                  autoPlay={paymentConfirmed}
                  onEnded={() => setIsVideoDone(true)}
                />
              )}
            </div>

            {reward && !isVideoDone && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Opening in progress. Your reward is ready below.
              </div>
            )}

            {reward && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/70 p-4">
                <div className="text-sm text-muted-foreground">Reward revealed</div>
                <div className="text-2xl font-semibold">
                  {formatToken(reward.rewardCbBtc, "cbBTC", 8)}
                </div>
                <div className="text-sm text-muted-foreground">
                  ~ {formatUsd(reward.rewardUsd)} @ ${reward.cbBtcUsdPrice.toFixed(2)} / cbBTC
                </div>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span>Randomness: {reward.randomness.source}</span>
                  <span>Commitment: {reward.randomness.commitment}</span>
                  <span>Server seed: {reward.randomness.serverSeed}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={handleWithdraw} disabled={isBusy || alreadyClaimed}>
                    {alreadyClaimed ? "Claimed" : "Claim cbBTC"}
                  </Button>
                  {purchaseHash && contractFlags.caseSaleConfigured && (
                    <Link
                      href={getExplorerTxUrl(purchaseHash)}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      View on BaseScan
                    </Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
