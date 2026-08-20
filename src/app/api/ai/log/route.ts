import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { listAccounts } from "@/lib/accounts";
import { listCategories } from "@/lib/categories";
import { addTransaction, deleteTransaction } from "@/lib/transactions";
import { saveMessage } from "@/lib/ai/messages";
import { formatMoney } from "@/lib/format";

// Commits a draft the user confirmed on the chat card. The draft that arrives
// here is whatever is on the card at that moment, edits included, so nothing
// is trusted from the earlier classifier pass -- amount, account and category
// are all re-validated against what this user actually owns.
//
// The confirmation reply is composed here rather than by the model: it is a
// statement of fact about a row that now exists, so it should be exact, free
// and instant, not generated.
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const accountId = body?.accountId;
  const rawAmount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : null;
  const userText = typeof body?.userText === "string" ? body.userText.trim() : "";

  if (type !== "make" && type !== "spend") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }
  if (typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Pick an account first" }, { status: 400 });
  }

  const accounts = await listAccounts(userId);
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // addTransaction checks account ownership but not the category, so verify it
  // here rather than letting one user attach another user's category.
  if (categoryId) {
    const categories = await listCategories(userId);
    if (!categories.some((c) => c.id === categoryId)) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
  }

  // The card sends a calendar day; re-validate rather than trusting it, since
  // the client can send anything. Null means "now".
  const rawDate = typeof body?.date === "string" ? body.date : null;
  let timestamp: Date | undefined;
  if (rawDate) {
    const parsed = parseCalendarDay(rawDate);
    if (!parsed) {
      return NextResponse.json({ error: "That date doesn't look right" }, { status: 400 });
    }
    timestamp = parsed;
  }

  const amount = Math.round(rawAmount * 100) / 100;
  const { detail, transactionId } = await addTransaction(userId, accountId, {
    type,
    amount,
    description,
    tag: null,
    categoryId,
    timestamp,
  });

  const label = description || (type === "make" ? "money in" : "money out");
  const verb = type === "make" ? "Added" : "Logged";
  const emoji = type === "make" ? "🤑" : "💸";
  const when = rawDate ? ` on ${rawDate}` : "";
  const confirmation =
    `${verb} ${formatMoney(amount, user.currency)} for ${label} in ${account.name}${when}. ${emoji}\n` +
    `${account.name} is now ${formatMoney(detail.balance, user.currency)}.`;

  // Only now does the turn become history -- the user's own words, then the
  // confirmation, so later answers can see what was logged and how.
  if (userText) {
    await saveMessage(userId, "user", userText);
  }
  await saveMessage(userId, "assistant", confirmation);

  return NextResponse.json({
    confirmation,
    // Returned so the chat can offer an Undo on the entry it just made.
    transactionId,
    accountId,
    account: { id: detail.id, name: detail.name, balance: detail.balance },
    // The chat's balance strip needs the whole list, but only this one account
    // moved -- patch the list already in hand instead of re-querying it all.
    accounts: accounts.map((a) => (a.id === accountId ? { ...a, balance: detail.balance } : a)),
  });
}

// Midday UTC rather than midnight: a backdated entry should land on the day the
// user named no matter which side of UTC they're on, and midnight drifts across
// the date line for anyone west of it.
function parseCalendarDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  if (parsed.getTime() > Date.now()) return null;
  return parsed;
}

// Undo for an entry that was just logged from the chat. Deletes the row and
// files a note in the history, so the transcript stays an honest record of what
// happened rather than quietly losing the exchange.
export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
  if (!accountId || !transactionId) {
    return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
  }

  let detail;
  try {
    // deleteTransaction asserts ownership of the account, and scopes the delete
    // to it, so a transaction id from another account simply matches nothing.
    detail = await deleteTransaction(userId, accountId, transactionId);
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const user = await findUserById(userId);
  const confirmation = `Undone — took that back off ${detail.name}. It's at ${formatMoney(
    detail.balance,
    user?.currency ?? "USD"
  )} again.`;
  await saveMessage(userId, "assistant", confirmation);

  return NextResponse.json({
    confirmation,
    accounts: await listAccounts(userId),
  });
}
