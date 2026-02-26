import { randomBytes, randomUUID } from "node:crypto";
import type {
  GrowthEventRecord,
  GrowthMeResponse,
  GrowthOpeningRecord,
  GrowthPointAward,
  GrowthRecentWinnerRow,
  GrowthStoreData,
  GrowthSummaryResponse,
  GrowthUserRecord,
  JsonMap,
  TrackEventRequest,
} from "@/lib/growth/types";
import {
  loadGrowthStore,
  saveGrowthStore,
  withPersistentGrowthLock,
} from "@/lib/growth/persistence";
const STORE_VERSION = 1;
const MAX_EVENTS = 5000;
const MAX_OPENINGS = 500;
const MAX_AWARDS = 10000;
const MAX_WEBHOOKS = 500;
const MAX_PROCESSED_EVENT_IDS = 20000;

const POINTS = {
  appLaunchDaily: 3,
  walletConnectedOnce: 20,
  shareIntent: 5,
  shareSuccess: 10,
  castPublished: 20,
  miniOpen: 25,
  paidOpen: 150,
  paidPriceMultiplier: 10,
  referralInviteeFirstOpen: 100,
  referralInviterFirstOpen: 300,
} as const;

const globalGrowthStore = globalThis as typeof globalThis & {
  __caseGrowthStoreMutex?: Promise<void>;
};

function emptyStats(): GrowthUserRecord["stats"] {
  return {
    appLaunches: 0,
    screenViews: 0,
    walletConnects: 0,
    referralLandings: 0,
    shares: 0,
    shareCopies: 0,
    shareComposers: 0,
    castsPublished: 0,
    totalOpenings: 0,
    miniOpenings: 0,
    paidOpenings: 0,
    referralsConverted: 0,
    referralsSent: 0,
  };
}

function emptyStore(): GrowthStoreData {
  return {
    version: STORE_VERSION,
    users: {},
    aliases: {
      byFid: {},
      byAddress: {},
      bySession: {},
    },
    events: [],
    openings: [],
    awards: [],
    processedEventIds: {},
    processedOpeningKeys: {},
    webhooks: [],
  };
}

async function readStore(): Promise<GrowthStoreData> {
  const parsed = await loadGrowthStore(emptyStore);
  if (!parsed || typeof parsed !== "object") {
    return emptyStore();
  }
  if (parsed.version !== STORE_VERSION) {
    return {
      ...emptyStore(),
      ...parsed,
      version: STORE_VERSION,
      aliases: parsed.aliases ?? emptyStore().aliases,
      processedEventIds: parsed.processedEventIds ?? {},
      processedOpeningKeys: parsed.processedOpeningKeys ?? {},
    };
  }
  return {
    ...emptyStore(),
    ...parsed,
    aliases: {
      ...emptyStore().aliases,
      ...(parsed.aliases ?? {}),
    },
    processedEventIds: parsed.processedEventIds ?? {},
    processedOpeningKeys: parsed.processedOpeningKeys ?? {},
  };
}

async function writeStoreData(store: GrowthStoreData) {
  await saveGrowthStore(store);
}

async function withStoreMutation<T>(mutator: (store: GrowthStoreData) => T | Promise<T>): Promise<T> {
  return withPersistentGrowthLock(async () => {
    const previous = globalGrowthStore.__caseGrowthStoreMutex ?? Promise.resolve();
    let release!: () => void;
    globalGrowthStore.__caseGrowthStoreMutex = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      const store = await readStore();
      const result = await mutator(store);
      trimStore(store);
      await writeStoreData(store);
      return result;
    } finally {
      release();
    }
  });
}

async function withStoreRead<T>(reader: (store: GrowthStoreData) => T | Promise<T>): Promise<T> {
  const previous = globalGrowthStore.__caseGrowthStoreMutex ?? Promise.resolve();
  await previous;
  const store = await readStore();
  return reader(store);
}

function trimStore(store: GrowthStoreData) {
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(-MAX_EVENTS);
  }
  if (store.openings.length > MAX_OPENINGS) {
    store.openings = store.openings.slice(-MAX_OPENINGS);
  }
  if (store.awards.length > MAX_AWARDS) {
    store.awards = store.awards.slice(-MAX_AWARDS);
  }
  if (store.webhooks.length > MAX_WEBHOOKS) {
    store.webhooks = store.webhooks.slice(-MAX_WEBHOOKS);
  }

  const processedEntries = Object.entries(store.processedEventIds);
  if (processedEntries.length > MAX_PROCESSED_EVENT_IDS) {
    processedEntries
      .sort((a, b) => a[1] - b[1])
      .slice(0, processedEntries.length - MAX_PROCESSED_EVENT_IDS)
      .forEach(([id]) => {
        delete store.processedEventIds[id];
      });
  }
}

function makeId(prefix: string) {
  try {
    return `${prefix}_${randomUUID()}`;
  } catch {
    return `${prefix}_${randomBytes(12).toString("hex")}`;
  }
}

function normalizeFid(input?: number | null): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  const value = Math.trunc(input);
  return value > 0 ? value : null;
}

function normalizeAddress(input?: string | null): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (!value.startsWith("0x")) return null;
  return value;
}

function normalizeString(input?: string | null, max = 256): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, max);
}

function sanitizeMetadata(metadata?: JsonMap): JsonMap | undefined {
  if (!metadata) return undefined;
  const out: JsonMap = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null) {
      out[key] = null;
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.slice(0, 300);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function createUser(now: number): GrowthUserRecord {
  return {
    id: makeId("usr"),
    fid: null,
    address: null,
    sessionId: null,
    username: null,
    displayName: null,
    pfpUrl: null,
    source: null,
    firstSeenAt: now,
    lastSeenAt: now,
    referredByFid: null,
    referredAt: null,
    points: 0,
    stats: emptyStats(),
    streaks: {
      miniCurrent: 0,
      miniBest: 0,
      lastMiniOpenDay: null,
    },
  };
}

function mergeUsers(store: GrowthStoreData, targetId: string, sourceId: string) {
  if (targetId === sourceId) return;
  const target = store.users[targetId];
  const source = store.users[sourceId];
  if (!target || !source) return;

  target.points += source.points;
  target.firstSeenAt = Math.min(target.firstSeenAt, source.firstSeenAt);
  target.lastSeenAt = Math.max(target.lastSeenAt, source.lastSeenAt);
  target.fid = target.fid ?? source.fid;
  target.address = target.address ?? source.address;
  target.sessionId = target.sessionId ?? source.sessionId;
  target.username = target.username ?? source.username;
  target.displayName = target.displayName ?? source.displayName;
  target.pfpUrl = target.pfpUrl ?? source.pfpUrl;
  target.source = target.source ?? source.source;
  target.referredByFid = target.referredByFid ?? source.referredByFid;
  target.referredAt = target.referredAt ?? source.referredAt;

  for (const [key, value] of Object.entries(source.stats)) {
    target.stats[key as keyof typeof target.stats] += value;
  }

  if ((source.streaks.lastMiniOpenDay ?? "") > (target.streaks.lastMiniOpenDay ?? "")) {
    target.streaks.lastMiniOpenDay = source.streaks.lastMiniOpenDay;
    target.streaks.miniCurrent = source.streaks.miniCurrent;
  }
  target.streaks.miniBest = Math.max(target.streaks.miniBest, source.streaks.miniBest);

  store.events.forEach((event) => {
    if (event.userId === sourceId) event.userId = targetId;
  });
  store.openings.forEach((opening) => {
    if (opening.userId === sourceId) opening.userId = targetId;
  });
  store.awards.forEach((award) => {
    if (award.userId === sourceId) award.userId = targetId;
  });

  for (const [fid, userId] of Object.entries(store.aliases.byFid)) {
    if (userId === sourceId) store.aliases.byFid[fid] = targetId;
  }
  for (const [addr, userId] of Object.entries(store.aliases.byAddress)) {
    if (userId === sourceId) store.aliases.byAddress[addr] = targetId;
  }
  for (const [session, userId] of Object.entries(store.aliases.bySession)) {
    if (userId === sourceId) store.aliases.bySession[session] = targetId;
  }

  delete store.users[sourceId];
}

type ResolvedActor = {
  user: GrowthUserRecord;
  fid: number | null;
  address: string | null;
  sessionId: string | null;
};

function resolveActor(store: GrowthStoreData, actor: TrackEventRequest["actor"], now: number): ResolvedActor {
  const fid = normalizeFid(actor.fid);
  const address = normalizeAddress(actor.address);
  const sessionId = normalizeString(actor.sessionId, 128);
  const username = normalizeString(actor.username, 64);
  const displayName = normalizeString(actor.displayName, 80);
  const pfpUrl = normalizeString(actor.pfpUrl, 500);
  const source = normalizeString(actor.source, 64);

  const candidates = new Set<string>();
  if (fid && store.aliases.byFid[String(fid)]) candidates.add(store.aliases.byFid[String(fid)]);
  if (address && store.aliases.byAddress[address]) candidates.add(store.aliases.byAddress[address]);
  if (sessionId && store.aliases.bySession[sessionId]) candidates.add(store.aliases.bySession[sessionId]);

  let userId: string | null = null;
  if (candidates.size > 0) {
    const [first, ...rest] = Array.from(candidates);
    userId = first;
    rest.forEach((other) => mergeUsers(store, first, other));
  }

  if (!userId || !store.users[userId]) {
    const created = createUser(now);
    store.users[created.id] = created;
    userId = created.id;
  }

  const user = store.users[userId];
  user.lastSeenAt = now;
  user.fid = fid ?? user.fid;
  user.address = address ?? user.address;
  user.sessionId = sessionId ?? user.sessionId;
  user.username = username ?? user.username;
  user.displayName = displayName ?? user.displayName;
  user.pfpUrl = pfpUrl ?? user.pfpUrl;
  user.source = source ?? user.source;

  if (user.fid) store.aliases.byFid[String(user.fid)] = user.id;
  if (user.address) store.aliases.byAddress[user.address] = user.id;
  if (user.sessionId) store.aliases.bySession[user.sessionId] = user.id;

  return { user, fid: user.fid, address: user.address, sessionId: user.sessionId };
}

function resolveUserByFid(store: GrowthStoreData, fidValue: number, now: number) {
  const fid = normalizeFid(fidValue);
  if (!fid) return null;
  const existingId = store.aliases.byFid[String(fid)];
  if (existingId && store.users[existingId]) {
    const user = store.users[existingId];
    user.lastSeenAt = now;
    return user;
  }
  const user = createUser(now);
  user.fid = fid;
  store.users[user.id] = user;
  store.aliases.byFid[String(fid)] = user.id;
  return user;
}

function addEvent(
  store: GrowthStoreData,
  user: GrowthUserRecord,
  input: TrackEventRequest,
  now: number,
): GrowthEventRecord {
  const eventId = normalizeString(input.eventId, 120) ?? makeId("evt");
  const event: GrowthEventRecord = {
    id: eventId,
    type: input.type,
    ts: typeof input.ts === "number" ? input.ts : now,
    userId: user.id,
    fid: user.fid,
    address: user.address,
    sessionId: user.sessionId,
    source: user.source,
    metadata: sanitizeMetadata(input.metadata),
  };
  store.events.push(event);
  store.processedEventIds[eventId] = now;
  return event;
}

function awardPoints(
  store: GrowthStoreData,
  user: GrowthUserRecord,
  awardId: string,
  points: number,
  reason: string,
  now: number,
  metadata?: JsonMap,
) {
  if (!points) return false;
  if (store.awards.some((award) => award.id === awardId)) {
    return false;
  }
  const record: GrowthPointAward = {
    id: awardId,
    ts: now,
    userId: user.id,
    fid: user.fid,
    reason,
    points,
    metadata: sanitizeMetadata(metadata),
  };
  store.awards.push(record);
  user.points += points;
  return true;
}

function utcDayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function previousUtcDay(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function countAwardsForUserReasonDay(
  store: GrowthStoreData,
  userId: string,
  reason: string,
  day: string,
) {
  return store.awards.filter(
    (award) =>
      award.userId === userId &&
      award.reason === reason &&
      utcDayKey(award.ts) === day,
  ).length;
}

function processOpeningCompletion(
  store: GrowthStoreData,
  user: GrowthUserRecord,
  input: TrackEventRequest,
  now: number,
) {
  const opening = input.opening;
  if (!opening) return;

  const openingId = normalizeString(opening.openingId, 120);
  if (!openingId) return;
  const txHash = normalizeString(opening.txHash ?? null, 140);
  const openingKey = `${user.id}:${openingId}:${txHash ?? "none"}`;
  if (store.processedOpeningKeys[openingKey]) {
    return;
  }

  const wasFirstOpening = user.stats.totalOpenings === 0;

  const openingRecord: GrowthOpeningRecord = {
    id: openingId,
    ts: now,
    userId: user.id,
    fid: user.fid,
    username: user.username,
    displayName: user.displayName,
    pfpUrl: user.pfpUrl,
    caseTypeId: Math.trunc(opening.caseTypeId),
    caseName: normalizeString(opening.caseName, 80) ?? `Case #${opening.caseTypeId}`,
    isFreeCase: Boolean(opening.isFreeCase),
    casePriceUSDC:
      typeof opening.casePriceUSDC === "number" && Number.isFinite(opening.casePriceUSDC)
        ? opening.casePriceUSDC
        : null,
    rewardSymbol: normalizeString(opening.rewardSymbol, 16) ?? "UNKNOWN",
    rewardAmount:
      typeof opening.rewardAmount === "number" && Number.isFinite(opening.rewardAmount)
        ? opening.rewardAmount
        : 0,
    rewardUsd:
      typeof opening.rewardUsd === "number" && Number.isFinite(opening.rewardUsd)
        ? opening.rewardUsd
        : null,
    txHash,
  };
  store.openings.push(openingRecord);
  store.processedOpeningKeys[openingKey] = input.eventId ?? openingKey;

  user.stats.totalOpenings += 1;
  if (openingRecord.isFreeCase) {
    user.stats.miniOpenings += 1;
  } else {
    user.stats.paidOpenings += 1;
  }

  if (openingRecord.isFreeCase) {
    awardPoints(
      store,
      user,
      `award:mini_open:${openingKey}`,
      POINTS.miniOpen,
      "mini_open",
      now,
      { caseTypeId: openingRecord.caseTypeId },
    );

    const day = utcDayKey(now);
    if (user.streaks.lastMiniOpenDay !== day) {
      if (user.streaks.lastMiniOpenDay === previousUtcDay(day)) {
        user.streaks.miniCurrent += 1;
      } else {
        user.streaks.miniCurrent = 1;
      }
      user.streaks.lastMiniOpenDay = day;
      user.streaks.miniBest = Math.max(user.streaks.miniBest, user.streaks.miniCurrent);

      const streakBonus = Math.min(Math.max(user.streaks.miniCurrent - 1, 0) * 10, 200);
      if (streakBonus > 0) {
        awardPoints(
          store,
          user,
          `award:mini_streak:${user.id}:${day}`,
          streakBonus,
          "mini_streak",
          now,
          { streak: user.streaks.miniCurrent },
        );
      }
    }
  } else {
    const priceBonus =
      typeof openingRecord.casePriceUSDC === "number"
        ? Math.max(0, Math.round(openingRecord.casePriceUSDC * POINTS.paidPriceMultiplier))
        : 0;
    awardPoints(
      store,
      user,
      `award:paid_open:${openingKey}`,
      POINTS.paidOpen + priceBonus,
      "paid_open",
      now,
      {
        caseTypeId: openingRecord.caseTypeId,
        priceUSDC: openingRecord.casePriceUSDC ?? 0,
      },
    );
  }

  if (
    wasFirstOpening &&
    user.referredByFid &&
    (!user.fid || user.fid !== user.referredByFid)
  ) {
    const inviter = resolveUserByFid(store, user.referredByFid, now);
    if (inviter) {
      inviter.stats.referralsSent += 1;
      user.stats.referralsConverted += 1;
      awardPoints(
        store,
        inviter,
        `award:referral_inviter:${inviter.id}:${user.id}`,
        POINTS.referralInviterFirstOpen,
        "referral_inviter_first_open",
        now,
        { referredUserId: user.id },
      );
      awardPoints(
        store,
        user,
        `award:referral_invitee:${user.id}`,
        POINTS.referralInviteeFirstOpen,
        "referral_invitee_first_open",
        now,
        { referrerFid: user.referredByFid },
      );
    }
  }
}

function applyEventSideEffects(store: GrowthStoreData, user: GrowthUserRecord, input: TrackEventRequest, now: number) {
  const day = utcDayKey(now);

  switch (input.type) {
    case "app_launch":
      user.stats.appLaunches += 1;
      awardPoints(
        store,
        user,
        `award:app_launch:${user.id}:${day}`,
        POINTS.appLaunchDaily,
        "app_launch_daily",
        now,
      );
      break;
    case "screen_view":
      user.stats.screenViews += 1;
      break;
    case "profile_sync":
      break;
    case "wallet_connected":
      user.stats.walletConnects += 1;
      awardPoints(
        store,
        user,
        `award:wallet_connected:${user.id}`,
        POINTS.walletConnectedOnce,
        "wallet_connected_once",
        now,
      );
      break;
    case "referral_landing": {
      user.stats.referralLandings += 1;
      const referrerFid = normalizeFid(input.referrerFid);
      if (
        referrerFid &&
        (!user.fid || user.fid !== referrerFid) &&
        user.referredByFid === null
      ) {
        user.referredByFid = referrerFid;
        user.referredAt = now;
      }
      break;
    }
    case "share_intent": {
      user.stats.shares += 1;
      const shareAwardCount = countAwardsForUserReasonDay(store, user.id, "share_success_daily", day);
      if (shareAwardCount < 2) {
        awardPoints(
          store,
          user,
          `award:share_intent:${user.id}:${day}:${shareAwardCount + 1}`,
          POINTS.shareIntent,
          "share_success_daily",
          now,
        );
      }
      break;
    }
    case "share_composer_opened":
      user.stats.shareComposers += 1;
      awardPoints(
        store,
        user,
        `award:share_open:${user.id}:${input.eventId ?? makeId("share")}`,
        POINTS.shareSuccess,
        "share_opened",
        now,
      );
      break;
    case "share_native_opened":
      user.stats.shareComposers += 1;
      break;
    case "share_copied":
      user.stats.shareCopies += 1;
      break;
    case "cast_published":
      user.stats.castsPublished += 1;
      awardPoints(
        store,
        user,
        `award:cast_published:${input.eventId ?? makeId("cast")}`,
        POINTS.castPublished,
        "cast_published",
        now,
      );
      break;
    case "open_start":
      break;
    case "opening_completed":
      processOpeningCompletion(store, user, input, now);
      break;
    case "webhook_event":
      break;
    default:
      break;
  }
}

function findUserByActor(store: GrowthStoreData, actor: TrackEventRequest["actor"]) {
  const fid = normalizeFid(actor.fid);
  const address = normalizeAddress(actor.address);
  const sessionId = normalizeString(actor.sessionId, 128);

  const userId =
    (fid ? store.aliases.byFid[String(fid)] : undefined) ??
    (address ? store.aliases.byAddress[address] : undefined) ??
    (sessionId ? store.aliases.bySession[sessionId] : undefined);
  return userId ? store.users[userId] ?? null : null;
}

export async function recordTrackEvent(input: TrackEventRequest) {
  return withStoreMutation((store) => {
    const now = Date.now();
    const incomingEventId = normalizeString(input.eventId, 120);
    if (incomingEventId && store.processedEventIds[incomingEventId]) {
      const existingUser = findUserByActor(store, input.actor);
      return {
        ok: true,
        duplicate: true,
        userId: existingUser?.id ?? null,
        points: existingUser?.points ?? null,
      };
    }

    const { user } = resolveActor(store, input.actor, now);
    addEvent(store, user, { ...input, eventId: incomingEventId ?? undefined }, now);
    applyEventSideEffects(store, user, { ...input, eventId: incomingEventId ?? undefined }, now);

    return {
      ok: true,
      duplicate: false,
      userId: user.id,
      points: user.points,
      streak: user.streaks.miniCurrent,
    };
  });
}

export async function getGrowthSummary(): Promise<GrowthSummaryResponse> {
  return withStoreRead((store) => {
    const users = Object.values(store.users);
    const sorted = [...users].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.stats.totalOpenings !== a.stats.totalOpenings) {
        return b.stats.totalOpenings - a.stats.totalOpenings;
      }
      return a.firstSeenAt - b.firstSeenAt;
    });

    const leaderboard = sorted.slice(0, 20).map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      fid: user.fid,
      username: user.username,
      displayName: user.displayName,
      pfpUrl: user.pfpUrl,
      points: user.points,
      miniCurrentStreak: user.streaks.miniCurrent,
      miniBestStreak: user.streaks.miniBest,
      totalOpenings: user.stats.totalOpenings,
      miniOpenings: user.stats.miniOpenings,
      paidOpenings: user.stats.paidOpenings,
      referralsSent: user.stats.referralsSent,
    }));

    const recentWinners: GrowthRecentWinnerRow[] = [...store.openings]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 15)
      .map((opening) => ({
        id: opening.id,
        ts: opening.ts,
        fid: opening.fid,
        username: opening.username,
        displayName: opening.displayName,
        pfpUrl: opening.pfpUrl,
        caseName: opening.caseName,
        isFreeCase: opening.isFreeCase,
        rewardSymbol: opening.rewardSymbol,
        rewardAmount: opening.rewardAmount,
        rewardUsd: opening.rewardUsd,
      }));

    const totals = {
      users: users.length,
      pointsAwarded: store.awards.reduce((sum, award) => sum + award.points, 0),
      openings: store.openings.length,
      miniOpenings: store.openings.filter((item) => item.isFreeCase).length,
      paidOpenings: store.openings.filter((item) => !item.isFreeCase).length,
    };

    return {
      totals,
      leaderboard,
      recentWinners,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function getGrowthMe(actor: TrackEventRequest["actor"]): Promise<GrowthMeResponse> {
  return withStoreRead((store) => {
    const user = findUserByActor(store, actor);
    if (!user) {
      return {
        found: false,
        user: null,
        recentAwards: [],
        recentOpenings: [],
        updatedAt: new Date().toISOString(),
      };
    }

    const recentAwards = [...store.awards]
      .filter((award) => award.userId === user.id)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10);

    const recentOpenings = [...store.openings]
      .filter((opening) => opening.userId === user.id)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10);

    return {
      found: true,
      user,
      recentAwards,
      recentOpenings,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function recordWebhook(eventType: string, payload: unknown, headers: Headers) {
  return withStoreMutation((store) => {
    const record = {
      id: makeId("wh"),
      ts: Date.now(),
      eventType: normalizeString(eventType, 120) ?? "unknown",
      headers: Object.fromEntries(
        Array.from(headers.entries()).map(([key, value]) => [key, value.slice(0, 300)]),
      ),
      payload,
    };
    store.webhooks.push(record);
    return { ok: true, id: record.id };
  });
}
