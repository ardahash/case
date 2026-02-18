"use client";

import { useEffect } from "react";

type ModelViewerProps = {
  src: string;
  poster?: string;
  className?: string;
};

export function ModelViewer({ src, poster, className }: ModelViewerProps) {
  useEffect(() => {
    void import("@google/model-viewer");
  }, []);

  return (
    <model-viewer
      src={src}
      poster={poster}
      loading="lazy"
      auto-rotate
      camera-controls
      disable-zoom
      shadow-intensity="0.7"
      exposure="1"
      className={className}
    />
  );
}
