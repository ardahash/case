import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { getCaseType } from "@/config/caseTypes";
import { getCbBtcUsdFallback } from "@/lib/pricing";

const globalStore = globalThis as unknown as {
  caseRewards?: Map<string, { serverSeed: string; commitment: string }>;
};

const getStore = () => {
  if (!globalStore.caseRewards) {
    globalStore.caseRewards = new Map();
  }
  return globalStore.caseRewards;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    caseTypeId: number;
    txHash: string;
    clientSeed: string;
  };

  const caseType = getCaseType(payload.caseTypeId);
  if (!caseType) {
    return Response.json({ error: "Case type not found." }, { status: 404 });
  }

  const serverSeed = randomBytes(32).toString("hex");
  const commitment = createHash("sha256")
    .update(`${serverSeed}:${payload.clientSeed}:${payload.txHash}`)
    .digest("hex");

  const rewardUsd =
    caseType.minRewardUSD +
    Math.random() * (caseType.maxRewardUSD - caseType.minRewardUSD);

  const cbBtcUsdPrice =
    Number(process.env.CBBTC_USD) || getCbBtcUsdFallback();
  const rewardCbBtc = rewardUsd / cbBtcUsdPrice;

  const openingId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  getStore().set(openingId, { serverSeed, commitment });

  return Response.json({
    openingId,
    rewardUsd: Number(rewardUsd.toFixed(2)),
    rewardCbBtc: Number(rewardCbBtc.toFixed(8)),
    cbBtcUsdPrice,
    randomness: {
      source: "server-mvp",
      commitment: `0x${commitment}`,
      serverSeed: `0x${serverSeed}`,
      clientSeed: payload.clientSeed,
      revealedImmediately: true,
    },
  });
}
