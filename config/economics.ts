export const economicsConfig = {
  priceUSDC: 5.0,
  minRewardUSD: 3.0,
  maxRewardUSD: 8.0,
  platformFeeBps: 800,
  targetRTP: 0.8,
  rewardDistribution: {
    type: "weighted",
    expectedValueUSD: 4.0,
    positiveReturnBps: 100,
  },
} as const;

export type EconomicsConfig = typeof economicsConfig;

