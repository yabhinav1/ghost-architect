import { NextResponse } from "next/server";
import { appOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const res = NextResponse.redirect(`${appOrigin(request)}/`);
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0) });
  return res;
}
