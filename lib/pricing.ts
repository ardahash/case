export const getCbBtcUsdFallback = () => {
  const env = process.env.NEXT_PUBLIC_CBBTC_USD;
  if (!env) return 60000;
  const parsed = Number(env);
  return Number.isFinite(parsed) ? parsed : 60000;
};

