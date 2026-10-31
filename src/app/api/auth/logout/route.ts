import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0) });
  return res;
}
