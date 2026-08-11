import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { accounts, transactions, goals } from "./db/schema";
import { getAccountDetail } from "./accounts";
import type { AccountDetail, TransactionType } from "./types";

async function assertOwnsAccount(userId: string, accountId: string): Promise<void> {
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) throw new Error("Account not found");
}

export async function addTransaction(
  userId: string,
  accountId: string,
  input: {
    type: TransactionType;
    amount: number;
    description: string;
    tag: string | null;
    categoryId: string | null;
  }
): Promise<AccountDetail> {
  await assertOwnsAccount(userId, accountId);
  await db.insert(transactions).values({
    userId,
    accountId,
    categoryId: input.categoryId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    tag: input.tag,
  });
  return (await getAccountDetail(userId, accountId))!;
}

export async function deleteTransaction(
  userId: string,
  accountId: string,
  id: string
): Promise<AccountDetail> {
  await assertOwnsAccount(userId, accountId);
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.accountId, accountId)));
  return (await getAccountDetail(userId, accountId))!;
}

export async function addGoal(
  userId: string,
  accountId: string,
  input: { name: string; price: number }
): Promise<AccountDetail> {
  await assertOwnsAccount(userId, accountId);
  await db.insert(goals).values({ userId, accountId, name: input.name, price: input.price });
  return (await getAccountDetail(userId, accountId))!;
}

export async function deleteGoal(
  userId: string,
  accountId: string,
  id: string
): Promise<AccountDetail> {
  await assertOwnsAccount(userId, accountId);
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.accountId, accountId)));
  return (await getAccountDetail(userId, accountId))!;
}
