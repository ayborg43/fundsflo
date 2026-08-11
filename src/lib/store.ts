import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Account, Goal, Transaction, TransactionType } from "./types";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const ACCOUNTS_DIR = path.join(DATA_DIR, "accounts");

function emptyAccount(): Account {
  return { balance: 0, transactions: [], goals: [] };
}

function accountFile(userId: string): string {
  return path.join(ACCOUNTS_DIR, `${userId}.json`);
}

async function ensureFile(userId: string): Promise<void> {
  await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
  try {
    await fs.access(accountFile(userId));
  } catch {
    await fs.writeFile(accountFile(userId), JSON.stringify(emptyAccount(), null, 2));
  }
}

function recomputeBalance(transactions: Transaction[]): number {
  return transactions.reduce(
    (sum, tx) => sum + (tx.type === "make" ? tx.amount : -tx.amount),
    0
  );
}

async function readAccount(userId: string): Promise<Account> {
  await ensureFile(userId);
  const raw = await fs.readFile(accountFile(userId), "utf-8");
  const parsed = JSON.parse(raw) as Account;
  return {
    balance: recomputeBalance(parsed.transactions ?? []),
    transactions: parsed.transactions ?? [],
    goals: parsed.goals ?? [],
  };
}

async function writeAccount(userId: string, account: Account): Promise<void> {
  await fs.writeFile(accountFile(userId), JSON.stringify(account, null, 2));
}

export async function getAccount(userId: string): Promise<Account> {
  return readAccount(userId);
}

export async function addTransaction(
  userId: string,
  input: {
    type: TransactionType;
    amount: number;
    description: string;
    tag: string | null;
  }
): Promise<Account> {
  const account = await readAccount(userId);
  const tx: Transaction = {
    id: randomUUID(),
    type: input.type,
    amount: input.amount,
    description: input.description,
    tag: input.tag,
    timestamp: new Date().toISOString(),
  };
  account.transactions.unshift(tx);
  account.balance = recomputeBalance(account.transactions);
  await writeAccount(userId, account);
  return account;
}

export async function deleteTransaction(userId: string, id: string): Promise<Account> {
  const account = await readAccount(userId);
  account.transactions = account.transactions.filter((tx) => tx.id !== id);
  account.balance = recomputeBalance(account.transactions);
  await writeAccount(userId, account);
  return account;
}

export async function addGoal(
  userId: string,
  input: { name: string; price: number }
): Promise<Account> {
  const account = await readAccount(userId);
  const goal: Goal = {
    id: randomUUID(),
    name: input.name,
    price: input.price,
    createdAt: new Date().toISOString(),
  };
  account.goals.push(goal);
  await writeAccount(userId, account);
  return account;
}

export async function deleteGoal(userId: string, id: string): Promise<Account> {
  const account = await readAccount(userId);
  account.goals = account.goals.filter((goal) => goal.id !== id);
  await writeAccount(userId, account);
  return account;
}
