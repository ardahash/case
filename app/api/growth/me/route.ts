import { NextRequest, NextResponse } from "next/server";
import { getGrowthMe } from "@/lib/growth/store";
import type { GrowthActorInput } from "@/lib/growth/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { actor?: GrowthActorInput };
    if (!body?.actor) {
      return NextResponse.json({ error: "Missing actor." }, { status: 400 });
    }
    const data = await getGrowthMe(body.actor);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load growth profile." }, { status: 500 });
  }
}

