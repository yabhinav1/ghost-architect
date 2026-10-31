import { randomBytes } from "node:crypto";
import { unseal } from "./session-crypto.ts";
export { seal, unseal } from "./session-crypto.ts";
import { cookies } from "next/headers";
import type { SessionUser } from "./types.ts";

export type Session = SessionUser & { token: string; expiresAt?: number };

export const SESSION_COOKIE = "gh_session";
export const STATE_COOKIE = "gh_oauth_state";
const SESSION_DAYS = 7;

export function sessionCookieOptions(maxAgeSeconds = SESSION_DAYS * 86400) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeSeconds };
}

/** Full session including the GitHub token. Server-only. */
export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const s = unseal<Session>(raw);
  if (!s || !s.login) return null; // dev sessions have an empty token: signed in, but no GitHub access
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
