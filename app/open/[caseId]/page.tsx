"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAccount, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, parseAbiItem, parseEventLogs, parseUnits } from "viem";
import { toast } from "sonner";
import sdk from "@farcaster/miniapp-sdk";
import { caseSaleAbi } from "@/lib/abis/caseSale";
import { erc20Abi } from "@/lib/abis/erc20";
import { CASE_DECIMALS, CBBTC_DECIMALS, contractAddresses, contractFlags, USDC_DECIMALS } from "@/lib/contracts";
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
import { activeChain } from "@/lib/chains";
import { useMiniApp } from "@/app/providers/MiniAppProvider";
import { buildGrowthActor, getStoredReferral, postTrackEvent } from "@/lib/growth/client";

type RewardResponse = {
  openingId: string;
  rewardAmount: number;
  rewardSymbol: string;
  rewardDecimals: number;
  rewardUsd: number | null;
  cbBtcUsdPrice?: number;
  randomness: {
    source: string;
    commitment: string;
    serverSeed: string;
    clientSeed: string;
    revealedImmediately: boolean;
  };
};

type StoredFlow = {
  version?: number;
  mode?: "live" | "mock";
  approveHash?: `0x${string}`;
  purchaseHash?: `0x${string}`;
  openingId?: string;
  mockApproved?: boolean;
  mockPaymentConfirmed?: boolean;
  updatedAt?: number;
};

const FLOW_STORAGE_VERSION = 2;
const FLOW_STALE_MS = 30 * 60 * 1000;

export default function OpenCasePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const caseType = getCaseType(params.caseId as string);
  const { address, isConnected } = useAccount();
  const { farcasterUser, quickAuthUser, isMiniApp } = useMiniApp();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const { writeContractAsync } = useWriteContract();
  const addOpening = useOpeningsStore((state) => state.addOpening);
  const { available, soldOut } = useCaseAvailability(caseType ?? undefined);

  const usdcAddress = contractAddresses.usdc as `0x${string}`;
  const isFreeCase = caseType?.priceUSDC === 0;
  const caseSaleAddress = (isFreeCase
    ? contractAddresses.dailyCaseSale
    : contractAddresses.caseSale) as `0x${string}`;
  const caseTokenAddress = contractAddresses.caseToken as `0x${string}`;

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
  const [isSharing, setIsSharing] = useState(false);
  const [hasTrackedGrowthCompletion, setHasTrackedGrowthCompletion] = useState(false);
  const isLiveConfigured = isFreeCase
    ? contractFlags.dailyCaseSaleConfigured
    : contractFlags.caseSaleConfigured;
  const flowMode = isLiveConfigured ? "live" : "mock";

  const storageKey = useMemo(() => {
    if (!caseType) return null;
    if (isLiveConfigured && !address) return null;
    const owner = (address ?? "guest").toLowerCase();
    return `case-open-flow:v${FLOW_STORAGE_VERSION}:${flowMode}:${caseType.id}:${owner}`;
  }, [caseType, address, flowMode, isLiveConfigured]);

  const growthActor = useMemo(
    () =>
      buildGrowthActor({
        fid: quickAuthUser?.fid ?? farcasterUser?.fid ?? null,
        address: address ?? null,
        username: farcasterUser?.username ?? null,
        displayName: farcasterUser?.displayName ?? null,
        pfpUrl: farcasterUser?.pfpUrl ?? null,
        source:
          (isMiniApp ? "farcaster-miniapp" : null) ??
          searchParams.get("src") ??
          getStoredReferral()?.source ??
          "web",
      }),
    [
      address,
      farcasterUser?.displayName,
      farcasterUser?.fid,
      farcasterUser?.pfpUrl,
      farcasterUser?.username,
      isMiniApp,
      quickAuthUser?.fid,
      searchParams,
    ],
  );

  const steps = useMemo(() => {
    if (isFreeCase) {
      return ["Open free case", "Confirmation", "Opening video", "Reward reveal"];
    }
    return [
      "Approve USDC",
      `Pay ${caseType?.priceUSDC ?? 0} USDC`,
      "Confirmation",
      "Opening video",
      "Reward reveal",
    ];
  }, [caseType?.priceUSDC, isFreeCase]);

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
      enabled: Boolean(address) && isLiveConfigured && !isFreeCase,
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  });

  const approveReceipt = useWaitForTransactionReceipt({
    hash: approveHash ?? undefined,
    query: { enabled: Boolean(approveHash), refetchInterval: 4000, refetchOnWindowFocus: true },
  });

  const hasAllowance = isFreeCase ? true : allowance ? allowance >= priceUnits : false;
  const effectiveAllowance = !isLiveConfigured
    ? mockApproved || Boolean(purchaseHash)
    : hasAllowance || approveReceipt.isSuccess || Boolean(purchaseHash);

  const purchaseReceipt = useWaitForTransactionReceipt({
    hash: purchaseHash ?? undefined,
    query: {
      enabled: Boolean(purchaseHash) && isLiveConfigured,
      refetchInterval: 4000,
      refetchOnWindowFocus: true,
    },
  });

  const purchaseEvent = useMemo(
    () =>
      parseAbiItem(
        "event CasePurchased(address indexed buyer, uint256 indexed caseTypeId, uint256 indexed openingId, uint256 priceUSDC)",
      ),
    [],
  );

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      refetchAllowance();
      toast.success("USDC approved.");
    }
  }, [approveReceipt.isSuccess, refetchAllowance]);

  useEffect(() => {
    if (!isLiveConfigured && mockPaymentConfirmed && purchaseHash) {
      toast.success("Payment confirmed. Opening case...");
      void fetchReward(purchaseHash);
      return;
    }

    if (purchaseReceipt.isSuccess && purchaseReceipt.data && isLiveConfigured) {
      const logs = parseEventLogs({
        abi: caseSaleAbi,
        logs: purchaseReceipt.data.logs,
        eventName: "CasePurchased",
      });
      const matched = logs[0]?.args?.openingId;
      if (matched !== undefined) {
        setOpeningId(matched as bigint);
        toast.success("Payment confirmed. Awaiting randomness...");
        return;
      }

      const blockNumber = purchaseReceipt.data.blockNumber;
      if (publicClient && blockNumber && address) {
        publicClient
          .getLogs({
            address: caseSaleAddress,
            event: purchaseEvent,
            args: { buyer: address as `0x${string}` },
            fromBlock: blockNumber,
            toBlock: blockNumber,
          })
          .then((chainLogs) => {
            const hit =
              chainLogs.find((log) => log.transactionHash === purchaseHash) ??
              chainLogs[0];
            const opening = hit?.args?.openingId;
            if (opening !== undefined) {
              setOpeningId(opening as bigint);
              toast.success("Payment confirmed. Awaiting randomness...");
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }
    }
  }, [
    purchaseReceipt.isSuccess,
    purchaseReceipt.data,
    purchaseHash,
    mockPaymentConfirmed,
    isLiveConfigured,
    publicClient,
    caseSaleAddress,
    address,
    purchaseEvent,
  ]);

  useEffect(() => {
    if (purchaseReceipt.isError) {
      toast.error("Transaction failed or was rejected.");
      setPurchaseHash(null);
      setIsBusy(false);
    }
  }, [purchaseReceipt.isError]);

  const { data: openingData } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "getOpening",
    args: openingId ? [openingId] : undefined,
    query: {
      enabled: Boolean(openingId) && isLiveConfigured,
      refetchInterval: 6000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: btcUsdDecimals } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "btcUsdDecimals",
    query: { enabled: isLiveConfigured },
  });

  const { data: dailyCaseTypeId } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "dailyCaseTypeId",
    query: { enabled: isLiveConfigured && isFreeCase },
  });

  const { data: dailyCooldown } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "dailyCooldown",
    query: { enabled: isLiveConfigured && isFreeCase },
  });

  const { data: lastDailyOpen } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "lastDailyOpen",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && isLiveConfigured && isFreeCase },
  });

  const isDailyCase =
    isFreeCase &&
    typeof dailyCaseTypeId !== "undefined" &&
    Number(dailyCaseTypeId) === caseType?.id;
  const cooldownSeconds =
    typeof dailyCooldown === "bigint" ? Number(dailyCooldown) : 24 * 60 * 60;
  const lastOpenSeconds =
    typeof lastDailyOpen === "bigint" ? Number(lastDailyOpen) : 0;
  const nextDailyAvailable =
    isDailyCase && lastOpenSeconds > 0
      ? new Date((lastOpenSeconds + cooldownSeconds) * 1000)
      : null;
  const isDailyCooldown =
    isDailyCase &&
    lastOpenSeconds > 0 &&
    Date.now() / 1000 < lastOpenSeconds + cooldownSeconds;

  useEffect(() => {
    if (!openingData || !isLiveConfigured) return;
    if (!openingData.rewarded) return;
    const isCaseReward =
      typeof openingData.rewardToken === "string" &&
      openingData.rewardToken.toLowerCase() === caseTokenAddress.toLowerCase();
    const tokenDecimals = isCaseReward ? CASE_DECIMALS : CBBTC_DECIMALS;
    const displayDecimals = isCaseReward ? 4 : 8;
    const rewardAmount = Number(formatUnits(openingData.rewardAmount, tokenDecimals));
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
      rewardAmount,
      rewardSymbol: isCaseReward ? "CASE" : "cbBTC",
      rewardDecimals: displayDecimals,
      rewardUsd: isCaseReward ? null : rewardAmount * cbBtcUsdPrice,
      cbBtcUsdPrice: isCaseReward ? undefined : cbBtcUsdPrice,
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
    setHasTrackedGrowthCompletion(false);
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

      const isStale =
        typeof stored.updatedAt === "number" &&
        Date.now() - stored.updatedAt > FLOW_STALE_MS;
      if (
        stored.version !== FLOW_STORAGE_VERSION ||
        stored.mode !== flowMode ||
        isStale
      ) {
        localStorage.removeItem(storageKey);
        setFlowLoaded(true);
        return;
      }

      if (stored.approveHash) setApproveHash(stored.approveHash);
      if (stored.purchaseHash) setPurchaseHash(stored.purchaseHash);
      if (stored.openingId) setOpeningId(BigInt(stored.openingId));
      if (!isLiveConfigured && stored.mockApproved) setMockApproved(true);
      if (!isLiveConfigured && stored.mockPaymentConfirmed) setMockPaymentConfirmed(true);
    } catch (error) {
      console.warn("Failed to restore open flow state", error);
    } finally {
      setFlowLoaded(true);
    }
  }, [storageKey, flowLoaded, flowMode, isLiveConfigured]);

  useEffect(() => {
    if (!storageKey || !flowLoaded) return;
    const stored: StoredFlow = {
      version: FLOW_STORAGE_VERSION,
      mode: flowMode,
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
    flowMode,
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
        rewardAmount: reward.rewardAmount,
        rewardSymbol: reward.rewardSymbol,
        rewardDecimals: reward.rewardDecimals,
        rewardUsd: reward.rewardUsd,
        txHash: purchaseHash,
        timestamp: Date.now(),
      });
      setHasRecorded(true);
    }
  }, [reward, isVideoDone, hasRecorded, purchaseHash, addOpening, caseType]);

  useEffect(() => {
    if (
      !reward ||
      !isVideoDone ||
      hasTrackedGrowthCompletion ||
      !purchaseHash ||
      !caseType
    ) {
      return;
    }

    const referral = getStoredReferral();
    void postTrackEvent({
      type: "opening_completed",
      actor: growthActor,
      referrerFid: referral?.referrerFid ?? null,
      metadata: {
        caseId: caseType.id,
        isFreeCase,
        route: `/open/${caseType.id}`,
      },
      opening: {
        openingId: reward.openingId,
        txHash: purchaseHash,
        caseTypeId: caseType.id,
        caseName: caseType.name,
        isFreeCase,
        casePriceUSDC: caseType.priceUSDC,
        rewardSymbol: reward.rewardSymbol,
        rewardAmount: reward.rewardAmount,
        rewardUsd: reward.rewardUsd,
      },
    }).then((result) => {
      if (result?.points && !result.duplicate) {
        toast.success(`Points updated: ${result.points.toLocaleString()} total`);
      }
    });
    setHasTrackedGrowthCompletion(true);
  }, [
    reward,
    isVideoDone,
    hasTrackedGrowthCompletion,
    purchaseHash,
    caseType,
    growthActor,
    isFreeCase,
  ]);

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
    if (isFreeCase) {
      toast.message("No approval needed for free cases.");
      return;
    }
    if (!isLiveConfigured) {
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
    if (isDailyCooldown) {
      toast.error("Daily case already opened. Try again tomorrow.");
      return;
    }
    if (soldOut) {
      toast.error("Sold out. Please check back soon.");
      return;
    }
    if (!effectiveAllowance && !isFreeCase) {
      toast.error("Approve USDC first.");
      return;
    }

    const referral = getStoredReferral();
    void postTrackEvent({
      type: "open_start",
      actor: growthActor,
      referrerFid: referral?.referrerFid ?? null,
      metadata: {
        caseId: caseType.id,
        isFreeCase,
        priceUSDC: caseType.priceUSDC,
        source: searchParams.get("src") ?? (isMiniApp ? "farcaster-miniapp" : "web"),
      },
    });

    if (!isLiveConfigured) {
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
    if (!isLiveConfigured) {
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

  const buildShareUrl = (campaign: string) => {
    const base =
      typeof window !== "undefined"
        ? new URL(`/open/${caseType?.id ?? ""}`, window.location.origin)
        : new URL(
            `/open/${caseType?.id ?? ""}`,
            process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
          );
    base.searchParams.set("src", "farcaster");
    base.searchParams.set("campaign", campaign);
    if (growthActor.fid) {
      base.searchParams.set("ref_fid", String(growthActor.fid));
    }
    return base.toString();
  };

  const shareMessage = async ({
    title,
    text,
    url,
    shareType,
  }: {
    title: string;
    text: string;
    url: string;
    shareType: "reward" | "challenge";
  }) => {
    await postTrackEvent({
      type: "share_intent",
      actor: growthActor,
      metadata: {
        caseId: caseType?.id ?? -1,
        isFreeCase,
        shareType,
      },
    });

    try {
      setIsSharing(true);
      const inMiniApp = await sdk.isInMiniApp();
      if (inMiniApp) {
        await sdk.actions.composeCast({
          text,
          embeds: url ? [url] : undefined,
        });
        void postTrackEvent({
          type: "share_composer_opened",
          actor: growthActor,
          metadata: { caseId: caseType?.id ?? -1, isFreeCase, shareType },
        });
        toast.success("Share composer opened.");
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSharing(false);
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: url || undefined,
        });
        void postTrackEvent({
          type: "share_native_opened",
          actor: growthActor,
          metadata: { caseId: caseType?.id ?? -1, isFreeCase, shareType },
        });
        return;
      } catch (error) {
        console.error(error);
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`.trim());
        void postTrackEvent({
          type: "share_copied",
          actor: growthActor,
          metadata: { caseId: caseType?.id ?? -1, isFreeCase, shareType },
        });
        toast.success("Share text copied.");
        return;
      } catch (error) {
        console.error(error);
      }
    }

    toast.error("Share is not available on this device.");
  };

  const handleShareChallenge = async () => {
    if (!caseType) return;
    const shareUrl = buildShareUrl(isFreeCase ? "daily-mini-share" : "case-challenge");
    const shareText = isFreeCase
      ? `I'm opening my free Daily Mini on Case. Try yours and start stacking points for the CASE airdrop.`
      : `I'm opening ${caseType.name} on Case. Try your luck and start stacking points for the CASE airdrop.`;

    await shareMessage({
      title: "Case Challenge",
      text: shareText,
      url: shareUrl,
      shareType: "challenge",
    });
  };

  const handleShareReward = async () => {
    if (!reward || !caseType) return;
    const shareUrl = buildShareUrl(isFreeCase ? "daily-mini-reward" : "reward-share");
    const rewardLabel = formatToken(reward.rewardAmount, reward.rewardSymbol, reward.rewardDecimals);
    const usdLabel = reward.rewardUsd !== null ? ` (~${formatUsd(reward.rewardUsd)})` : "";
    const shareText = `I opened ${caseType.name} and got ${rewardLabel}${usdLabel}. Start with the free daily mini and stack CASE airdrop points.`;

    await shareMessage({
      title: "Case Reward",
      text: shareText,
      url: shareUrl,
      shareType: "reward",
    });
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

  const paymentConfirmed = isLiveConfigured
    ? Boolean(openingId)
    : mockPaymentConfirmed;

  const stepStates: { label: string; status: StepStatus }[] = isFreeCase
    ? [
        { label: steps[0], status: purchaseHash ? "done" : "active" },
        {
          label: steps[1],
          status:
            paymentConfirmed
              ? "done"
              : purchaseHash
                ? "active"
                : "pending",
        },
        {
          label: steps[2],
          status: reward ? (isVideoDone ? "done" : "active") : "pending",
        },
        {
          label: steps[3],
          status: reward && isVideoDone ? "done" : reward ? "active" : "pending",
        },
      ]
    : [
        { label: steps[0], status: effectiveAllowance ? "done" : "active" },
        {
          label: steps[1],
          status: purchaseHash ? "done" : effectiveAllowance ? "active" : "pending",
        },
        {
          label: steps[2],
          status:
            paymentConfirmed
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

  return (
    <div className="relative min-h-screen overflow-hidden">
      <img
        src="/basedroom2.png"
        alt="Based Room background"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
      <div className="relative z-10 container flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">Case #{caseType.id}</Badge>
          <span>{isFreeCase ? "Free daily" : `${formatUsd(caseType.priceUSDC)} USDC`}</span>
          {available !== null && (
            <span>{available.toString()} in stock</span>
          )}
        </div>
        <h1 className="text-3xl font-semibold">Open {caseType.name}</h1>
        <p className="text-muted-foreground">
          {isFreeCase
            ? "Open once per day for a small CASE or cbBTC reward."
            : "Approve USDC, pay, and reveal a random cbBTC reward after the opening video."}
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
              {!isFreeCase && (
                <Button onClick={handleApprove} disabled={!isConnected || effectiveAllowance || isBusy}>
                  {approveReceipt.isLoading
                    ? "Approving..."
                    : effectiveAllowance
                      ? "USDC Approved"
                      : "Approve USDC"}
                </Button>
              )}
              <Button
                onClick={handlePurchase}
                variant="secondary"
                disabled={
                  !isConnected ||
                  (!effectiveAllowance && !isFreeCase) ||
                  Boolean(purchaseHash) ||
                  isBusy ||
                  soldOut ||
                  isDailyCooldown
                }
              >
                {purchaseReceipt.isLoading
                  ? "Opening..."
                  : soldOut
                    ? "SOLD OUT"
                    : isDailyCooldown
                      ? "Come back tomorrow"
                      : purchaseHash
                        ? "Payment Sent"
                        : isFreeCase
                          ? "Open Free Case"
                          : `Pay ${caseType.priceUSDC} USDC`}
              </Button>
              <Button onClick={handleShareChallenge} variant="outline" disabled={isSharing || !caseType}>
                {isSharing ? "Opening Share..." : isFreeCase ? "Share Daily Challenge" : "Challenge a Friend"}
              </Button>
            </div>

            {isDailyCooldown && nextDailyAvailable && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Next free open available {nextDailyAvailable.toLocaleString()}.
              </div>
            )}

            {soldOut && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Sold out. This case will restock after rewards are funded into the sale contract.
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
            <CardDescription>Open now! Limited supply!</CardDescription>
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
                  {formatToken(reward.rewardAmount, reward.rewardSymbol, reward.rewardDecimals)}
                </div>
                {reward.rewardUsd !== null && reward.cbBtcUsdPrice !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    ~ {formatUsd(reward.rewardUsd)} @ ${reward.cbBtcUsdPrice.toFixed(2)} / cbBTC
                  </div>
                )}
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span>Randomness: {reward.randomness.source}</span>
                  <span>Commitment: {reward.randomness.commitment}</span>
                  <span>Server seed: {reward.randomness.serverSeed}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={handleWithdraw} disabled={isBusy || alreadyClaimed}>
                    {alreadyClaimed ? "Claimed" : `Claim ${reward.rewardSymbol}`}
                  </Button>
                  <Button onClick={handleShareReward} variant="outline" disabled={isSharing}>
                    {isSharing ? "Opening Share..." : "Share Reward"}
                  </Button>
                  {purchaseHash && isLiveConfigured && (
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
    </div>
  );
}
