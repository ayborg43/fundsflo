import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "./db/client";
import { recurringBills } from "./db/schema";
import { addTransaction } from "./transactions";
import type { Bill, BillRecurrence } from "./types";
import { daysUntilDue, dueDescription } from "./due";

export { daysUntilDue, dueDescription };

function toBill(row: typeof recurringBills.$inferSelect): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    recurrence: row.recurrence,
    dueDayOfMonth: row.dueDayOfMonth,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    remindDaysBefore: row.remindDaysBefore,
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
    recurrence: BillRecurrence;
    dueDayOfMonth: number | null;
    dueDate: Date | null;
    remindDaysBefore: number | null;
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
      recurrence: input.recurrence,
      // Exactly one of these is meaningful, decided by recurrence.
      dueDayOfMonth: input.recurrence === "monthly" ? input.dueDayOfMonth : null,
      dueDate: input.recurrence === "once" ? input.dueDate : null,
      remindDaysBefore: input.remindDaysBefore,
      accountId: input.accountId,
      categoryId: input.categoryId,
    })
    .returning();
  return toBill(created);
}

export async function setBillReminder(
  userId: string,
  billId: string,
  daysBefore: number | null
): Promise<Bill | null> {
  const [updated] = await db
    .update(recurringBills)
    .set({ remindDaysBefore: daysBefore, lastRemindedAt: null })
    .where(and(eq(recurringBills.id, billId), eq(recurringBills.userId, userId)))
    .returning();
  return updated ? toBill(updated) : null;
}

export async function deleteBill(userId: string, id: string): Promise<void> {
  await db
    .delete(recurringBills)
    .where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)));
}

export async function findBillByName(userId: string, name: string): Promise<Bill | null> {
  const all = await listBills(userId);
  const needle = name.trim().toLowerCase();
  return (
    all.find((b) => b.name.toLowerCase() === needle) ??
    all.find((b) => b.name.toLowerCase().includes(needle)) ??
    null
  );
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

// Everything with a reminder configured, for the scheduled job to consider.
export async function listBillsWithReminders(): Promise<
  { userId: string; bill: Bill; lastRemindedAt: Date | null }[]
> {
  const rows = await db
    .select()
    .from(recurringBills)
    .where(isNotNull(recurringBills.remindDaysBefore));
  return rows.map((row) => ({
    userId: row.userId,
    bill: toBill(row),
    lastRemindedAt: row.lastRemindedAt,
  }));
}

export async function markReminded(billId: string): Promise<void> {
  await db
    .update(recurringBills)
    .set({ lastRemindedAt: new Date() })
    .where(eq(recurringBills.id, billId));
}
