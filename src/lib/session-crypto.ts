import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import fs from "node:fs";
import path from "node:path";

// Local demos remain usable without configuration. The fallback secret is generated once per machine
// and kept in .cache, so hot reloads and restarts do not sign everyone out mid-demo.
let developmentSecret: Buffer | null = null;
function devSecret(): Buffer {
  if (developmentSecret) return developmentSecret;
  const file = path.join(process.cwd(), ".cache", "dev-secret");
  try {
    developmentSecret = fs.readFileSync(file);
  } catch {
    developmentSecret = randomBytes(32);
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, developmentSecret, { mode: 0o600 });
    } catch {
      // read-only disk: in-memory only
    }
  }
  return developmentSecret;
}

function key(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!secret && process.env.NODE_ENV !== "development") {
    throw new Error("Set AUTH_SECRET (or GITHUB_CLIENT_SECRET) before enabling sign-in.");
  }
  return createHash("sha256").update(secret || devSecret()).digest();
}

export function seal(obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function unseal<T>(sealed: string): T | null {
  try {
    const buf = Buffer.from(sealed, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
