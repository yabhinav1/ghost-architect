import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Local demos remain usable without configuration; restarting signs these sessions out.
const developmentSecret = randomBytes(32);

function key(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!secret && process.env.NODE_ENV !== "development") {
    throw new Error("Set AUTH_SECRET (or GITHUB_CLIENT_SECRET) before enabling sign-in.");
  }
  return createHash("sha256").update(secret || developmentSecret).digest();
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
