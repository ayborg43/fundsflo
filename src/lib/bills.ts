import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { recurringBills } from "./db/schema";
import { addTransaction } from "./transactions";
import type { Bill } from "./types";

function toBill(row: typeof recurringBills.$inferSelect): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    dueDayOfMonth: row.dueDayOfMonth,
    accountId: row.accountId,
    categoryId: row.categoryId,
    lastPaidAt: row.lastPaidAt ? row.lastPaidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBills(userId: string): Promise<Bill[]> {
  const rows = await db.select().from(recurringBills).where(eq(recurringBills.userId, userId));
  return rows.map(toBill);
}

export async function createBill(
  userId: string,
  input: {
    name: string;
    amount: number;
    dueDayOfMonth: number;
    accountId: string | null;
    categoryId: string | null;
  }
): Promise<Bill> {
  const [created] = await db
    .insert(recurringBills)
    .values({
      userId,
      name: input.name,
      amount: input.amount,
      dueDayOfMonth: input.dueDayOfMonth,
      accountId: input.accountId,
      categoryId: input.categoryId,
    })
    .returning();
  return toBill(created);
}

export async function deleteBill(userId: string, id: string): Promise<void> {
  await db.delete(recurringBills).where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)));
}

export async function markBillPaid(userId: string, billId: string): Promise<Bill | null> {
  const [bill] = await db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.id, billId), eq(recurringBills.userId, userId)))
    .limit(1);
  if (!bill) return null;

  if (bill.accountId) {
    await addTransaction(userId, bill.accountId, {
      type: "spend",
      amount: bill.amount,
      description: bill.name,
      tag: null,
      categoryId: bill.categoryId,
    });
  }

  const [updated] = await db
    .update(recurringBills)
    .set({ lastPaidAt: new Date() })
    .where(eq(recurringBills.id, billId))
    .returning();
  return toBill(updated);
}
