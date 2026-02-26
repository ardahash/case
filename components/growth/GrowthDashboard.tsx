"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useMiniApp } from "@/app/providers/MiniAppProvider";
import { buildGrowthActor, fetchGrowthMe } from "@/lib/growth/client";
import type { GrowthMeResponse, GrowthSummaryResponse } from "@/lib/growth/types";
import { formatDateTime, formatToken, formatUsd, shortAddress } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function labelForUser(user: {
  username?: string | null;
  displayName?: string | null;
  fid?: number | null;
  address?: string | null;
}) {
  if (user.username) return `@${user.username}`;
  if (user.displayName) return user.displayName;
  if (user.fid) return `fid:${user.fid}`;
  if (user.address) return shortAddress(user.address);
  return "Anonymous";
}

type Props = {
  compact?: boolean;
  className?: string;
};

export function GrowthDashboard({ compact = false, className }: Props) {
  const { address } = useAccount();
  const { farcasterUser, quickAuthUser, isMiniApp } = useMiniApp();

  const actor = useMemo(
    () =>
      buildGrowthActor({
        fid: quickAuthUser?.fid ?? farcasterUser?.fid ?? null,
        address: address ?? null,
        username: farcasterUser?.username ?? null,
        displayName: farcasterUser?.displayName ?? null,
        pfpUrl: farcasterUser?.pfpUrl ?? null,
        source: isMiniApp ? "farcaster-miniapp" : "web",
      }),
    [
      address,
      farcasterUser?.displayName,
      farcasterUser?.fid,
      farcasterUser?.pfpUrl,
      farcasterUser?.username,
      isMiniApp,
      quickAuthUser?.fid,
    ],
  );

  const [summary, setSummary] = useState<GrowthSummaryResponse | null>(null);
  const [me, setMe] = useState<GrowthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [summaryRes, meRes] = await Promise.all([
          fetch("/api/growth/summary").then((res) => (res.ok ? res.json() : null)),
          fetchGrowthMe(actor),
        ]);
        if (cancelled) return;
        setSummary(summaryRes as GrowthSummaryResponse | null);
        setMe(meRes as GrowthMeResponse | null);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [actor]);

  return (
    <div className={`grid gap-6 ${compact ? "xl:grid-cols-[1fr_1.2fr]" : "lg:grid-cols-[1fr_1.2fr]"} ${className ?? ""}`}>
      <div className="flex flex-col gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Points (Airdrop Prep)</CardTitle>
            <CardDescription>
              Offchain points for future CASE token airdrop eligibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {loading && <div className="text-muted-foreground">Loading points...</div>}
            {!loading && me?.found && me.user && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">Account</div>
                  <div className="font-medium">{labelForUser(me.user)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Points</div>
                    <div className="text-2xl font-semibold">{me.user.points.toLocaleString()}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Mini Streak</div>
                    <div className="text-2xl font-semibold">{me.user.streaks.miniCurrent}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Mini Opens</div>
                    <div className="text-xl font-semibold">{me.user.stats.miniOpenings}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Paid Opens</div>
                    <div className="text-xl font-semibold">{me.user.stats.paidOpenings}</div>
                  </div>
                </div>
                {me.user.referredByFid && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Referred by fid:{me.user.referredByFid}. First-open referral bonus tracked.
                  </div>
                )}
                {me.recentAwards.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Recent Point Awards
                    </div>
                    {me.recentAwards.slice(0, 5).map((award) => (
                      <div
                        key={award.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-xs"
                      >
                        <span className="text-muted-foreground">{award.reason.replaceAll("_", " ")}</span>
                        <span className="font-medium text-foreground">+{award.points}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!loading && (!me || !me.found || !me.user) && (
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-muted-foreground">
                Open a case (especially the free daily mini) to start earning offchain points.
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Current scoring: daily mini opens, paid opens, streaks, and referrals.
            </div>
          </CardContent>
        </Card>

        {!compact && summary && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Community Totals</CardTitle>
              <CardDescription>Offchain growth and points data (MVP tracker)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Users</div>
                <div className="text-xl font-semibold">{summary.totals.users.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Points</div>
                <div className="text-xl font-semibold">{summary.totals.pointsAwarded.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Mini Opens</div>
                <div className="text-xl font-semibold">{summary.totals.miniOpenings.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Paid Opens</div>
                <div className="text-xl font-semibold">{summary.totals.paidOpenings.toLocaleString()}</div>
              </div>
              <Link href="/stats" className="col-span-2 text-xs text-primary">
                View onchain stats
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6">
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Top users by offchain points</CardDescription>
              </div>
              <Badge variant="secondary">Airdrop Season</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading && <div className="text-sm text-muted-foreground">Loading leaderboard...</div>}
            {!loading && summary?.leaderboard?.length ? (
              summary.leaderboard.slice(0, compact ? 8 : 12).map((row) => (
                <div
                  key={row.userId}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="text-xs font-medium text-muted-foreground">#{row.rank}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {labelForUser({
                        username: row.username,
                        displayName: row.displayName,
                        fid: row.fid,
                      })}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.miniOpenings} mini, {row.paidOpenings} paid, streak {row.miniCurrentStreak}
                    </div>
                  </div>
                  <div className="text-right font-semibold">{row.points.toLocaleString()}</div>
                </div>
              ))
            ) : (
              !loading && (
                <div className="text-sm text-muted-foreground">
                  No leaderboard entries yet. First openings will populate this list.
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Recent Wins</CardTitle>
            <CardDescription>Live social proof from tracked case reveals</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading && <div className="text-sm text-muted-foreground">Loading wins...</div>}
            {!loading && summary?.recentWinners?.length ? (
              summary.recentWinners.slice(0, compact ? 8 : 12).map((win) => (
                <div
                  key={`${win.id}-${win.ts}`}
                  className="rounded-xl border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate font-medium">
                      {labelForUser({
                        username: win.username,
                        displayName: win.displayName,
                        fid: win.fid,
                      })}
                    </div>
                    <Badge variant={win.isFreeCase ? "muted" : "outline"}>
                      {win.isFreeCase ? "Daily Mini" : "Paid"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      {win.caseName}: {formatToken(win.rewardAmount, win.rewardSymbol, win.rewardSymbol === "cbBTC" ? 8 : 4)}
                      {typeof win.rewardUsd === "number" ? ` (${formatUsd(win.rewardUsd)})` : ""}
                    </span>
                    <span>{formatDateTime(win.ts)}</span>
                  </div>
                </div>
              ))
            ) : (
              !loading && (
                <div className="text-sm text-muted-foreground">
                  No recent wins tracked yet. Shareable reward reveals will appear here.
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

