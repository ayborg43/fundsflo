import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { findUserById } from "./users";
import type { User } from "./types";

const COOKIE_NAME = "freeze_fund_session";
const REMEMBERED_SECONDS = 60 * 60 * 24 * 30; // 30 days
const NOT_REMEMBERED_SECONDS = 60 * 60 * 24; // 1 day

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return "dev-only-insecure-secret";
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encodeSession(userId: string, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: expiresAt })).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): { uid: string; exp: number } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, rememberMe: boolean = true): Promise<void> {
  const durationSeconds = rememberMe ? REMEMBERED_SECONDS : NOT_REMEMBERED_SECONDS;
  const expiresAt = Date.now() + durationSeconds * 1000;
  const token = encodeSession(userId, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Omit maxAge when not remembered so it's a browser session cookie
    // (cleared on browser close); the signed exp inside the token still
    // caps it at NOT_REMEMBERED_SECONDS server-side as a fallback.
    ...(rememberMe ? { maxAge: durationSeconds } : {}),
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = decodeSession(token);
  return session?.uid ?? null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// The session cookie can be validly signed while pointing at a user that no
// longer exists (e.g. deleted, or a dev DB reset). Always resolve through
// here rather than trusting getSessionUserId() alone, so a dead session
// reads as "logged out" instead of endlessly bouncing between "/" and
// "/login". This is called from Server Components, which can't mutate
// cookies, so it deliberately does not clear the stale cookie itself —
// that happens naturally on the next real login/logout.
export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await findUserById(userId);
  return user ?? null;
}
