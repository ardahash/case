import { NextRequest, NextResponse } from "next/server";
import { recordTrackEvent } from "@/lib/growth/store";
import type { TrackEventRequest } from "@/lib/growth/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<TrackEventRequest>;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (!body.type || !body.actor) {
      return NextResponse.json({ error: "Missing type or actor" }, { status: 400 });
    }

    const result = await recordTrackEvent({
      eventId: body.eventId,
      type: body.type,
      actor: body.actor,
      metadata: body.metadata,
      opening: body.opening,
      referrerFid: body.referrerFid,
      ts: body.ts,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to track event." }, { status: 500 });
  }
}

