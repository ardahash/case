"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useMiniApp } from "@/app/providers/MiniAppProvider";
import {
  buildGrowthActor,
  captureReferralFromCurrentUrl,
  getStoredReferral,
  postTrackEvent,
} from "@/lib/growth/client";

export function GrowthTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const { farcasterUser, quickAuthUser, isMiniApp } = useMiniApp();

  const trackedViewKeyRef = useRef<string | null>(null);
  const trackedReferralKeyRef = useRef<string | null>(null);
  const syncedProfileRef = useRef<string | null>(null);
  const walletConnectedRef = useRef<string | null>(null);

  const actor = useMemo(() => {
    const sourceFromQuery = searchParams.get("src");
    const storedReferral = getStoredReferral();
    return buildGrowthActor({
      fid: quickAuthUser?.fid ?? farcasterUser?.fid ?? null,
      address: address ?? null,
      username: farcasterUser?.username ?? null,
      displayName: farcasterUser?.displayName ?? null,
      pfpUrl: farcasterUser?.pfpUrl ?? null,
      source:
        (isMiniApp ? "farcaster-miniapp" : null) ??
        sourceFromQuery ??
        storedReferral?.source ??
        "web",
    });
  }, [
    address,
    farcasterUser?.displayName,
    farcasterUser?.fid,
    farcasterUser?.pfpUrl,
    farcasterUser?.username,
    isMiniApp,
    quickAuthUser?.fid,
    searchParams,
  ]);

  useEffect(() => {
    const referral = captureReferralFromCurrentUrl();
    if (referral) {
      const referralKey = `${referral.referrerFid}:${pathname}:${searchParams.toString()}`;
      if (trackedReferralKeyRef.current === referralKey) return;
      trackedReferralKeyRef.current = referralKey;
      void postTrackEvent({
        type: "referral_landing",
        actor,
        referrerFid: referral.referrerFid,
        metadata: {
          route: pathname,
          source: referral.source ?? "unknown",
          hasCampaign: Boolean(referral.campaign),
        },
      });
    }
  }, [actor, pathname, searchParams]);

  useEffect(() => {
    const search = searchParams.toString();
    const viewKey = `${pathname}?${search}`;
    if (trackedViewKeyRef.current === viewKey) return;
    trackedViewKeyRef.current = viewKey;

    void postTrackEvent({
      type: "screen_view",
      actor,
      metadata: {
        route: pathname,
        hasQuery: search.length > 0,
      },
    });

    const launchKey = `case-growth-launch:${new Date().toISOString().slice(0, 10)}`;
    if (typeof window !== "undefined" && !window.sessionStorage.getItem(launchKey)) {
      window.sessionStorage.setItem(launchKey, "1");
      void postTrackEvent({
        type: "app_launch",
        actor,
        metadata: {
          route: pathname,
          inMiniApp: isMiniApp,
        },
      });
    }
  }, [actor, isMiniApp, pathname, searchParams]);

  useEffect(() => {
    const profileKey = [
      actor.fid ?? "",
      actor.username ?? "",
      actor.displayName ?? "",
      actor.pfpUrl ?? "",
      actor.address ?? "",
    ].join("|");
    if (syncedProfileRef.current === profileKey) return;
    syncedProfileRef.current = profileKey;

    if (!actor.fid && !actor.address) return;
    void postTrackEvent({
      type: "profile_sync",
      actor,
      metadata: {
        hasFid: Boolean(actor.fid),
        hasAddress: Boolean(actor.address),
      },
    });
  }, [actor]);

  useEffect(() => {
    if (!address) return;
    const normalized = address.toLowerCase();
    if (walletConnectedRef.current === normalized) return;
    walletConnectedRef.current = normalized;
    void postTrackEvent({
      type: "wallet_connected",
      actor,
      metadata: {
        route: pathname,
      },
    });
  }, [actor, address, pathname]);

  return null;
}
