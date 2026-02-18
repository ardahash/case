"use client";

import Image from "next/image";
import Link from "next/link";
import { CaseType } from "@/config/caseTypes";
import { formatUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useCaseAvailability } from "@/hooks/useCaseAvailability";
import { ModelViewer } from "@/components/shared/ModelViewer";

interface CaseCardProps {
  caseType: CaseType;
}

export function CaseCard({ caseType }: CaseCardProps) {
  const { available, soldOut, isLoading, isLive } = useCaseAvailability(caseType);
  const isConfiguredLive = caseType.enabled && caseType.availability === "live";
  const showOverlay = !isLive && !isLoading;
  const overlayText = isConfiguredLive ? "sold out" : caseType.availability.replace("-", " ");
  const availabilityLabel =
    available !== null ? `${available.toString()} in stock` : isLoading && isConfiguredLive ? "checking inventory" : caseType.availability;
  const ctaLabel = soldOut ? "SOLD OUT" : isConfiguredLive ? "Buy & Open" : caseType.availability.replace("-", " ").toUpperCase();

  return (
    <div className="glass flex h-full flex-col gap-4 rounded-3xl p-6">
      <div className="relative h-48 overflow-hidden rounded-2xl border border-border bg-muted">
        {caseType.media.model ? (
          <ModelViewer
            src={caseType.media.model}
            poster={caseType.media.image}
            className="h-full w-full"
          />
        ) : caseType.media.image.endsWith(".gif") ? (
          <img
            src={caseType.media.image}
            alt={`${caseType.name} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src={caseType.media.image}
            alt={`${caseType.name} preview`}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover animate-float"
          />
        )}
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">
            {overlayText}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {caseType.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Reward range {formatUsd(caseType.minRewardUSD)} - {formatUsd(caseType.maxRewardUSD)}
          </p>
        </div>
        <Badge variant="secondary">{formatUsd(caseType.priceUSDC)}</Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Odds: {caseType.oddsConfig.type}</span>
        <span>{availabilityLabel}</span>
      </div>

      <Link
        href={isLive ? `/open/${caseType.id}` : "#"}
        className={buttonVariants({
          size: "lg",
          className: !isLive ? "pointer-events-none opacity-50" : "",
        })}
        aria-disabled={!isLive}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

