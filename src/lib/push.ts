// Web push for bill reminders.
//
// Entirely optional: with no VAPID keys configured the app behaves exactly as
// before, and the reminder settings simply report that reminders are not set
// up. Nothing here is reachable without a key, so a deployment that never
// wants push pays nothing for it.
//
// Generate a key pair once with:  npx web-push generate-vapid-keys

import webpush from "web-push";
import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { pushSubscriptions } from "./db/schema";

export type PushPayload = { title: string; body: string; url?: string };

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
  );
}

export function publicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  // The endpoint is unique, so a browser that re-subscribes replaces its own
  // row instead of accumulating duplicates that all deliver the same nudge.
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function countSubscriptions(userId: string): Promise<number> {
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}

// Returns how many devices actually received it. A subscription the browser
// has discarded answers 404/410; delete those rather than retrying forever.
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  ensureConfigured();

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      delivered += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      } else {
        console.error(`[fundsflow] push send failed: ${String(err).slice(0, 200)}`);
      }
    }
  }
  return delivered;
}
