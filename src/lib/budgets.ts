import { eq, and, gte, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { budgets, transactions, accounts } from "./db/schema";
import type { Budget } from "./types";

export async function listBudgets(userId: string): Promise<Budget[]> {
  const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
  if (rows.length === 0) return [];

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const accountIds = accountRows.map((a) => a.id);

  const spendRows =
    accountIds.length > 0
      ? await db
          .select({ categoryId: transactions.categoryId, amount: transactions.amount, type: transactions.type })
          .from(transactions)
          .where(and(inArray(transactions.accountId, accountIds), gte(transactions.timestamp, startOfMonth)))
      : [];

  const spentByCategory = new Map<string, number>();
  for (const row of spendRows) {
    if (row.type !== "spend" || !row.categoryId) continue;
    spentByCategory.set(row.categoryId, (spentByCategory.get(row.categoryId) ?? 0) + row.amount);
  }

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    monthlyLimit: row.monthlyLimit,
    spentThisMonth: spentByCategory.get(row.categoryId) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createBudget(
  userId: string,
  input: { categoryId: string; monthlyLimit: number }
): Promise<Budget> {
  const [created] = await db
    .insert(budgets)
    .values({ userId, categoryId: input.categoryId, monthlyLimit: input.monthlyLimit })
    .returning();
  return {
    id: created.id,
    categoryId: created.categoryId,
    monthlyLimit: created.monthlyLimit,
    spentThisMonth: 0,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}
