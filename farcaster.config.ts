const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const IMAGE_URL = `${ROOT_URL}/caseapp1024x1024.png`;
const HERO_URL = `${ROOT_URL}/caseapp1200x630.png`;
const ICON_URL = `${ROOT_URL}/icon.png`;
const SPLASH_URL = `${ROOT_URL}/splash.png`;

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const farcasterConfig = {
  accountAssociation: {
    header:
      "eyJmaWQiOjE4Mzc3MjksInR5cGUiOiJhdXRoIiwia2V5IjoiMHgzOTlGNGFlRDZEMTVlMmNFNjlhMjA3Zjg3ZjcwRjVGRUIyOTY0ODdiIn0",
    payload: "eyJkb21haW4iOiJ3d3cuY2FzZS5jYXJkcyJ9",
    signature:
      "+eQsrL+ovUmtUWklrxNlwFbYWojhDKodlCJivQgc6fEYEeZMCO4rtkOKT9ZFUD/Wc/PKtIT0xUyBPhoD3gMQwhs=",
  },
  miniapp: {
    version: "1",
    name: "Case",
    subtitle: "Free daily mini + Bitcoin rewards",
    description:
      "Open a free daily mini case on Base, earn Bitcoin rewards, and stack points for future CASE token airdrops.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: ICON_URL,
    homeUrl: ROOT_URL,
    imageUrl: IMAGE_URL,
    buttonTitle: "Open Free Daily Mini",
    splashImageUrl: SPLASH_URL,
    splashBackgroundColor: "#0b0f16",
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["gaming", "bitcoin", "p2e", "cbbtc", "gacha"],
    heroImageUrl: HERO_URL,
    tagline: "Open a free daily mini and earn Bitcoin",
    ogTitle: "Case - Free daily mini on Base",
    ogDescription:
      "Start with a free daily mini on Farcaster, earn Bitcoin rewards, and build CASE airdrop points.",
    ogImageUrl: IMAGE_URL,
    castShareUrl: "https://www.case.cards/open/3?src=farcaster&entry=daily",
  },
} as const;
