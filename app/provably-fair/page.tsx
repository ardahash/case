import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProvablyFairPage() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Provably Fair</h1>
        <p className="text-muted-foreground">
          Case is built to be VRF-ready. The MVP uses server-side randomness with explicit commitments.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Commit-Reveal (MVP)</CardTitle>
            <CardDescription>Server-side randomness with immediate reveal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <span>1. Client submits purchase tx hash + client seed.</span>
            <span>2. Server generates a seed and returns a commitment hash.</span>
            <span>3. Server reveals the seed immediately for MVP transparency.</span>
            <span>4. Reward is computed from the combined seeds.</span>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Chainlink VRF (Next)</CardTitle>
            <CardDescription>Drop-in upgrade path.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Replace the server RNG with Chainlink VRF and store proofs onchain. The API responses already
            expose randomness metadata fields so UI does not change.
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Randomness Payload Example</CardTitle>
          <CardDescription>Returned from /api/reward in MVP.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
{`{
  "openingId": "1700000000000",
  "rewardUsd": 4.73,
  "rewardCbBtc": 0.000078,
  "randomness": {
    "source": "server-mvp",
    "commitment": "0x...",
    "serverSeed": "0x...",
    "clientSeed": "0x...",
    "revealedImmediately": true
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
