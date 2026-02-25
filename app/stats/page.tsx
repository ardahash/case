"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StatsResponse = {
  paid: {
    address: string | null;
    fromBlock: string | null;
    count: number;
  };
  daily: {
    address: string | null;
    fromBlock: string | null;
    count: number;
  };
  latestBlock: string;
  updatedAt: string;
};

export default function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/stats");
        if (!res.ok) {
          throw new Error("Failed to load stats");
        }
        const data = (await res.json()) as StatsResponse;
        if (mounted) setStats(data);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Stats unavailable right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Stats</h1>
        <p className="text-muted-foreground">
          Live counts of case openings on Base (paid vs free daily).
        </p>
      </div>

      {loading && (
        <Card className="glass">
          <CardContent className="py-6 text-sm text-muted-foreground">Loading stats...</CardContent>
        </Card>
      )}

      {error && (
        <Card className="glass">
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {stats && !error && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Paid Case Openings</CardTitle>
              <CardDescription>CaseSale contract activity</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="text-3xl font-semibold text-foreground">{stats.paid.count}</div>
              <div>Contract: {stats.paid.address ?? "Not configured"}</div>
              <div>From block: {stats.paid.fromBlock ?? "n/a"}</div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Daily Mini Openings</CardTitle>
              <CardDescription>Daily CaseSale contract activity</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="text-3xl font-semibold text-foreground">{stats.daily.count}</div>
              <div>Contract: {stats.daily.address ?? "Not configured"}</div>
              <div>From block: {stats.daily.fromBlock ?? "n/a"}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && !error && (() => {
        const paid = stats.paid.count;
        const daily = stats.daily.count;
        const total = Math.max(paid + daily, 1);
        const paidPct = Math.round((paid / total) * 100);
        const dailyPct = 100 - paidPct;

        return (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Openings Mix</CardTitle>
              <CardDescription>Share of paid vs free daily opens</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Paid</span>
                <span>{paid} ({paidPct}%)</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Daily</span>
                <span>{daily} ({dailyPct}%)</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-accent" style={{ width: `${dailyPct}%` }} />
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {stats && !error && (
        <Card className="glass">
          <CardContent className="flex flex-col gap-2 py-5 text-xs text-muted-foreground">
            <div>Latest block: {stats.latestBlock}</div>
            <div>Updated: {new Date(stats.updatedAt).toLocaleString()}</div>
            <div>
              Source: onchain CasePurchased events. Use deploy block envs to backfill full history.
            </div>
            <Link href="/rewards" className="text-primary">
              View rewards history
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
