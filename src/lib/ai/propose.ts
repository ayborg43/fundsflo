// Turns the model's tool calls into proposals the user can inspect and edit.
//
// Nothing here writes. Two jobs: resolve the model's list numbers into real
// ids, and refuse anything that does not survive validation -- a bad number
// degrades to "unspecified" rather than a hallucinated foreign key, and a
// nonsense date becomes "now" rather than a wrong timestamp.

import type { ToolCall } from "./client";
import { isActionName, type ActionName } from "./tools";
import type { AccountSummary, Bill, Category, BudgetPeriod } from "../types";
import { isCurrencyCode } from "../currency";
import { accountTypes } from "../db/schema";

export type Proposal = {
  action: ActionName;
  values: Record<string, unknown>;
};

export type ProposalContext = {
  accounts: AccountSummary[];
  categories: Category[];
  bills: Bill[];
  defaultAccountId: string | null;
  today: string;
};

const MAX_BACKDATE_DAYS = 3650;

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function pickByIndex<T>(value: unknown, list: T[]): T | null {
  const index = num(value);
  if (index === null || !Number.isInteger(index) || index < 1 || index > list.length) return null;
  return list[index - 1];
}

// Accept only a real past-or-today calendar day; anything else means "now".
export function normalizeDate(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  if (value > today) return null;
  const ageDays = (Date.parse(`${today}T00:00:00Z`) - parsed.getTime()) / 86_400_000;
  if (ageDays > MAX_BACKDATE_DAYS) return null;
  return value === today ? null : value;
}

// A due date, unlike a transaction date, is allowed to be in the future --
// that is the whole point of it.
function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function matchBill(bills: Bill[], value: unknown): Bill | null {
  const needle = str(value, 60).toLowerCase();
  if (!needle) return null;
  return (
    bills.find((b) => b.name.toLowerCase() === needle) ??
    bills.find((b) => b.name.toLowerCase().includes(needle)) ??
    bills.find((b) => needle.includes(b.name.toLowerCase())) ??
    null
  );
}

export function proposalsFrom(calls: ToolCall[], ctx: ProposalContext): Proposal[] {
  const out: Proposal[] = [];

  for (const call of calls) {
    if (!isActionName(call.name)) continue;
    const a = call.args;

    switch (call.name) {
      case "log_transaction": {
        const amount = num(a.amount);
        const type = a.type === "make" || a.type === "spend" ? a.type : null;
        if (!type || amount === null || amount <= 0) break;
        const named = pickByIndex(a.account, ctx.accounts);
        // Fall back to the configured default, then to the only account if
        // there is exactly one. With several and no hint, leave it unset so
        // the card asks rather than quietly picking wrong.
        const fallback =
          ctx.accounts.find((x) => x.id === ctx.defaultAccountId) ??
          (ctx.accounts.length === 1 ? ctx.accounts[0] : null);
        out.push({
          action: "log_transaction",
          values: {
            type,
            amount: Math.round(amount * 100) / 100,
            description: str(a.description, 80),
            accountId: (named ?? fallback)?.id ?? null,
            categoryId: pickByIndex(a.category, ctx.categories)?.id ?? null,
            date: normalizeDate(a.date, ctx.today),
          },
        });
        break;
      }

      case "create_category": {
        const name = str(a.name, 40);
        if (!name) break;
        const emojiRaw = str(a.emoji, 12);
        out.push({
          action: "create_category",
          values: { name, emoji: emojiRaw ? [...emojiRaw].slice(0, 4).join("") : "🏷️" },
        });
        break;
      }

      case "delete_category": {
        const category = pickByIndex(a.category, ctx.categories);
        if (!category) break;
        out.push({
          action: "delete_category",
          values: { categoryId: category.id, name: category.name, emoji: category.emoji },
        });
        break;
      }

      case "create_account": {
        const name = str(a.name, 40);
        const type = typeof a.type === "string" && (accountTypes as readonly string[]).includes(a.type)
          ? a.type
          : null;
        if (!name || !type) break;
        const starting = num(a.starting_balance);
        out.push({
          action: "create_account",
          values: {
            name,
            type,
            startingBalance: type === "debt" && starting !== null && starting > 0 ? starting : null,
          },
        });
        break;
      }

      case "set_currency": {
        const code = str(a.code, 8).toUpperCase();
        if (!isCurrencyCode(code)) break;
        out.push({ action: "set_currency", values: { code } });
        break;
      }

      case "create_bill": {
        const name = str(a.name, 60);
        const amount = num(a.amount);
        if (!name || amount === null || amount <= 0) break;
        const recurrence = a.recurrence === "once" ? "once" : "monthly";
        const dueDay = num(a.due_day);
        const remind = num(a.remind_days_before);
        out.push({
          action: "create_bill",
          values: {
            name,
            amount: Math.round(amount * 100) / 100,
            recurrence,
            dueDayOfMonth:
              recurrence === "monthly" && dueDay !== null
                ? Math.min(31, Math.max(1, Math.round(dueDay)))
                : recurrence === "monthly"
                  ? 1
                  : null,
            dueDate: recurrence === "once" ? normalizeDueDate(a.due_date) : null,
            remindDaysBefore:
              remind !== null && remind > 0 ? Math.min(30, Math.round(remind)) : null,
            accountId: pickByIndex(a.account, ctx.accounts)?.id ?? null,
            categoryId: pickByIndex(a.category, ctx.categories)?.id ?? null,
          },
        });
        break;
      }

      case "mark_bill_paid": {
        const bill = matchBill(ctx.bills, a.bill);
        if (!bill) break;
        out.push({
          action: "mark_bill_paid",
          values: { billId: bill.id, name: bill.name, amount: bill.amount },
        });
        break;
      }

      case "set_bill_reminder": {
        const bill = matchBill(ctx.bills, a.bill);
        if (!bill) break;
        const days = num(a.days_before);
        out.push({
          action: "set_bill_reminder",
          values: {
            billId: bill.id,
            name: bill.name,
            daysBefore: days === null || days <= 0 ? 0 : Math.min(30, Math.round(days)),
          },
        });
        break;
      }

      case "set_budget": {
        const category = pickByIndex(a.category, ctx.categories);
        const amount = num(a.amount);
        if (!category || amount === null || amount <= 0) break;
        const period: BudgetPeriod =
          a.period === "day" || a.period === "week" ? a.period : "month";
        out.push({
          action: "set_budget",
          values: {
            categoryId: category.id,
            amount: Math.round(amount * 100) / 100,
            period,
          },
        });
        break;
      }
    }
  }

  return out;
}
