import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cacheDir } from "./git.ts";
import { storeGet, storeSet } from "./store.ts";

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

export function newId(prefix = ""): string {
  return prefix + randomBytes(9).toString("base64url");
}

async function readIndex(c: Collection): Promise<string[]> {
  try {
    const names = await fs.readdir(dir(c));
    const ids = names.filter((n) => n.endsWith(".json")).map((n) => decodeURIComponent(n.slice(0, -5)));
    if (ids.length) return ids;
  } catch {
    // no local records yet
  }
  const remote = await storeGet<string[]>(indexKey(c));
  if (remote?.length) {
    // rehydrate the local directory from the durable store
    await fs.mkdir(dir(c), { recursive: true });
    for (const id of remote) {
      const rec = await storeGet<unknown>(recKey(c, id));
      if (rec) await fs.writeFile(file(c, id), JSON.stringify(rec));
    }
    return remote;
  }
  return [];
}

export async function get<T>(c: Collection, id: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file(c, id), "utf8")) as T;
  } catch {
    const remote = await storeGet<T>(recKey(c, id));
    if (remote) {
      await fs.mkdir(dir(c), { recursive: true });
      await fs.writeFile(file(c, id), JSON.stringify(remote));
    }
    return remote;
  }
}

export async function put<T extends { id: string }>(c: Collection, rec: T): Promise<T> {
  await fs.mkdir(dir(c), { recursive: true });
  await fs.writeFile(file(c, rec.id), JSON.stringify(rec));
  await storeSet(recKey(c, rec.id), rec);
  const ids = await readIndex(c);
  if (!ids.includes(rec.id)) await storeSet(indexKey(c), [...ids, rec.id]);
  return rec;
}

export async function del(c: Collection, id: string): Promise<void> {
  await fs.rm(file(c, id), { force: true });
  const ids = (await readIndex(c)).filter((x) => x !== id);
  await storeSet(indexKey(c), ids);
  await storeSet(recKey(c, id), null);
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
