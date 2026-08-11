import { eq, inArray, asc } from "drizzle-orm";
import { db } from "./db/client";
import { accounts, transactions } from "./db/schema";

export type NetWorthPoint = { date: string; netWorth: number };

// One point per calendar day that had activity, walking the cumulative
// signed sum across every account the user owns (debt balances are already
// negative, so summing nets them against assets automatically).
export async function getNetWorthHistory(userId: string): Promise<NetWorthPoint[]> {
  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  if (accountRows.length === 0) return [];

  const accountIds = accountRows.map((a) => a.id);
  const txRows = await db
    .select({ type: transactions.type, amount: transactions.amount, timestamp: transactions.timestamp })
    .from(transactions)
    .where(inArray(transactions.accountId, accountIds))
    .orderBy(asc(transactions.timestamp));

  const points: NetWorthPoint[] = [];
  let running = 0;
  let lastDate: string | null = null;

  for (const tx of txRows) {
    running += tx.type === "make" ? tx.amount : -tx.amount;
    const date = tx.timestamp.toISOString().slice(0, 10);
    if (date === lastDate) {
      points[points.length - 1].netWorth = running;
    } else {
      points.push({ date, netWorth: running });
      lastDate = date;
    }
  }

  return points;
}
