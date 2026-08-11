import { eq, and, desc } from "drizzle-orm";
import { db } from "./db/client";
import { transactions, goals } from "./db/schema";
import type { Account, Transaction, TransactionType } from "./types";

function recomputeBalance(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + (tx.type === "make" ? tx.amount : -tx.amount), 0);
}

export async function getAccount(userId: string): Promise<Account> {
  const [txRows, goalRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.timestamp)),
    db.select().from(goals).where(eq(goals.userId, userId)),
  ]);

  const txs: Transaction[] = txRows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    tag: row.tag,
    timestamp: row.timestamp.toISOString(),
  }));

  return {
    balance: recomputeBalance(txs),
    transactions: txs,
    goals: goalRows.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function addTransaction(
  userId: string,
  input: { type: TransactionType; amount: number; description: string; tag: string | null }
): Promise<Account> {
  await db.insert(transactions).values({
    userId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    tag: input.tag,
  });
  return getAccount(userId);
}

export async function deleteTransaction(userId: string, id: string): Promise<Account> {
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return getAccount(userId);
}

export async function addGoal(
  userId: string,
  input: { name: string; price: number }
): Promise<Account> {
  await db.insert(goals).values({ userId, name: input.name, price: input.price });
  return getAccount(userId);
}

export async function deleteGoal(userId: string, id: string): Promise<Account> {
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  return getAccount(userId);
}
