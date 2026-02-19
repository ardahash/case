import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProvablyFairPage() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Provably Fair</h1>
        <p className="text-muted-foreground">
          Case uses Chainlink VRF on Base for onchain randomness and reward assignment.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Chainlink VRF (Live)</CardTitle>
            <CardDescription>Onchain verifiable randomness.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <span>1. Purchase calls CaseSale on Base and requests VRF.</span>
            <span>2. Chainlink VRF fulfills the request with verifiable randomness.</span>
            <span>3. CaseSale stores the reward amount onchain.</span>
            <span>4. You claim the reward from the onchain stored amount.</span>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>How To Verify</CardTitle>
            <CardDescription>Transparency on BaseScan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <span>1. Confirm your CasePurchased transaction.</span>
            <span>2. Watch for the VRF request fulfillment on CaseRewarded.</span>
            <span>3. The stored reward is visible via getOpening(openingId).</span>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Randomness Payload Example</CardTitle>
          <CardDescription>Derived from onchain opening data.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
{`{
  "openingId": "12345",
  "rewardCbBtc": 0.000081,
  "rewardUsdEstimate": 4.91,
  "randomness": {
    "source": "chainlink-vrf",
    "requestId": "0x...",
    "fulfilledOnchain": true
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
