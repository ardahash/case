const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const farcasterConfig = {
  accountAssociation: {
    header:
      "eyJmaWQiOjE4Mzc3MjksInR5cGUiOiJhdXRoIiwia2V5IjoiMHgzOTlGNGFlRDZEMTVlMmNFNjlhMjA3Zjg3ZjcwRjVGRUIyOTY0ODdiIn0",
    payload: "eyJkb21haW4iOiJjYXNlLmNhcmRzIn0",
    signature:
      "gHgM2++BVA+4B8dHHznSqw31sIuXeJATwKRHA4KS6jFOjBwm/De7l0gJi8Q4u+kdHoISox8mUQdLeT7h+GUGBhs=",
  },
  miniapp: {
    version: "1",
    name: "Case",
    subtitle: "Premium vault cases",
    description: "Open cases and earn Bitcoin rewards on Base.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/caseapp1024x1024.png`,
    splashImageUrl: `${ROOT_URL}/caseapp200x200.png`,
    splashBackgroundColor: "#0b0f16",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["base", "cases", "cbbtc", "vault"],
    heroImageUrl: `${ROOT_URL}/caseapp1200x630.png`,
    tagline: "Open cases, get $cbBTC."
  },
} as const;

