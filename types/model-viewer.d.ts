import type React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        poster?: string;
        loading?: "auto" | "lazy" | "eager";
        "auto-rotate"?: boolean;
        "camera-controls"?: boolean;
        "disable-zoom"?: boolean;
        "shadow-intensity"?: string | number;
        exposure?: string | number;
      };
    }
  }
}

export {};
