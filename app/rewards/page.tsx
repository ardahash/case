import { RewardHistory } from "@/components/reward/RewardHistory";
import { RewardsIdentity } from "@/components/reward/RewardsIdentity";
import { GrowthDashboard } from "@/components/growth/GrowthDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RewardsPage() {
  const deployBlock = process.env.NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK;
  const dailyDeployBlock = process.env.NEXT_PUBLIC_DAILY_CASE_SALE_DEPLOY_BLOCK;

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Rewards</h1>
        <p className="text-muted-foreground">
          Track your case openings and CASE / cbBTC rewards. History is indexed live from the CaseSale contract.
        </p>
      </div>

      <GrowthDashboard />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <RewardHistory />
        <div className="flex flex-col gap-6">
          <RewardsIdentity />
          <Card className="glass">
            <CardHeader>
              <CardTitle>Indexing</CardTitle>
              <CardDescription>Onchain logs are fetched directly from Base.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {(deployBlock || dailyDeployBlock) ? (
                <div className="flex flex-col gap-2">
                  {deployBlock && (
                    <span>
                      Paid CaseSale deploy block: <code>{deployBlock}</code>.
                    </span>
                  )}
                  {dailyDeployBlock && (
                    <span>
                      Daily CaseSale deploy block: <code>{dailyDeployBlock}</code>.
                    </span>
                  )}
                  <span>History will backfill from these blocks.</span>
                </div>
              ) : (
                <>
                  For full history backfill, set <code>NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK</code> (paid)
                  and <code>NEXT_PUBLIC_DAILY_CASE_SALE_DEPLOY_BLOCK</code> (daily) in your env.
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
