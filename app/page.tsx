"use client";

import Link from "next/link";
import { caseTypes } from "@/config/caseTypes";
import { economicsConfig } from "@/config/economics";
import { formatUsd } from "@/lib/format";
import { CaseCard } from "@/components/case/CaseCard";
import { NetworkGuard } from "@/components/shared/NetworkGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { chainLabel, isTestnet } from "@/lib/chains";
import { useCaseAvailability } from "@/hooks/useCaseAvailability";

export default function Home() {
  const primaryCase = caseTypes[0];
  const { available, soldOut, isLoading } = useCaseAvailability(primaryCase);
  const heroLabel = soldOut ? "SOLD OUT" : "Buy & Open";
  const heroHref = soldOut ? "#" : `/open/${primaryCase.id}`;
  const heroDisabled = soldOut;
  const heroInventory =
    available !== null ? `${available.toString()} cases in stock` : isLoading ? "Checking inventory..." : null;

  return (
    <div className="container flex flex-col gap-12 py-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <Badge className="w-fit" variant="secondary">
            {isTestnet ? `${chainLabel} Preview` : `${chainLabel} Ready`}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Open cases, get Bitcoin!
          </h1>
          <p className="text-lg text-muted-foreground">
            Buy a case using USDC, watch the case open,
            reveal a random cbBTC reward, and track your history across Base and Farcaster.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={heroHref}
              className={buttonVariants({
                className: heroDisabled ? "pointer-events-none opacity-60" : "",
              })}
              aria-disabled={heroDisabled}
            >
              {heroLabel}
            </Link>
            <Link href="/provably-fair" className={buttonVariants({ variant: "outline" })}>
              Provably Fair
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            Transparent fee model. No hidden house edge. Currently:
            {heroInventory ? ` ${heroInventory}.` : ""}
          </div>
        </div>
      </section>

      <NetworkGuard />

      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Case Store</h2>
          <Link href="/rewards" className="text-sm text-primary">
            View rewards
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {caseTypes.map((caseType) => (
            <CaseCard key={caseType.id} caseType={caseType} />
          ))}
        </div>
        <Card className="glass">
          <CardHeader>
            <CardTitle>Case-onomics</CardTitle>
            <CardDescription>Configured RTP and platform fee.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Case price</span>
              <span className="font-medium">{formatUsd(economicsConfig.priceUSDC)} USDC</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Reward range</span>
              <span className="font-medium">
                {formatUsd(economicsConfig.minRewardUSD)} - {formatUsd(economicsConfig.maxRewardUSD)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Platform fee</span>
              <span className="font-medium">{economicsConfig.platformFeeBps / 100}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Target RTP</span>
              <span className="font-medium">{economicsConfig.targetRTP * 100}%</span>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              You can also earn rewards by staking xCASE and earning from platform fees.{" "}
              <Link href="/stake" className="font-medium text-primary">
                Learn more about staking.
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
