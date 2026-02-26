import { NextRequest, NextResponse } from "next/server";
import { recordTrackEvent, recordWebhook } from "@/lib/growth/store";

export const runtime = "nodejs";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function findFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function findFirstNumber(values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function extractCastInfo(payload: unknown) {
  const root = asObject(payload);
  if (!root) return null;

  const data = asObject(root.data);
  const cast = asObject(root.cast) ?? asObject(data?.cast) ?? data;
  const author =
    asObject(root.author) ?? asObject(cast?.author) ?? asObject(data?.author) ?? null;

  const fid = findFirstNumber([
    author?.fid,
    root.fid,
    data?.fid,
  ]);

  const hash = findFirstString([
    cast?.hash,
    root.hash,
    data?.hash,
  ]);

  const text = findFirstString([
    cast?.text,
    root.text,
    data?.text,
  ]);

  const username = findFirstString([
    author?.username,
    (asObject(author?.profile))?.username,
  ]);

  const displayName = findFirstString([
    author?.displayName,
    (asObject(author?.profile))?.displayName,
    author?.display_name,
  ]);

  const pfpUrl = findFirstString([
    author?.pfpUrl,
    author?.pfp_url,
    (asObject(author?.pfp))?.url,
    (asObject(author?.profile))?.pfpUrl,
  ]);

  const embedCandidates = [
    ...asArray(cast?.embeds),
    ...asArray(root.embeds),
    ...asArray(data?.embeds),
  ];
  const embeds = embedCandidates
    .map((embed) => {
      if (typeof embed === "string") return embed;
      const obj = asObject(embed);
      if (!obj) return null;
      return findFirstString([obj.url, obj.uri, obj.link]);
    })
    .filter((value): value is string => Boolean(value));

  if (!fid || !hash) return null;
  return { fid, hash, text, embeds, username, displayName, pfpUrl };
}

function parseCaseLinkMetadata(urls: string[]) {
  for (const value of urls) {
    try {
      const url = new URL(value);
      const isCaseDomain = url.hostname === "case.cards" || url.hostname === "www.case.cards";
      if (!isCaseDomain) continue;
      const refFidRaw = url.searchParams.get("ref_fid");
      const refFid =
        refFidRaw && Number.isFinite(Number(refFidRaw)) ? Math.trunc(Number(refFidRaw)) : null;
      return {
        hasCaseLink: true,
        campaign: url.searchParams.get("campaign"),
        refFid,
        path: url.pathname,
      };
    } catch {
      continue;
    }
  }
  return { hasCaseLink: false, campaign: null, refFid: null, path: null };
}

export async function POST(request: NextRequest) {
  try {
    const cloned = request.clone();
    const payload = await cloned.json().catch(() => null);
    const eventType =
      (payload &&
        typeof payload === "object" &&
        "type" in payload &&
        typeof payload.type === "string" &&
        payload.type) ||
      request.headers.get("x-event-type") ||
      "farcaster.webhook";

    await recordWebhook(eventType, payload, request.headers);

    const fid =
      payload &&
      typeof payload === "object" &&
      "fid" in payload &&
      typeof payload.fid === "number"
        ? payload.fid
        : null;

    if (fid) {
      await recordTrackEvent({
        type: "webhook_event",
        actor: { fid, source: "farcaster-webhook" },
        metadata: { eventType },
      });
    }

    const cast = extractCastInfo(payload);
    if (cast) {
      const linkMeta = parseCaseLinkMetadata(cast.embeds);
      await recordTrackEvent({
        eventId: `cast:${cast.hash}`,
        type: "cast_published",
        actor: {
          fid: cast.fid,
          username: cast.username,
          displayName: cast.displayName,
          pfpUrl: cast.pfpUrl,
          source: "farcaster-webhook",
        },
        referrerFid: linkMeta.refFid,
        metadata: {
          eventType,
          castHash: cast.hash,
          hasCaseLink: linkMeta.hasCaseLink,
          embedCount: cast.embeds.length,
          campaign: linkMeta.campaign ?? "",
          casePath: linkMeta.path ?? "",
          hasText: Boolean(cast.text),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
