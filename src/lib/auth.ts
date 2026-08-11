import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "freeze_fund_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export async function createSession(userId: string): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = encodeSession(userId, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
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
