import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProvablyFairPage() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Provably Fair</h1>
        <p className="text-muted-foreground">
          Case uses low-cost onchain entropy to assign rewards at purchase time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Onchain Entropy (Live)</CardTitle>
            <CardDescription>Fast, low-cost randomness.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <span>1. Purchase calls CaseSale on Base.</span>
            <span>2. CaseSale derives randomness from onchain entropy (block prevrandao + blockhash).</span>
            <span>3. CaseSale stores the reward amount onchain in the same transaction.</span>
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
            <span>2. CaseRewarded is emitted in the same transaction.</span>
            <span>3. The stored reward is visible via getOpening(openingId).</span>
            <span>
              Note: This is not VRF-grade randomness; block producers can influence entropy.
            </span>
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
    "source": "onchain-entropy",
    "blockHash": "0x...",
    "prevrandao": "0x..."
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
