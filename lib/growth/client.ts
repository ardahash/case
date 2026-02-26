"use client";

import type { GrowthActorInput, TrackEventRequest } from "@/lib/growth/types";

const SESSION_KEY = "case-growth-session-id";
const REFERRAL_KEY = "case-growth-referral-v1";

type StoredReferral = {
  referrerFid: number;
  source: string | null;
  campaign: string | null;
  firstSeenAt: number;
  landingPath: string | null;
};

function getWindowSafe() {
  return typeof window !== "undefined" ? window : null;
}

function randomId(prefix: string) {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function getGrowthSessionId() {
  const win = getWindowSafe();
  if (!win) return null;
  const existing = win.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomId("sess");
  win.localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function getStoredReferral(): StoredReferral | null {
  const win = getWindowSafe();
  if (!win) return null;
  try {
    const raw = win.localStorage.getItem(REFERRAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredReferral>;
    if (!parsed || typeof parsed.referrerFid !== "number") return null;
    return {
      referrerFid: parsed.referrerFid,
      source: typeof parsed.source === "string" ? parsed.source : null,
      campaign: typeof parsed.campaign === "string" ? parsed.campaign : null,
      firstSeenAt: typeof parsed.firstSeenAt === "number" ? parsed.firstSeenAt : Date.now(),
      landingPath: typeof parsed.landingPath === "string" ? parsed.landingPath : null,
    };
  } catch {
    return null;
  }
}

export function captureReferralFromCurrentUrl() {
  const win = getWindowSafe();
  if (!win) return null;
  const params = new URLSearchParams(win.location.search);
  const refFidRaw = params.get("ref_fid");
  if (!refFidRaw) return null;
  const referrerFid = Number(refFidRaw);
  if (!Number.isFinite(referrerFid) || referrerFid <= 0) return null;

  const next: StoredReferral = {
    referrerFid: Math.trunc(referrerFid),
    source: params.get("src"),
    campaign: params.get("campaign"),
    firstSeenAt: Date.now(),
    landingPath: `${win.location.pathname}${win.location.search}`,
  };
  win.localStorage.setItem(REFERRAL_KEY, JSON.stringify(next));
  return next;
}

export function clearStoredReferral() {
  const win = getWindowSafe();
  if (!win) return;
  win.localStorage.removeItem(REFERRAL_KEY);
}

type ActorBuildInput = {
  fid?: number | null;
  address?: string | null;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  source?: string | null;
};

export function buildGrowthActor(input: ActorBuildInput): GrowthActorInput {
  return {
    fid: typeof input.fid === "number" ? input.fid : null,
    address: input.address ?? null,
    sessionId: getGrowthSessionId(),
    username: input.username ?? null,
    displayName: input.displayName ?? null,
    pfpUrl: input.pfpUrl ?? null,
    source: input.source ?? null,
  };
}

export async function postTrackEvent(
  payload: Omit<TrackEventRequest, "eventId"> & { eventId?: string },
) {
  try {
    const body: TrackEventRequest = {
      ...payload,
      eventId: payload.eventId ?? randomId("evt"),
    };
    const response = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as {
      ok: boolean;
      duplicate?: boolean;
      userId?: string | null;
      points?: number | null;
      streak?: number | null;
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function fetchGrowthMe(actor: GrowthActorInput) {
  try {
    const response = await fetch("/api/growth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor }),
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch (error) {
    console.error(error);
    return null;
  }
}

