import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "./types";

export type Session = SessionUser & { token: string; expiresAt?: number };

export const SESSION_COOKIE = "gh_session";
export const STATE_COOKIE = "gh_oauth_state";
const SESSION_DAYS = 7;

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.GITHUB_CLIENT_SECRET || "ghost-architect-dev-secret";
  return createHash("sha256").update(secret).digest();
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

export function sessionCookieOptions(maxAgeSeconds = SESSION_DAYS * 86400) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeSeconds };
}

/** Full session including the GitHub token. Server-only. */
export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const s = unseal<Session>(raw);
  if (!s || !s.token || !s.login) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) return null; // GitHub App user tokens expire; sign in again (one click)
  return s;
}

/** Safe-to-ship-to-the-client view of the session. */
export async function getUser(): Promise<SessionUser | null> {
  const s = await getSession();
  return s ? { login: s.login, name: s.name, avatar: s.avatar } : null;
}

export function randomState(): string {
  return randomBytes(16).toString("hex");
}

/** Public origin of this deployment: APP_URL if set, else the proxy's forwarded headers, else the request itself. */
export function appOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
