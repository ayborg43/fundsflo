import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth";
import { listAccounts } from "@/lib/accounts";
import { db } from "@/lib/db/client";
import { transactions, categories } from "@/lib/db/schema";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const HEADER = [
  "account_name",
  "account_type",
  "type",
  "amount",
  "description",
  "tag",
  "category",
  "timestamp",
];

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accounts = await listAccounts(userId);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const accountIds = accounts.map((a) => a.id);

  const [txRows, categoryRows] = await Promise.all([
    accountIds.length > 0
      ? db.select().from(transactions).where(inArray(transactions.accountId, accountIds))
      : Promise.resolve([]),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  const lines = [HEADER.join(",")];
  for (const tx of txRows) {
    const account = accountById.get(tx.accountId);
    const category = tx.categoryId ? categoryById.get(tx.categoryId) : null;
    lines.push(
      [
        csvEscape(account?.name ?? ""),
        csvEscape(account?.type ?? ""),
        tx.type,
        String(tx.amount),
        csvEscape(tx.description),
        csvEscape(tx.tag ?? ""),
        csvEscape(category?.name ?? ""),
        tx.timestamp.toISOString(),
      ].join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fundsflow-export.csv"`,
    },
  });
}
