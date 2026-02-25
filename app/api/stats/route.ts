import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";

const PURCHASE_EVENT = parseAbiItem(
  "event CasePurchased(address indexed buyer, uint256 indexed caseTypeId, uint256 indexed openingId, uint256 priceUSDC)",
);

const LOOKBACK_BLOCKS = 200_000n;
const LOG_CHUNK_SIZE = 2000n;

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || base.rpcUrls.default.http[0];

const client = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

type CountResult = {
  address: `0x${string}` | null;
  fromBlock: string | null;
  count: number;
};

async function countPurchases(
  address: string | undefined,
  fromBlockEnv: string | undefined,
  latestBlock: bigint,
): Promise<CountResult> {
  if (!address) {
    return { address: null, fromBlock: null, count: 0 };
  }

  const normalized = address as `0x${string}`;
  const fromBlockRaw = fromBlockEnv
    ? BigInt(fromBlockEnv)
    : latestBlock > LOOKBACK_BLOCKS
      ? latestBlock - LOOKBACK_BLOCKS
      : 0n;
  const fromBlock = fromBlockRaw > latestBlock ? latestBlock : fromBlockRaw;

  let count = 0;
  for (let start = fromBlock; start <= latestBlock; ) {
    const end =
      start + LOG_CHUNK_SIZE - 1n > latestBlock ? latestBlock : start + LOG_CHUNK_SIZE - 1n;
    const logs = await client.getLogs({
      address: normalized,
      event: PURCHASE_EVENT,
      fromBlock: start,
      toBlock: end,
    });
    count += logs.length;
    start = end + 1n;
  }

  return {
    address: normalized,
    fromBlock: fromBlock.toString(),
    count,
  };
}

export async function GET() {
  try {
    const latestBlock = await client.getBlockNumber();
    const paidAddress = process.env.NEXT_PUBLIC_CASE_SALE_OR_MANAGER_ADDRESS;
    const dailyAddress = process.env.NEXT_PUBLIC_DAILY_CASE_SALE_ADDRESS;
    const paidDeployBlock = process.env.NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK;
    const dailyDeployBlock = process.env.NEXT_PUBLIC_DAILY_CASE_SALE_DEPLOY_BLOCK;

    const [paid, daily] = await Promise.all([
      countPurchases(paidAddress, paidDeployBlock, latestBlock),
      countPurchases(dailyAddress, dailyDeployBlock, latestBlock),
    ]);

    return NextResponse.json({
      paid,
      daily,
      latestBlock: latestBlock.toString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load stats." },
      { status: 500 },
    );
  }
}
