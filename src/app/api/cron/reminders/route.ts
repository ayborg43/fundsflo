import { NextRequest, NextResponse } from "next/server";
import { listBillsWithReminders, markReminded } from "@/lib/bills";
import { daysUntilDue } from "@/lib/due";
import { sendToUser, pushConfigured } from "@/lib/push";

// Sends bill reminders. Meant to be called once a day by a scheduler -- on
// Dokploy, a scheduled task hitting this URL. There is no in-process timer on
// purpose: a setInterval dies with the container and fires N times over N
// replicas, whereas a scheduler is visible, retryable and testable with curl.
//
// Guarded by a shared secret rather than a session, since no user is present.
// Without CRON_SECRET set the endpoint refuses outright rather than running
// open to the internet.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  }

  const rows = await listBillsWithReminders();
  const now = new Date();
  let sent = 0;
  let considered = 0;

  for (const { userId, bill, lastRemindedAt } of rows) {
    considered += 1;
    const days = daysUntilDue(bill, now);
    if (days === null || bill.remindDaysBefore === null) continue;
    // Nudge from the lead time right up to the due day, not only on the exact
    // day -- a job that misses one run should still catch the bill.
    if (days > bill.remindDaysBefore || days < 0) continue;

    // At most one reminder per bill per day, so a scheduler firing hourly (or
    // retrying) doesn't spam.
    if (lastRemindedAt && now.getTime() - lastRemindedAt.getTime() < 20 * 60 * 60 * 1000) continue;

    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const delivered = await sendToUser(userId, {
      title: `${bill.name} is due ${when}`,
      body: `Tap to mark it paid when you have.`,
      url: "/bills",
    });
    if (delivered > 0) {
      await markReminded(bill.id);
      sent += 1;
    }
  }

  return NextResponse.json({ considered, sent });
}
