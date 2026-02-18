"use client";

import { useMiniKit } from "@coinbase/onchainkit/minikit";

export const useIsMiniKit = () => {
  const miniKit = useMiniKit();
  const context = (miniKit as { context?: unknown }).context;
  return Boolean(context);
};

