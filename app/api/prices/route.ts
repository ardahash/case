import { getCbBtcUsdFallback } from "@/lib/pricing";

export async function GET() {
  const cbBtcUsd = Number(process.env.CBBTC_USD) || getCbBtcUsdFallback();

  return Response.json({
    cbBtcUsd,
    source: "mock",
    note: "TODO: replace with oracle or trusted price feed.",
  });
}
