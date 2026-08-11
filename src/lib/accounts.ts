import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "./db/client";
import { accounts, transactions, goals } from "./db/schema";
import type { AccountSummary, AccountDetail, AccountType, Transaction, Goal } from "./types";

export function recomputeBalance(txs: { type: "make" | "spend"; amount: number }[]): number {
  return txs.reduce((sum, tx) => sum + (tx.type === "make" ? tx.amount : -tx.amount), 0);
}

export async function listAccounts(userId: string): Promise<AccountSummary[]> {
  const accountRows = await db.select().from(accounts).where(eq(accounts.userId, userId));
  if (accountRows.length === 0) return [];

  const accountIds = accountRows.map((a) => a.id);
  const txRows = await db
    .select({ accountId: transactions.accountId, type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(inArray(transactions.accountId, accountIds));

  const balanceByAccount = new Map<string, number>();
  for (const row of txRows) {
    const prev = balanceByAccount.get(row.accountId) ?? 0;
    balanceByAccount.set(row.accountId, prev + (row.type === "make" ? row.amount : -row.amount));
  }

  return accountRows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    startingBalance: row.startingBalance,
    balance: balanceByAccount.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createAccount(
  userId: string,
  input: { name: string; type: AccountType; startingBalance?: number | null }
): Promise<AccountSummary> {
  const [created] = await db
    .insert(accounts)
    .values({
      userId,
      name: input.name,
      type: input.type,
      startingBalance: input.startingBalance ?? null,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    type: created.type as AccountType,
    startingBalance: created.startingBalance,
    balance: 0,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  await db.delete(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
}

export async function getAccountDetail(
  userId: string,
  accountId: string
): Promise<AccountDetail | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) return null;

  const [txRows, goalRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.timestamp)),
    db.select().from(goals).where(eq(goals.accountId, accountId)),
  ]);

  const txs: Transaction[] = txRows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    tag: row.tag,
    categoryId: row.categoryId,
    timestamp: row.timestamp.toISOString(),
  }));

  const goalList: Goal[] = goalRows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    id: account.id,
    name: account.name,
    type: account.type as AccountType,
    startingBalance: account.startingBalance,
    balance: recomputeBalance(txs),
    transactions: txs,
    goals: goalList,
  };
}
