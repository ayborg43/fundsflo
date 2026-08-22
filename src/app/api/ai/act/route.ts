import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById, updateUserCurrency } from "@/lib/users";
import { listAccounts, createAccount, getAccountDetail } from "@/lib/accounts";
import { listCategories, createCategory, deleteCategory } from "@/lib/categories";
import { createBill, markBillPaid, setBillReminder, listBills } from "@/lib/bills";
import { dueDescription } from "@/lib/due";
import { upsertBudget, periodLabel } from "@/lib/budgets";
import { addTransaction, deleteTransaction } from "@/lib/transactions";
import { saveMessage } from "@/lib/ai/messages";
import { isActionName } from "@/lib/ai/tools";
import { formatMoney } from "@/lib/format";
import { directionCopy, balanceSentence } from "@/lib/wording";
import { isCurrencyCode, CURRENCY_CHANGE_CAVEAT } from "@/lib/currency";
import { accountTypes } from "@/lib/db/schema";
import type { AccountType, BudgetPeriod, TransactionType } from "@/lib/types";

// Performs an action the user confirmed on a card.
//
// What arrives here is whatever the card said at the moment they tapped, edits
// included, so nothing is trusted from the earlier model pass: every argument
// is re-validated against what this user actually owns. Confirmations are
// composed here rather than generated -- they state facts about rows that now
// exist, so they should be exact, instant and free.
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
  const action = typeof body?.action === "string" ? body.action : "";
  const values = (body?.values ?? {}) as Record<string, unknown>;
  const userText = typeof body?.userText === "string" ? body.userText.trim() : "";

  if (!isActionName(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const currency = user.currency;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  let confirmation: string;
  const extra: Record<string, unknown> = {};

  switch (action) {
    case "log_transaction": {
      const type = values.type === "make" || values.type === "spend" ? values.type : null;
      const amount = num(values.amount);
      const accountId = text(values.accountId);
      const categoryId = text(values.categoryId) || null;
      const rawDate = text(values.date) || null;

      if (!type) return bad("Invalid type");
      if (!Number.isFinite(amount) || amount <= 0) return bad("Amount must be greater than zero");
      if (!accountId) return bad("Pick an account first");

      const accounts = await listAccounts(userId);
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return missing("Account not found");

      if (categoryId) {
        const categories = await listCategories(userId);
        if (!categories.some((c) => c.id === categoryId)) return missing("Category not found");
      }

      let timestamp: Date | undefined;
      if (rawDate) {
        const parsed = parseCalendarDay(rawDate);
        if (!parsed) return bad("That date doesn't look right");
        timestamp = parsed;
      }

      const rounded = Math.round(amount * 100) / 100;
      const { detail, transactionId } = await addTransaction(userId, accountId, {
        type: type as TransactionType,
        amount: rounded,
        description: text(values.description),
        tag: null,
        categoryId,
        timestamp,
      });

      const copy = directionCopy(account.type, type as TransactionType);
      const label = text(values.description) || copy.band.toLowerCase();
      const when = rawDate ? ` on ${rawDate}` : "";
      confirmation =
        `${copy.verb} ${formatMoney(rounded, currency)} for ${label} ${copy.preposition} ${account.name}${when}. ${copy.emoji}\n` +
        balanceSentence(account.name, account.type, detail.balance, currency);
      // Returned so the chat can offer an Undo on the entry it just made.
      extra.transactionId = transactionId;
      extra.accountId = accountId;
      extra.accounts = await listAccounts(userId);
      break;
    }

    case "create_category": {
      const name = text(values.name).slice(0, 40);
      if (!name) return bad("Give the category a name");
      const existing = await listCategories(userId);
      // Categories are matched by name elsewhere (CSV import, the numbered
      // list the model sees), so a near-duplicate is worse than a rejection.
      if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ error: `You already have a "${name}" category` }, { status: 409 });
      }
      const emojiRaw = text(values.emoji);
      const category = await createCategory(userId, {
        name,
        emoji: emojiRaw ? [...emojiRaw].slice(0, 4).join("") : "🏷️",
      });
      confirmation = `Made you a ${category.emoji} ${category.name} category. Tag spending with it any time.`;
      extra.category = category;
      break;
    }

    case "delete_category": {
      const categoryId = text(values.categoryId);
      const categories = await listCategories(userId);
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return missing("Category not found");
      await deleteCategory(userId, categoryId);
      // Transactions keep their history; the column is ON DELETE SET NULL.
      confirmation = `Deleted the ${category.emoji} ${category.name} category. Transactions that used it are still there, just untagged.`;
      extra.deletedCategoryId = categoryId;
      break;
    }

    case "create_account": {
      const name = text(values.name).slice(0, 40);
      const type = text(values.type);
      if (!name) return bad("Give the account a name");
      if (!(accountTypes as readonly string[]).includes(type)) return bad("Invalid account type");
      const starting = num(values.startingBalance);
      const account = await createAccount(userId, {
        name,
        type: type as AccountType,
        startingBalance: Number.isFinite(starting) && starting > 0 ? starting : null,
      });
      confirmation =
        account.type === "debt"
          ? `Added ${account.name}. You owe ${formatMoney(Math.max(0, -account.balance), currency)} on it.`
          : `Added ${account.name}, starting at ${formatMoney(account.balance, currency)}.`;
      extra.accounts = await listAccounts(userId);
      break;
    }

    case "set_currency": {
      const code = text(values.code).toUpperCase();
      if (!isCurrencyCode(code)) return bad("I don't know that currency yet");
      const updated = await updateUserCurrency(userId, code);
      if (!updated) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      confirmation = `Switched to ${code}. ${CURRENCY_CHANGE_CAVEAT}`;
      extra.currency = code;
      break;
    }

    case "create_bill": {
      const name = text(values.name).slice(0, 60);
      const amount = num(values.amount);
      if (!name) return bad("Give it a name");
      if (!Number.isFinite(amount) || amount <= 0) return bad("Amount must be greater than zero");
      const recurrence = values.recurrence === "once" ? "once" : "monthly";
      const dueDay = num(values.dueDayOfMonth);
      const dueDateRaw = text(values.dueDate);
      const remind = num(values.remindDaysBefore);

      if (recurrence === "once" && !dueDateRaw) return bad("When is it due?");
      const dueDate = recurrence === "once" ? new Date(`${dueDateRaw}T12:00:00Z`) : null;
      if (dueDate && Number.isNaN(dueDate.getTime())) return bad("That date doesn't look right");

      const accountId = text(values.accountId) || null;
      if (accountId) {
        const accounts = await listAccounts(userId);
        if (!accounts.some((a) => a.id === accountId)) return missing("Account not found");
      }
      const categoryId = text(values.categoryId) || null;
      if (categoryId) {
        const categories = await listCategories(userId);
        if (!categories.some((c) => c.id === categoryId)) return missing("Category not found");
      }

      const bill = await createBill(userId, {
        name,
        amount: Math.round(amount * 100) / 100,
        recurrence,
        dueDayOfMonth:
          recurrence === "monthly" && Number.isFinite(dueDay)
            ? Math.min(31, Math.max(1, Math.round(dueDay)))
            : recurrence === "monthly"
              ? 1
              : null,
        dueDate,
        remindDaysBefore: Number.isFinite(remind) && remind > 0 ? Math.round(remind) : null,
        accountId,
        categoryId,
      });

      const reminder = bill.remindDaysBefore
        ? ` I'll remind you ${bill.remindDaysBefore} day${bill.remindDaysBefore === 1 ? "" : "s"} ahead.`
        : "";
      confirmation = `Added ${bill.name}, ${formatMoney(bill.amount, currency)}, ${dueDescription(bill)}.${reminder}`;
      extra.bill = bill;
      break;
    }

    case "mark_bill_paid": {
      const billId = text(values.billId);
      const bill = await markBillPaid(userId, billId);
      if (!bill) return missing("Bill not found");
      confirmation = `Marked ${bill.name} paid.`;
      if (bill.accountId) {
        const detail = await getAccountDetail(userId, bill.accountId);
        if (detail) {
          confirmation += ` ${balanceSentence(detail.name, detail.type, detail.balance, currency)}`;
        }
      }
      extra.accounts = await listAccounts(userId);
      extra.bills = await listBills(userId);
      break;
    }

    case "set_bill_reminder": {
      const billId = text(values.billId);
      const days = num(values.daysBefore);
      const daysBefore = Number.isFinite(days) && days > 0 ? Math.min(30, Math.round(days)) : null;
      const bill = await setBillReminder(userId, billId, daysBefore);
      if (!bill) return missing("Bill not found");
      confirmation = daysBefore
        ? `I'll remind you about ${bill.name} ${daysBefore} day${daysBefore === 1 ? "" : "s"} before it's due.`
        : `Reminders off for ${bill.name}.`;
      extra.bills = await listBills(userId);
      break;
    }

    case "set_budget": {
      const categoryId = text(values.categoryId);
      const amount = num(values.amount);
      const period = (["day", "week", "month"] as const).includes(values.period as BudgetPeriod)
        ? (values.period as BudgetPeriod)
        : "month";
      if (!Number.isFinite(amount) || amount <= 0) return bad("Amount must be greater than zero");
      const categories = await listCategories(userId);
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return missing("Category not found");

      await upsertBudget(userId, {
        categoryId,
        limitAmount: Math.round(amount * 100) / 100,
        period,
      });
      confirmation = `${category.emoji} ${category.name} budget set to ${formatMoney(
        Math.round(amount * 100) / 100,
        currency
      )} ${periodLabel(period)}.`;
      break;
    }
  }

  // Only now does the turn become history -- the user's own words, then the
  // confirmation, so later answers can see what was done and how.
  if (userText) await saveMessage(userId, "user", userText);
  await saveMessage(userId, "assistant", confirmation);

  return NextResponse.json({ confirmation, ...extra });
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function missing(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

// Midday UTC rather than midnight: a backdated entry should land on the day the
// user named no matter which side of UTC they are on, and midnight drifts
// across the date line for anyone west of it.
function parseCalendarDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  if (parsed.getTime() > Date.now()) return null;
  return parsed;
}

// Undo for an entry that was just logged from the chat. Deletes the row and
// files a note in the history, so the transcript stays an honest record of
// what happened rather than quietly losing the exchange.
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
    // deleteTransaction asserts ownership of the account and scopes the delete
    // to it, so an id from another account simply matches nothing.
    detail = await deleteTransaction(userId, accountId, transactionId);
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const user = await findUserById(userId);
  const confirmation = `Undone — took that back off ${detail.name}. ${balanceSentence(
    detail.name,
    detail.type,
    detail.balance,
    user?.currency ?? "USD"
  )}`;
  await saveMessage(userId, "assistant", confirmation);

  return NextResponse.json({ confirmation, accounts: await listAccounts(userId) });
}
