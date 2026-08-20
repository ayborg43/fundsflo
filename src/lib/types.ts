export type TransactionType = "make" | "spend";

export type AccountType = "cash" | "checking" | "savings" | "credit" | "debt" | "investment";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  tag: string | null;
  categoryId: string | null;
  timestamp: string;
};

export type Goal = {
  id: string;
  name: string;
  price: number;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
};

export type AccountSummary = {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number | null;
  balance: number;
  createdAt: string;
};

export type AccountDetail = {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number | null;
  balance: number;
  transactions: Transaction[];
  goals: Goal[];
};

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  currency: string;
  defaultAccountId: string | null;
  createdAt: string;
};

// A transaction the AI parsed out of a chat message but has NOT written yet.
// The user confirms (and can correct) it in the chat before it becomes a row
// in `transactions`, so accountId is nullable: when the message names no
// account and there's no sensible default, the user picks one on the card.
// A category the AI understood the user to be asking for, likewise unwritten
// until confirmed.
export type CategoryDraft = {
  name: string;
  emoji: string;
};

export type TransactionDraft = {
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string | null;
  categoryId: string | null;
  // Calendar day the money moved, as YYYY-MM-DD. Null means "now" -- which is
  // not the same as today's date: logging something that happened today should
  // keep its real clock time so the feed reads "just now", not "0d ago".
  date: string | null;
};

export type Budget = {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  spentThisMonth: number;
  createdAt: string;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDayOfMonth: number;
  accountId: string | null;
  categoryId: string | null;
  lastPaidAt: string | null;
  createdAt: string;
};
