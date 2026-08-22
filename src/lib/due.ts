// Pure due-date arithmetic, deliberately free of any database import.
//
// These are needed on both sides: the server composes context and reminders
// with them, and the bills screen sorts by them. Living in `bills.ts` meant a
// client component importing one helper dragged the Postgres driver into the
// browser bundle, which fails the build outright.

import type { Bill } from "./types";

// Days until the next time this is due. A monthly bill rolls to next month
// once this month's day has passed; a one-off can go negative, which is what
// "overdue" means for something with a single date.
export function daysUntilDue(bill: Bill, now: Date = new Date()): number | null {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  if (bill.recurrence === "once") {
    if (!bill.dueDate) return null;
    const due = new Date(bill.dueDate);
    due.setUTCHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  }

  if (bill.dueDayOfMonth == null) return null;
  const due = new Date(today);
  due.setUTCDate(bill.dueDayOfMonth);
  if (due < today) due.setUTCMonth(due.getUTCMonth() + 1);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function dueDescription(bill: Bill): string {
  if (bill.recurrence === "once") {
    return bill.dueDate ? `due ${bill.dueDate.slice(0, 10)}` : "no date set";
  }
  return bill.dueDayOfMonth != null ? `due on day ${bill.dueDayOfMonth} each month` : "no day set";
}
