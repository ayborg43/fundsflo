import { inArray, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { transactions, goals, categories } from "../db/schema";
import { listAccounts } from "../accounts";
import { formatMoney } from "../format";

// Context-stuffing, not RAG: this is one person's transaction history, small
// enough to summarize directly into the prompt every time. A vector DB would
// be pure overhead at this scale.
export async function buildFinancialContext(userId: string, currency: string): Promise<string> {
  const accounts = await listAccounts(userId);
  if (accounts.length === 0) {
    return "This user has no accounts set up yet.";
  }

  const accountIds = accounts.map((a) => a.id);
  const [categoryRows, recentTx, goalRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db
      .select()
      .from(transactions)
      .where(inArray(transactions.accountId, accountIds))
      .orderBy(desc(transactions.timestamp))
      .limit(50),
    db.select().from(goals).where(inArray(goals.accountId, accountIds)),
  ]);

  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));
  const lines: string[] = [`Currency: ${currency}`, "", "Accounts:"];

  for (const a of accounts) {
    const label = a.type === "debt" ? `owes ${formatMoney(Math.max(0, -a.balance), currency)}` : formatMoney(a.balance, currency);
    lines.push(`- ${a.name} (${a.type}): ${label}`);
  }

  if (goalRows.length > 0) {
    lines.push("", "Goals:");
    for (const g of goalRows) {
      lines.push(`- ${g.name}: target ${formatMoney(g.price, currency)}`);
    }
  }

  if (recentTx.length > 0) {
    lines.push("", `Recent transactions (most recent ${recentTx.length}):`);
    for (const tx of recentTx) {
      const category = tx.categoryId ? categoryById.get(tx.categoryId) : null;
      const sign = tx.type === "make" ? "+" : "-";
      const date = tx.timestamp.toISOString().slice(0, 10);
      const tags = [category ? category.name : null, tx.description || null].filter(Boolean).join(" - ");
      lines.push(`- ${date} ${sign}${formatMoney(tx.amount, currency)}${tags ? ` (${tags})` : ""}`);
    }
  }

  return lines.join("\n");
}

export function buildSystemPrompt(context: string): string {
  return [
    "You are Money Buddy, a friendly, upbeat, encouraging personal finance assistant inside the FundsFlow app.",
    "Keep your tone playful and supportive, never clinical or corporate.",
    "You can only see the financial data provided below for this one user -- never invent numbers, and never reference any other user.",
    "Share observations and general education, not licensed financial/investment/legal advice. If asked for specific investment recommendations, gently note you're not a licensed advisor and suggest general principles instead.",
    "Keep responses concise -- a few sentences or a short list, not an essay.",
    "",
    "This user's current financial data:",
    context,
  ].join("\n");
}
