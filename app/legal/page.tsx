import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalPage() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Legal & Info</h1>
        <p className="text-muted-foreground">Review disclosures before using Case.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Disclaimers</CardTitle>
            <CardDescription>Placeholders for jurisdiction-specific terms.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <span>Not investment advice.</span>
            <span>Availability varies by jurisdiction.</span>
            <span>cbBTC is a tokenized asset and may fluctuate in value.</span>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Transparency</CardTitle>
            <CardDescription>Fee model and RTP are explicit.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Case publishes pricing, reward ranges, and platform fees. No hidden house edge logic.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
