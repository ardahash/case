import { economicsConfig } from "./economics";

// TODO: replace with onchain registry + admin controls.

export type CaseMedia = {
  image: string;
  video: string;
  model?: string;
};

export type CaseType = {
  id: number;
  name: string;
  priceUSDC: number;
  minRewardUSD: number;
  maxRewardUSD: number;
  media: CaseMedia;
  availability: "live" | "coming-soon" | "sold-out";
  oddsConfig: {
    type: "uniform" | "weighted" | "table";
    description: string;
  };
  enabled: boolean;
};

export const caseTypes: CaseType[] = [
  {
    id: 1,
    name: "Case",
    priceUSDC: economicsConfig.priceUSDC,
    minRewardUSD: economicsConfig.minRewardUSD,
    maxRewardUSD: economicsConfig.maxRewardUSD,
    media: {
      image: "/case-placeholder.png",
      model: "/case1.glb",
      video: "/case1opening.mp4",
    },
    availability: "live",
    oddsConfig: {
      type: "weighted",
      description: "Weighted distribution with rare positive returns.",
    },
    enabled: true,
  },
  {
    id: 2,
    name: "Night Vault",
    priceUSDC: 10,
    minRewardUSD: 5,
    maxRewardUSD: 12,
    media: {
      image: "/case-placeholder.png",
      video: "/case-opening-placeholder.mp4",
    },
    availability: "coming-soon",
    oddsConfig: {
      type: "uniform",
      description: "Placeholder odds config.",
    },
    enabled: false,
  },
];

export const getCaseType = (caseId: string | number) =>
  caseTypes.find((item) => String(item.id) === String(caseId));

