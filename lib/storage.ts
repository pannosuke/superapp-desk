import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";
import { storageMode } from "@/lib/env";
import type { FeedItem } from "@/lib/types";

type MemoryState = {
  items: FeedItem[];
  links: Record<string, string>;
};

const globalStore = globalThis as unknown as { __deskMemory?: MemoryState };

function memory(): MemoryState {
  if (!globalStore.__deskMemory) {
    globalStore.__deskMemory = { items: [], links: {} };
  }
  return globalStore.__deskMemory;
}

function redisClient() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function neonSql() {
  const url =
    process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

let neonReady: Promise<void> | null = null;

async function ensureNeon() {
  const sql = neonSql();
  if (!sql) return;
  if (!neonReady) {
    neonReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS desk_feed (
          id TEXT PRIMARY KEY,
          idempotency_key TEXT UNIQUE NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS desk_flags (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `;
    })();
  }
  await neonReady;
}

export async function listFeed(): Promise<FeedItem[]> {
  const mode = storageMode();
  if (mode === "upstash") {
    const items = await redisClient()!.get<FeedItem[]>("desk:feed");
    return items ?? [];
  }
  if (mode === "neon") {
    await ensureNeon();
    const sql = neonSql()!;
    const rows = await sql`SELECT payload FROM desk_feed ORDER BY created_at DESC`;
    return rows.map((row) => row.payload as FeedItem);
  }
  return [...memory().items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findFeedByIdempotency(key: string) {
  const items = await listFeed();
  return items.find((item) => item.idempotencyKey === key) ?? null;
}

export async function findFeed(id: string) {
  const items = await listFeed();
  return items.find((item) => item.id === id) ?? null;
}

async function writeAll(items: FeedItem[]) {
  const mode = storageMode();
  if (mode === "upstash") {
    await redisClient()!.set("desk:feed", items);
    return;
  }
  if (mode === "neon") {
    await ensureNeon();
    const sql = neonSql()!;
    await sql`DELETE FROM desk_feed`;
    for (const item of items) {
      await sql`
        INSERT INTO desk_feed (id, idempotency_key, payload, created_at)
        VALUES (${item.id}, ${item.idempotencyKey}, ${JSON.stringify(item)}::jsonb, ${item.createdAt})
      `;
    }
    return;
  }
  memory().items = items;
}

export async function insertFeed(item: FeedItem) {
  const items = await listFeed();
  items.unshift(item);
  await writeAll(items);
  return item;
}

export async function updateFeed(
  id: string,
  patch: Partial<FeedItem>,
): Promise<FeedItem | null> {
  const items = await listFeed();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const next = { ...items[index], ...patch, id: items[index].id };
  items[index] = next;
  await writeAll(items);
  return next;
}

export async function getMeetingLink(eventId: string) {
  const mode = storageMode();
  if (mode === "upstash") {
    const links = (await redisClient()!.get<Record<string, string>>("desk:meeting-links")) ?? {};
    return links[eventId] ?? null;
  }
  if (mode === "neon") {
    await ensureNeon();
    const sql = neonSql()!;
    const rows = await sql`SELECT value FROM desk_flags WHERE key = ${`meeting:${eventId}`} LIMIT 1`;
    return (rows[0]?.value as string | undefined) ?? null;
  }
  return memory().links[eventId] ?? null;
}

export async function setMeetingLink(eventId: string, url: string | null) {
  const mode = storageMode();
  if (mode === "upstash") {
    const redis = redisClient()!;
    const links = (await redis.get<Record<string, string>>("desk:meeting-links")) ?? {};
    if (url) links[eventId] = url;
    else delete links[eventId];
    await redis.set("desk:meeting-links", links);
    return;
  }
  if (mode === "neon") {
    await ensureNeon();
    const sql = neonSql()!;
    const key = `meeting:${eventId}`;
    if (!url) {
      await sql`DELETE FROM desk_flags WHERE key = ${key}`;
      return;
    }
    await sql`
      INSERT INTO desk_flags (key, value) VALUES (${key}, ${url})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    return;
  }
  if (url) memory().links[eventId] = url;
  else delete memory().links[eventId];
}
