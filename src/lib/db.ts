import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cacheDir } from "./git.ts";
import { storeEnabled, storeGet, storeSet } from "./store.ts";

/**
 * Tiny document store for the organisation layer: one JSON file per record under
 * .cache/db/<collection>/, with an id index per collection. Mirrored to Upstash when configured
 * so records survive redeploys on an ephemeral disk. Not a database; fine for a hackathon product.
 */
export type Collection = "orgs" | "members" | "invites" | "orgRepos" | "notices" | "handovers" | "audit";

const dir = (c: Collection) => cacheDir("db", c);
const file = (c: Collection, id: string) => path.join(dir(c), encodeURIComponent(id) + ".json");
const indexKey = (c: Collection) => `db:${c}:index`;
const recKey = (c: Collection, id: string) => `db:${c}:${id}`;
const persistent = { persistent: true };
const collections: Collection[] = ["orgs", "members", "invites", "orgRepos", "notices", "handovers", "audit"];

// The local document store runs on one server. Serialize collection mutations so simultaneous
// requests cannot overwrite one another's index additions or interleave record writes.
const pending = new Map<Collection, Promise<unknown>>();
function serial<T>(c: Collection, fn: () => Promise<T>): Promise<T> {
  const task = (pending.get(c) ?? Promise.resolve()).catch(() => undefined).then(fn);
  pending.set(c, task);
  void task.finally(() => { if (pending.get(c) === task) pending.delete(c); }).catch(() => undefined);
  return task;
}

export function newId(prefix = ""): string {
  return prefix + randomBytes(9).toString("base64url");
}

async function readIndex(c: Collection): Promise<string[]> {
  let local: string[] = [];
  try {
    const names = await fs.readdir(dir(c));
    local = names.filter((n) => n.endsWith(".json")).map((n) => decodeURIComponent(n.slice(0, -5)));
  } catch {
    // no local records yet
  }
  const remote = await storeGet<string[]>(indexKey(c), { strict: true });
  // A partially restored local directory must not hide records still in Redis.
  return [...new Set([...local, ...(remote ?? [])])];
}

export async function get<T>(c: Collection, id: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file(c, id), "utf8")) as T;
  } catch {
    const remote = await storeGet<T>(recKey(c, id), { strict: true });
    if (remote) {
      await fs.mkdir(dir(c), { recursive: true });
      await fs.writeFile(file(c, id), JSON.stringify(remote));
    }
    return remote;
  }
}

export async function put<T extends { id: string }>(c: Collection, rec: T): Promise<T> {
  return serial(c, async () => {
    const ids = await readIndex(c);
    await storeSet(recKey(c, rec.id), rec, persistent);
    await storeSet(indexKey(c), [...new Set([...ids, rec.id])], persistent);
    await fs.mkdir(dir(c), { recursive: true });
    await fs.writeFile(file(c, rec.id), JSON.stringify(rec));
    return rec;
  });
}

export async function del(c: Collection, id: string): Promise<void> {
  return serial(c, async () => {
    const ids = (await readIndex(c)).filter((x) => x !== id);
    await storeSet(recKey(c, id), null, persistent);
    await storeSet(indexKey(c), ids, persistent);
    await fs.rm(file(c, id), { force: true });
  });
}

/** Repair indexes from pre-fix local data and remove the old TTL from existing records. */
export async function repairDurableRecords(): Promise<void> {
  if (!storeEnabled) return;
  for (const c of collections) {
    await serial(c, async () => {
      const ids = await readIndex(c);
      const live: string[] = [];
      for (const id of ids) {
        const rec = await get<{ id: string }>(c, id);
        if (!rec) continue;
        await storeSet(recKey(c, id), rec, persistent);
        live.push(id);
      }
      await storeSet(indexKey(c), live, persistent);
    });
  }
}

export async function list<T>(c: Collection, filter?: (r: T) => boolean): Promise<T[]> {
  const ids = await readIndex(c);
  const out: T[] = [];
  for (const id of ids) {
    const r = await get<T>(c, id);
    if (r && (!filter || filter(r))) out.push(r);
  }
  return out;
}
