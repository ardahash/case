"use client";

import { useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";

export function MiniKitReady() {
  const miniKit = useMiniKit();

  useEffect(() => {
    const setReady =
      (miniKit as { setFrameReady?: () => void }).setFrameReady ||
      (miniKit as { setMiniAppReady?: () => void }).setMiniAppReady;
    if (setReady) {
      setReady();
    }
  }, [miniKit]);

  return null;
}

