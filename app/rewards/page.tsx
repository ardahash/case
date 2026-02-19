import { RewardHistory } from "@/components/reward/RewardHistory";
import { RewardsIdentity } from "@/components/reward/RewardsIdentity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RewardsPage() {
  const deployBlock = process.env.NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK;

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Rewards</h1>
        <p className="text-muted-foreground">
          Track your case openings and cbBTC rewards. History is indexed live from the CaseSale contract.
        </p>
      </div>

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
              {deployBlock ? (
                <>
                  CaseSale deploy block: <code>{deployBlock}</code>. History will backfill from this block.
                </>
              ) : (
                <>
                  For full history backfill, set <code>NEXT_PUBLIC_CASE_SALE_DEPLOY_BLOCK</code> to the
                  CaseSale deployment block in your env.
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
