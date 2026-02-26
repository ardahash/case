export type JsonPrimitive = string | number | boolean | null;
export type JsonMap = Record<string, JsonPrimitive>;

export type GrowthEventType =
  | "app_launch"
  | "screen_view"
  | "profile_sync"
  | "wallet_connected"
  | "referral_landing"
  | "open_start"
  | "opening_completed"
  | "share_intent"
  | "share_composer_opened"
  | "share_native_opened"
  | "share_copied"
  | "cast_published"
  | "webhook_event";

export type GrowthActorInput = {
  fid?: number | null;
  address?: string | null;
  sessionId?: string | null;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  source?: string | null;
};

export type GrowthOpeningPayload = {
  openingId: string;
  txHash?: string | null;
  caseTypeId: number;
  caseName: string;
  isFreeCase: boolean;
  casePriceUSDC?: number | null;
  rewardSymbol: string;
  rewardAmount: number;
  rewardUsd?: number | null;
};

export type TrackEventRequest = {
  eventId?: string;
  type: GrowthEventType;
  actor: GrowthActorInput;
  metadata?: JsonMap;
  opening?: GrowthOpeningPayload;
  referrerFid?: number | null;
  ts?: number;
};

export type GrowthUserStats = {
  appLaunches: number;
  screenViews: number;
  walletConnects: number;
  referralLandings: number;
  shares: number;
  shareCopies: number;
  shareComposers: number;
  castsPublished: number;
  totalOpenings: number;
  miniOpenings: number;
  paidOpenings: number;
  referralsConverted: number;
  referralsSent: number;
};

export type GrowthStreaks = {
  miniCurrent: number;
  miniBest: number;
  lastMiniOpenDay: string | null;
};

export type GrowthUserRecord = {
  id: string;
  fid: number | null;
  address: string | null;
  sessionId: string | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  source: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  referredByFid: number | null;
  referredAt: number | null;
  points: number;
  stats: GrowthUserStats;
  streaks: GrowthStreaks;
};

export type GrowthEventRecord = {
  id: string;
  type: GrowthEventType;
  ts: number;
  userId: string;
  fid: number | null;
  address: string | null;
  sessionId: string | null;
  source: string | null;
  metadata?: JsonMap;
};

export type GrowthOpeningRecord = {
  id: string;
  ts: number;
  userId: string;
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  caseTypeId: number;
  caseName: string;
  isFreeCase: boolean;
  casePriceUSDC: number | null;
  rewardSymbol: string;
  rewardAmount: number;
  rewardUsd: number | null;
  txHash: string | null;
};

export type GrowthPointAward = {
  id: string;
  ts: number;
  userId: string;
  fid: number | null;
  reason: string;
  points: number;
  metadata?: JsonMap;
};

export type GrowthWebhookRecord = {
  id: string;
  ts: number;
  eventType: string;
  headers: Record<string, string>;
  payload: unknown;
};

export type GrowthStoreData = {
  version: number;
  users: Record<string, GrowthUserRecord>;
  aliases: {
    byFid: Record<string, string>;
    byAddress: Record<string, string>;
    bySession: Record<string, string>;
  };
  events: GrowthEventRecord[];
  openings: GrowthOpeningRecord[];
  awards: GrowthPointAward[];
  processedEventIds: Record<string, number>;
  processedOpeningKeys: Record<string, string>;
  webhooks: GrowthWebhookRecord[];
};

export type GrowthLeaderboardRow = {
  rank: number;
  userId: string;
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  points: number;
  miniCurrentStreak: number;
  miniBestStreak: number;
  totalOpenings: number;
  miniOpenings: number;
  paidOpenings: number;
  referralsSent: number;
};

export type GrowthRecentWinnerRow = {
  id: string;
  ts: number;
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  caseName: string;
  isFreeCase: boolean;
  rewardSymbol: string;
  rewardAmount: number;
  rewardUsd: number | null;
};

export type GrowthSummaryResponse = {
  totals: {
    users: number;
    pointsAwarded: number;
    openings: number;
    miniOpenings: number;
    paidOpenings: number;
  };
  leaderboard: GrowthLeaderboardRow[];
  recentWinners: GrowthRecentWinnerRow[];
  updatedAt: string;
};

export type GrowthMeResponse = {
  found: boolean;
  user: GrowthUserRecord | null;
  recentAwards: GrowthPointAward[];
  recentOpenings: GrowthOpeningRecord[];
  updatedAt: string;
};
