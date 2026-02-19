import { StakePanel } from "@/components/stake/StakePanel";
import { XCaseStakePanel } from "@/components/stake/XCaseStakePanel";
import { DailyClaimCard } from "@/components/stake/DailyClaimCard";
import { CaseSwap } from "@/components/stake/CaseSwap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StakePage() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Stake CASE</h1>
        <p className="text-muted-foreground">
          Stake CASE to mint xCASE, then stake xCASE to earn platform fee rewards.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <StakePanel />
          <XCaseStakePanel />
          <CaseSwap />
        </div>
        <div className="flex flex-col gap-6">
          <DailyClaimCard />
          <Card className="glass">
            <CardHeader>
              <CardTitle>APR</CardTitle>
              <CardDescription>Updates when rewards are funded onchain.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              APR is dynamic and will appear once reward emissions are configured.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
