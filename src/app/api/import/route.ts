import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listAccounts, createAccount } from "@/lib/accounts";
import { listCategories, createCategory } from "@/lib/categories";
import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema";
import type { AccountSummary, AccountType, Category } from "@/lib/types";

const VALID_TYPES: AccountType[] = ["cash", "checking", "savings", "credit", "debt", "investment"];
const EXPECTED_HEADER = [
  "account_name",
  "account_type",
  "type",
  "amount",
  "description",
  "tag",
  "category",
  "timestamp",
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.text();
  const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADER)) {
    return NextResponse.json(
      { error: "Unrecognized CSV format — only FundsFlow's own exported CSV can be imported" },
      { status: 400 }
    );
  }

  const accountByKey = new Map<string, AccountSummary>(
    (await listAccounts(userId)).map((a) => [`${a.name}::${a.type}`, a])
  );
  const categoryByName = new Map<string, Category>(
    (await listCategories(userId)).map((c) => [c.name, c])
  );

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) continue;
    const [accountName, accountTypeRaw, type, amountStr, description, tag, categoryName, timestamp] = cols;

    const accountType = VALID_TYPES.includes(accountTypeRaw as AccountType)
      ? (accountTypeRaw as AccountType)
      : "cash";
    const key = `${accountName}::${accountType}`;
    let account = accountByKey.get(key);
    if (!account) {
      account = await createAccount(userId, { name: accountName, type: accountType });
      accountByKey.set(key, account);
    }

    let categoryId: string | null = null;
    if (categoryName) {
      let category = categoryByName.get(categoryName);
      if (!category) {
        category = await createCategory(userId, { name: categoryName, emoji: "🏷️" });
        categoryByName.set(categoryName, category);
      }
      categoryId = category.id;
    }

    const amount = parseFloat(amountStr);
    if (!(amount > 0) || (type !== "make" && type !== "spend")) continue;

    const parsedTimestamp = new Date(timestamp);
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId,
      type,
      amount,
      description: description || "",
      tag: tag || null,
      timestamp: Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp,
    });
    imported++;
  }

  return NextResponse.json({ imported });
}
