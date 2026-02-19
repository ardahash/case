"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { erc20Abi } from "@/lib/abis/erc20";
import { xCaseStakingAbi } from "@/lib/abis/xCaseStaking";
import { basedRoomRewardsAbi } from "@/lib/abis/basedRoomRewards";
import { contractAddresses, contractFlags, CASE_DECIMALS } from "@/lib/contracts";

const REQUIRED_STAKE = parseUnits("10000", CASE_DECIMALS);

export default function BasedRoomPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isClaiming, setIsClaiming] = useState(false);
  const [videoMode, setVideoMode] = useState<"intro" | "loop">("intro");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const xCaseTokenAddress = contractAddresses.xCaseToken as `0x${string}`;
  const xCaseStakingAddress = contractAddresses.xCaseStaking as `0x${string}`;
  const basedRoomRewardsAddress = contractAddresses.basedRoomRewards as `0x${string}`;

  const { data: xCaseBalance } = useReadContract({
    address: xCaseTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: xCaseStaked } = useReadContract({
    address: xCaseStakingAddress,
    abi: xCaseStakingAbi,
    functionName: "stakedBalance",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const totalStaked = useMemo(() => {
    return (xCaseBalance ?? 0n) + (xCaseStaked ?? 0n);
  }, [xCaseBalance, xCaseStaked]);

  const totalLabel = useMemo(() => {
    if (!address) return "0";
    return Number(formatUnits(totalStaked, CASE_DECIMALS)).toFixed(4);
  }, [address, totalStaked]);

  const xCaseWalletLabel = useMemo(() => {
    if (!xCaseBalance) return "0";
    return Number(formatUnits(xCaseBalance, CASE_DECIMALS)).toFixed(4);
  }, [xCaseBalance]);

  const xCaseStakedLabel = useMemo(() => {
    if (!xCaseStaked) return "0";
    return Number(formatUnits(xCaseStaked, CASE_DECIMALS)).toFixed(4);
  }, [xCaseStaked]);

  const isEligible = totalStaked >= REQUIRED_STAKE;

  const handleClaim = async () => {
    if (!address) {
      toast.error("Connect your wallet to claim.");
      return;
    }
    if (!isEligible) {
      toast.error("Stake 10,000 CASE to unlock rewards.");
      return;
    }
    if (contractFlags.usingMockAddresses) {
      toast.message("Claim simulated. Wire Based Room rewards onchain.");
      return;
    }

    try {
      setIsClaiming(true);
      await writeContractAsync({
        address: basedRoomRewardsAddress,
        abi: basedRoomRewardsAbi,
        functionName: "claim",
      });
      toast.success("Based Room rewards claimed.");
    } catch (error) {
      console.error(error);
      toast.error("Claim failed.");
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    if (videoMode !== "loop") return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined);
    }
  }, [videoMode]);

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">{isEligible ? "Unlocked" : "Locked"}</Badge>
          <span>Passive bitcoin rewards</span>
        </div>
        <h1 className="text-3xl font-semibold">Based Room</h1>
        <p className="text-muted-foreground">
          Stake 10,000 CASE to unlock 2 sats per day. xCASE staked also counts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Based Room Preview</CardTitle>
            <CardDescription>Step inside once you hit the staking threshold.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              <img
                src="/basedroom2.png"
                alt="Based Room preview"
                className="h-64 w-full object-cover"
              />
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Staked (CASE + xCASE)</span>
                <span className="font-mono text-muted-foreground">{totalLabel} CASE</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Includes {xCaseWalletLabel} xCASE in wallet and {xCaseStakedLabel} xCASE staked.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/stake" className={buttonVariants({ variant: "outline" })}>
                Go to Staking
              </Link>
              <Button
                onClick={handleClaim}
                disabled={!isConnected || !isEligible || isClaiming}
              >
                {isClaiming ? "Claiming..." : "Claim 2 sats"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Based Room Feed</CardTitle>
            <CardDescription>
              Stake 10,000 CASE to unlock passive bitcoin rewards.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Stake 10,000 CASE to unlock 2 sats per day and claim them whenever you want.
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              <video
                key={videoMode}
                ref={videoRef}
                className="h-72 w-full object-cover"
                src={videoMode === "intro" ? "/basedroomvid.mp4" : "/basedroomvid2.mp4"}
                muted
                playsInline
                autoPlay
                loop={videoMode === "loop"}
                onEnded={() => setVideoMode("loop")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
