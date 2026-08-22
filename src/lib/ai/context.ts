import { inArray, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { transactions, goals, categories } from "../db/schema";
import { listAccounts } from "../accounts";
import type { AccountSummary, Category } from "../types";
import { listBudgets, periodLabel } from "../budgets";
import { listBills } from "../bills";
import { daysUntilDue, dueDescription } from "../due";
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
  const [categoryRows, recentTx, goalRows, budgetRows, billRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db
      .select()
      .from(transactions)
      .where(inArray(transactions.accountId, accountIds))
      .orderBy(desc(transactions.timestamp))
      .limit(50),
    db.select().from(goals).where(inArray(goals.accountId, accountIds)),
    listBudgets(userId),
    listBills(userId),
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

  // Without these, questions like "am I over my food budget?" or "what's due?"
  // get answered from raw transactions alone -- confidently, and wrong.
  if (budgetRows.length > 0) {
    lines.push("", "Budgets (spend so far in the current period):");
    for (const b of budgetRows) {
      const category = categoryById.get(b.categoryId);
      const label = category ? `${category.emoji} ${category.name}` : "Uncategorised";
      const remaining = b.limitAmount - b.spentThisPeriod;
      const status =
        remaining >= 0
          ? `${formatMoney(remaining, currency)} left`
          : `over by ${formatMoney(-remaining, currency)}`;
      lines.push(
        `- ${label}: spent ${formatMoney(b.spentThisPeriod, currency)} of ${formatMoney(b.limitAmount, currency)} ${periodLabel(b.period)} (${status})`
      );
    }
  }

  if (billRows.length > 0) {
    lines.push("", "Bills and payments due:");
    for (const bill of billRows) {
      const paid = bill.lastPaidAt ? `last paid ${bill.lastPaidAt.slice(0, 10)}` : "not paid yet";
      const days = daysUntilDue(bill);
      // Spelling out "due in N days" is what lets an answer raise something
      // before it is late, rather than only when asked.
      const when =
        days === null
          ? dueDescription(bill)
          : days < 0
            ? `${dueDescription(bill)} — OVERDUE by ${-days} day(s)`
            : days === 0
              ? `${dueDescription(bill)} — due today`
              : `${dueDescription(bill)} — due in ${days} day(s)`;
      lines.push(`- ${bill.name}: ${formatMoney(bill.amount, currency)}, ${when} (${paid})`);
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
    "If asked where things are headed -- a forecast, a projection, whether they'll reach a goal --",
    "answer from their recent pace but say plainly that it's a rough, directional estimate from",
    "recent trends, not a guarantee or a precise prediction.",
    "",
    "This user's current financial data:",
    context,
  ].join("\n");
}

// The prompt used when deciding which actions a message calls for. Separate
// from the conversational prompt: it carries the numbered lists the tools
// refer to, and the rules that were learned the hard way while this was a
// hand-rolled classifier.
export function buildActionPrompt(
  accounts: AccountSummary[],
  categories: Category[],
  bills: { name: string }[],
  currency: string,
  today: string
): string {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((line, i) => `${i + 1}. ${line}`).join("\n") : "(none yet)";

  return [
    "You turn one message from someone using a personal finance app into actions.",
    "",
    "Call a tool for anything the user is asking you to record or change. Call several",
    "if the message asks for several. Call none at all if they are asking a question,",
    "chatting, greeting you, or reacting -- those are answered in conversation, not by",
    "a tool, and that includes questions about balances, budgets and bills.",
    "",
    "ACCOUNTS (use the number):",
    list(accounts.map((a) => `${a.name} (${a.type})`)),
    "",
    "CATEGORIES (use the number):",
    list(categories.map((c) => `${c.emoji} ${c.name}`)),
    "",
    "BILLS (refer to these by name):",
    list(bills.map((b) => b.name)),
    "",
    `Today is ${today}. Amounts are in ${currency}.`,
    "",
    "Rules:",
    "- Only record money that has ALREADY moved. Something they plan to do -- \"I'll spend",
    "  100 next week\", \"I want to buy a bike\", \"saving up for shoes\" -- is not a",
    "  transaction. If they need to pay it later, that is create_bill with recurrence",
    "  'once'; otherwise just talk to them.",
    "- Never guess an amount. No clear single amount means no log_transaction.",
    "- A message that both asks something and mentions a past amount is a question.",
    "- For an account of type (debt) the balance is what is owed, so the usual words",
    "  flip: money toward it pays it down and is type 'make'; a new charge is 'spend'.",
    "  \"Paid 20 on my bike loan\" is make, not spend.",
    "- Set a transaction date only when they say when it happened, resolved against",
    "  today. If you cannot work out which day, omit it -- never abandon the action",
    "  over a date.",
    "- Only create or delete a category when they actually ask. Mentioning a kind of",
    "  spending is not a request.",
    "- Recording money wins over creating a category: \"spent 20 on pet food\" is a log",
    "  even when no pet category exists.",
  ].join("\n");
}
