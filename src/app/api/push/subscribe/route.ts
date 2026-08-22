import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { saveSubscription, removeSubscription, countSubscriptions, pushConfigured, publicKey } from "@/lib/push";

// Tells the client whether reminders can work at all, and how many devices are
// already signed up, so Settings can say something true rather than offering a
// switch that quietly does nothing.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    configured: pushConfigured(),
    publicKey: publicKey(),
    devices: pushConfigured() ? await countSubscriptions(userId) : 0,
  });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Reminders aren't set up on this server" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await saveSubscription(userId, { endpoint, keys: { p256dh, auth } });
  return NextResponse.json({ ok: true, devices: await countSubscriptions(userId) });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  await removeSubscription(userId, endpoint);
  return NextResponse.json({ ok: true, devices: await countSubscriptions(userId) });
}
