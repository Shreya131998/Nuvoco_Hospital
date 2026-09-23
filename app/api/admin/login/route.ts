import { NextResponse } from "next/server";
import {
  SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, isAuthConfigured, makeSessionValue,
} from "@/lib/auth";

/** Tracks recent failures per IP so the shared password cannot be brute-forced
 *  at full speed. Per-instance only — good enough to blunt a script, and the
 *  delay below costs a real admin nothing. */
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60_000;
const MAX_ATTEMPTS = 10;

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set ADMIN_PASSWORD and AUTH_SECRET." },
      { status: 500 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && now - rec.first > WINDOW) attempts.delete(ip);
  const current = attempts.get(ip);
  if (current && current.n >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!checkPassword(password)) {
    const c = attempts.get(ip);
    attempts.set(ip, { n: (c?.n ?? 0) + 1, first: c?.first ?? now });
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
