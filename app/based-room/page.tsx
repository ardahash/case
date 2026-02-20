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
    <div className="relative min-h-screen w-full overflow-hidden">
      <img
        src="/basedroom2.png"
        alt="Based Room background"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />

      <div className="relative z-10 hidden h-full w-full md:block">
        <svg
          className="h-screen w-screen"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
        >
          <foreignObject x="60" y="60" width="520" height="160">
            <div className="text-white">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {isEligible ? "Unlocked" : "Locked"}
                </span>
                <span>Passive bitcoin rewards</span>
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Based Room</h1>
              <p className="mt-2 text-white/70">
                Stake 10,000 CASE to unlock 2 sats per day. xCASE staked also counts.
              </p>
            </div>
          </foreignObject>

          <foreignObject x="60" y="240" width="420" height="460">
            <div style={{ pointerEvents: "auto" }}>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Based Room Access</CardTitle>
                  <CardDescription>Hit the threshold to unlock passive rewards.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
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
            </div>
          </foreignObject>

          <foreignObject x="520" y="200" width="420" height="520">
            <div style={{ pointerEvents: "auto" }}>
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
                      playsInline
                      autoPlay
                      loop={videoMode === "loop"}
                      muted={videoMode === "intro"}
                      controls={videoMode === "loop"}
                      onEnded={() => setVideoMode("loop")}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </foreignObject>
        </svg>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col gap-6 px-4 py-10 md:hidden">
        <div className="flex flex-col gap-2 text-white">
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Badge variant="secondary">{isEligible ? "Unlocked" : "Locked"}</Badge>
            <span>Passive bitcoin rewards</span>
          </div>
          <h1 className="text-3xl font-semibold">Based Room</h1>
          <p className="text-white/70">
            Stake 10,000 CASE to unlock 2 sats per day. xCASE staked also counts.
          </p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Based Room Access</CardTitle>
            <CardDescription>Hit the threshold to unlock passive rewards.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
              <Button onClick={handleClaim} disabled={!isConnected || !isEligible || isClaiming}>
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
                playsInline
                autoPlay
                loop={videoMode === "loop"}
                muted={videoMode === "intro"}
                controls={videoMode === "loop"}
                onEnded={() => setVideoMode("loop")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
