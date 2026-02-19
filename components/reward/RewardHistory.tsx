"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { caseSaleAbi } from "@/lib/abis/caseSale";
import { contractAddresses, contractFlags } from "@/lib/contracts";
import { getCaseType } from "@/config/caseTypes";
import { formatDateTime, formatToken, formatUsd } from "@/lib/format";
import { getExplorerTxUrl } from "@/lib/explorer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpeningsStore } from "@/stores/useOpeningsStore";
import { activeChain } from "@/lib/chains";

type OnchainOpening = {
  id: string;
  caseTypeId: number;
  caseName: string;
  rewardCbBtc: number | null;
  rewardUsd: number | null;
  claimed: boolean;
  rewarded: boolean;
  txHash: `0x${string}`;
  timestamp: number;
};

type Opening = {
  buyer: `0x${string}`;
  caseTypeId: bigint;
  rewardAmount: bigint;
  reservedAmount: bigint;
  btcUsdPrice: bigint;
  rewarded: boolean;
  claimed: boolean;
  requestId: bigint;
};

const PURCHASE_EVENT = parseAbiItem(
  "event CasePurchased(address indexed buyer, uint256 indexed caseTypeId, uint256 indexed openingId, uint256 priceUSDC)",
);

const LOOKBACK_BLOCKS = 200_000n;
const LOG_CHUNK_SIZE = 2000n;

export function RewardHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const localOpenings = useOpeningsStore((state) => state.openings);

  const [items, setItems] = useState<OnchainOpening[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [btcUsdDecimals, setBtcUsdDecimals] = useState(8);

  const usingLocal = contractFlags.usingMockAddresses || !publicClient;

  useEffect(() => {
    if (!address || usingLocal) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const envStart = process.env.NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK;
        const fromBlock = envStart
          ? BigInt(envStart)
          : latestBlock > LOOKBACK_BLOCKS
            ? latestBlock - LOOKBACK_BLOCKS
            : 0n;

        const logsAccumulator: Awaited<ReturnType<typeof publicClient.getLogs>> = [];

        for (let start = fromBlock; start <= latestBlock; ) {
          const end =
            start + LOG_CHUNK_SIZE - 1n > latestBlock
              ? latestBlock
              : start + LOG_CHUNK_SIZE - 1n;
          try {
            const chunk = await publicClient.getLogs({
              address: contractAddresses.caseSale as `0x${string}`,
              event: PURCHASE_EVENT,
              args: { buyer: address as `0x${string}` },
              fromBlock: start,
              toBlock: end,
            });
            logsAccumulator.push(...chunk);
          } catch (chunkError) {
            console.error(chunkError);
            throw chunkError;
          }
          start = end + 1n;
        }

        const logs = logsAccumulator;
        const typedLogs = logs as unknown as Array<{
          args: { openingId?: bigint; caseTypeId?: bigint };
          transactionHash: `0x${string}`;
          blockNumber: bigint;
        }>;

        if (typedLogs.length === 0) {
          if (!cancelled) setItems([]);
          return;
        }

        const decimalsResult = await publicClient.readContract({
          address: contractAddresses.caseSale as `0x${string}`,
          abi: caseSaleAbi,
          functionName: "btcUsdDecimals",
        });
        const nextDecimals =
          typeof decimalsResult === "number"
            ? decimalsResult
            : Number(decimalsResult ?? 8n);
        setBtcUsdDecimals(nextDecimals);

        const blockNumbers = Array.from(
          new Set(logs.map((log) => log.blockNumber).filter(Boolean)),
        ) as bigint[];

        const blocks = await Promise.all(
          blockNumbers.map((blockNumber) =>
            publicClient.getBlock({ blockNumber }),
          ),
        );
        const blockTimeMap = new Map(
          blocks.map((block) => [block.number, Number(block.timestamp) * 1000]),
        );

        const safeLogs = typedLogs.filter((log) => log.args.openingId !== undefined);

        const multicallResults = await publicClient.multicall({
          allowFailure: true,
          contracts: safeLogs.map((log) => ({
            address: contractAddresses.caseSale as `0x${string}`,
            abi: caseSaleAbi,
            functionName: "getOpening",
            args: [log.args.openingId],
          })),
        });

        const nextItems: OnchainOpening[] = safeLogs.map((log, index) => {
          const openingId = log.args.openingId ?? 0n;
          const caseTypeId = Number(log.args.caseTypeId);
          const caseType = getCaseType(caseTypeId);
          const openingResult = multicallResults[index];

          const opening =
            openingResult && openingResult.status === "success"
              ? (openingResult.result as unknown as Opening)
              : null;

          const rewardCbBtc = opening?.rewarded
            ? Number(formatUnits(opening.rewardAmount, 8))
            : null;
          const priceFromFeed =
            opening?.btcUsdPrice && nextDecimals >= 0
              ? Number(opening.btcUsdPrice) / 10 ** nextDecimals
              : null;
          const rewardUsd =
            rewardCbBtc !== null && priceFromFeed
              ? rewardCbBtc * priceFromFeed
              : null;

          return {
            id: openingId.toString(),
            caseTypeId,
            caseName: caseType?.name ?? `Case #${caseTypeId}`,
            rewardCbBtc,
            rewardUsd,
            claimed: Boolean(opening?.claimed),
            rewarded: Boolean(opening?.rewarded),
            txHash: log.transactionHash,
            timestamp: blockTimeMap.get(log.blockNumber) ?? Date.now(),
          };
        });

        nextItems.sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) setItems(nextItems);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            "Failed to load onchain history. The public Base RPC may be overloaded. Set NEXT_PUBLIC_RPC_URL to a dedicated provider (Alchemy, QuickNode, or Coinbase) and redeploy.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [address, publicClient, usingLocal]);

  useEffect(() => {
    if (!address || usingLocal || !publicClient || items.length === 0) return;
    const pending = items.filter((item) => !item.rewarded || !item.claimed);
    if (pending.length === 0) return;
    let cancelled = false;

    const refreshPending = async () => {
      try {
        const results = await publicClient.multicall({
          allowFailure: true,
          contracts: pending.map((item) => ({
            address: contractAddresses.caseSale as `0x${string}`,
            abi: caseSaleAbi,
            functionName: "getOpening",
            args: [BigInt(item.id)],
          })),
        });

        if (cancelled) return;

        setItems((prev) => {
          const next = [...prev];
          pending.forEach((item, index) => {
            const result = results[index];
            if (!result || result.status !== "success") return;
            const opening = result.result as unknown as Opening;
            if (!opening) return;

            const rewardCbBtc = opening.rewarded
              ? Number(formatUnits(opening.rewardAmount, 8))
              : null;
            const priceFromFeed =
              opening.btcUsdPrice && btcUsdDecimals >= 0
                ? Number(opening.btcUsdPrice) / 10 ** btcUsdDecimals
                : null;
            const rewardUsd =
              rewardCbBtc !== null && priceFromFeed
                ? rewardCbBtc * priceFromFeed
                : null;

            const targetIndex = next.findIndex((entry) => entry.id === item.id);
            if (targetIndex === -1) return;
            next[targetIndex] = {
              ...next[targetIndex],
              rewardCbBtc,
              rewardUsd,
              rewarded: Boolean(opening.rewarded),
              claimed: Boolean(opening.claimed),
            };
          });
          return next;
        });
      } catch (refreshError) {
        console.error(refreshError);
      }
    };

    void refreshPending();
    const interval = setInterval(refreshPending, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, btcUsdDecimals, items, publicClient, usingLocal]);

  const localItems: OnchainOpening[] = useMemo(
    () =>
      localOpenings.map((opening) => ({
        id: opening.id,
        caseTypeId: opening.caseTypeId,
        caseName: opening.caseName,
        rewardCbBtc: opening.rewardCbBtc,
        rewardUsd: opening.rewardUsd,
        claimed: false,
        rewarded: true,
        txHash: opening.txHash as `0x${string}`,
        timestamp: opening.timestamp,
      })),
    [localOpenings],
  );

  const displayItems = usingLocal ? localItems : items;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!address && (
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view onchain history.
          </p>
        )}
        {address && isLoading && (
          <p className="text-sm text-muted-foreground">Loading onchain history...</p>
        )}
        {address && error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {address && !isLoading && !error && displayItems.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No onchain cases found yet.
            {!process.env.NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK &&
              " Showing recent activity only."}
          </p>
        )}
        {displayItems.length > 0 && (
          <div className="flex flex-col gap-3">
            {displayItems.map((opening) => (
              <div
                key={opening.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{opening.caseName}</div>
                  <div className="flex items-center gap-2">
                    {opening.rewardCbBtc !== null ? (
                      <Badge variant="secondary">
                        {formatToken(opening.rewardCbBtc, "cbBTC", 8)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                    {opening.rewardUsd !== null && (
                      <Badge variant="outline">
                        {formatUsd(opening.rewardUsd)}
                      </Badge>
                    )}
                    {opening.claimed && <Badge>Claimed</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {opening.rewardCbBtc !== null
                      ? formatToken(opening.rewardCbBtc, "cbBTC", 8)
                      : "Reward pending"}
                  </span>
                  <span>{formatDateTime(opening.timestamp)}</span>
                </div>
                <Link
                  href={getExplorerTxUrl(opening.txHash)}
                  className="text-xs text-primary"
                >
                  View transaction
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

