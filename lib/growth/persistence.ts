import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { GrowthStoreData } from "@/lib/growth/types";

const FILE_DATA_DIR = path.join(process.cwd(), ".data");
const FILE_DATA_PATH = path.join(FILE_DATA_DIR, "growth-store.json");

const REDIS_REST_URL =
  process.env.GROWTH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || null;
const REDIS_REST_TOKEN =
  process.env.GROWTH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;
const REDIS_STORE_KEY = process.env.GROWTH_REDIS_STORE_KEY || "case:growth:store:v1";
const REDIS_LOCK_KEY = process.env.GROWTH_REDIS_LOCK_KEY || "case:growth:lock:v1";

const hasRedisPersistence = Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);

async function redisCommand<T = unknown>(...command: Array<string | number>) {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) {
    throw new Error("Redis REST persistence is not configured.");
  }

  const response = await fetch(`${REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis REST error: ${response.status}`);
  }

  const payload = (await response.json()) as Array<{ result?: T; error?: string }>;
  const first = payload[0];
  if (!first) return undefined as T;
  if (first.error) {
    throw new Error(first.error);
  }
  return first.result as T;
}

async function readFromFile(makeEmpty: () => GrowthStoreData) {
  try {
    const raw = await readFile(FILE_DATA_PATH, "utf8");
    return JSON.parse(raw) as GrowthStoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return makeEmpty();
    }
    throw error;
  }
}

async function writeToFile(store: GrowthStoreData) {
  await mkdir(FILE_DATA_DIR, { recursive: true });
  await writeFile(FILE_DATA_PATH, JSON.stringify(store, null, 2));
}

export async function loadGrowthStore(makeEmpty: () => GrowthStoreData) {
  if (!hasRedisPersistence) {
    return readFromFile(makeEmpty);
  }

  const raw = await redisCommand<string | null>("GET", REDIS_STORE_KEY);
  if (!raw) {
    return makeEmpty();
  }
  try {
    return JSON.parse(raw) as GrowthStoreData;
  } catch (error) {
    console.warn("Failed to parse Redis growth store payload, resetting.", error);
    return makeEmpty();
  }
}

export async function saveGrowthStore(store: GrowthStoreData) {
  if (!hasRedisPersistence) {
    await writeToFile(store);
    return;
  }
  await redisCommand("SET", REDIS_STORE_KEY, JSON.stringify(store));
}

async function acquireRedisLock(lockToken: string, timeoutMs = 8000, ttlMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await redisCommand<string | null>(
      "SET",
      REDIS_LOCK_KEY,
      lockToken,
      "NX",
      "PX",
      ttlMs,
    );
    if (result === "OK") {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.floor(Math.random() * 100)));
  }
  return false;
}

async function releaseRedisLock(lockToken: string) {
  try {
    const current = await redisCommand<string | null>("GET", REDIS_LOCK_KEY);
    if (current === lockToken) {
      await redisCommand("DEL", REDIS_LOCK_KEY);
    }
  } catch (error) {
    console.warn("Failed to release Redis growth lock", error);
  }
}

export async function withPersistentGrowthLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!hasRedisPersistence) {
    return fn();
  }

  const token = `lock_${randomUUID()}`;
  const acquired = await acquireRedisLock(token);
  if (!acquired) {
    throw new Error("Could not acquire growth store lock.");
  }

  try {
    return await fn();
  } finally {
    await releaseRedisLock(token);
  }
}

export function growthPersistenceMode() {
  return hasRedisPersistence ? "redis" : "file";
}

