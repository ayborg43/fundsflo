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
  createdAt: string;
};
