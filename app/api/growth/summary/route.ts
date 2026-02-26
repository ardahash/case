import { NextResponse } from "next/server";
import { getGrowthSummary } from "@/lib/growth/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await getGrowthSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load growth summary." }, { status: 500 });
  }
}

