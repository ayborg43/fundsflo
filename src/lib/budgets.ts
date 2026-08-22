import { eq, and, gte, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { budgets, transactions, accounts } from "./db/schema";
import type { Budget, BudgetPeriod } from "./types";

// Calendar periods, not rolling windows: a rolling 7 days makes "am I over
// budget?" answer differently every day, which is useless for a pay cycle.
// Weeks start Monday. Everything is computed in UTC, matching how timestamps
// are stored.
export function periodStart(period: BudgetPeriod, now: Date = new Date()): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (period === "day") return start;
  if (period === "week") {
    const dayOfWeek = (start.getUTCDay() + 6) % 7; // Monday = 0
    start.setUTCDate(start.getUTCDate() - dayOfWeek);
    return start;
  }
  start.setUTCDate(1);
  return start;
}

export function periodLabel(period: BudgetPeriod): string {
  return period === "day" ? "today" : period === "week" ? "this week" : "this month";
}

export async function listBudgets(userId: string): Promise<Budget[]> {
  const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
  if (rows.length === 0) return [];

  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const accountIds = accountRows.map((a) => a.id);
  if (accountIds.length === 0) {
    return rows.map((row) => toBudget(row, 0));
  }

  // One query covering the longest period in play, then each budget counts
  // only the transactions inside its own window.
  const earliest = rows
    .map((row) => periodStart(row.period))
    .reduce((a, b) => (a < b ? a : b));

  const spendRows = await db
    .select({
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      type: transactions.type,
      timestamp: transactions.timestamp,
    })
    .from(transactions)
    .where(and(inArray(transactions.accountId, accountIds), gte(transactions.timestamp, earliest)));

  return rows.map((row) => {
    const start = periodStart(row.period);
    const spent = spendRows.reduce((sum, tx) => {
      if (tx.type !== "spend" || tx.categoryId !== row.categoryId) return sum;
      return tx.timestamp >= start ? sum + tx.amount : sum;
    }, 0);
    return toBudget(row, spent);
  });
}

function toBudget(row: typeof budgets.$inferSelect, spent: number): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    period: row.period,
    limitAmount: row.limitAmount,
    spentThisPeriod: spent,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createBudget(
  userId: string,
  input: { categoryId: string; limitAmount: number; period: BudgetPeriod }
): Promise<Budget> {
  const [created] = await db
    .insert(budgets)
    .values({
      userId,
      categoryId: input.categoryId,
      limitAmount: input.limitAmount,
      period: input.period,
    })
    .returning();
  return toBudget(created, 0);
}

// Setting a budget for a category that already has one should change it, not
// stack a second limit on the same category.
export async function upsertBudget(
  userId: string,
  input: { categoryId: string; limitAmount: number; period: BudgetPeriod }
): Promise<Budget> {
  const [existing] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, input.categoryId)))
    .limit(1);

  if (!existing) return createBudget(userId, input);

  const [updated] = await db
    .update(budgets)
    .set({ limitAmount: input.limitAmount, period: input.period })
    .where(eq(budgets.id, existing.id))
    .returning();
  return toBudget(updated, 0);
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}
