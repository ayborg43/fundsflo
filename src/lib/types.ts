export type TransactionType = "make" | "spend";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  tag: string | null;
  timestamp: string;
};

export type Goal = {
  id: string;
  name: string;
  price: number;
  createdAt: string;
};

export type Account = {
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
