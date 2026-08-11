import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Account, Goal, Transaction, TransactionType } from "./types";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "account.json");

function emptyAccount(): Account {
  return { balance: 0, transactions: [], goals: [] };
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyAccount(), null, 2));
  }
}

function recomputeBalance(transactions: Transaction[]): number {
  return transactions.reduce(
    (sum, tx) => sum + (tx.type === "make" ? tx.amount : -tx.amount),
    0
  );
}

async function readAccount(): Promise<Account> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Account;
  return {
    balance: recomputeBalance(parsed.transactions ?? []),
    transactions: parsed.transactions ?? [],
    goals: parsed.goals ?? [],
  };
}

async function writeAccount(account: Account): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(account, null, 2));
}

export async function getAccount(): Promise<Account> {
  return readAccount();
}

export async function addTransaction(input: {
  type: TransactionType;
  amount: number;
  description: string;
  tag: string | null;
}): Promise<Account> {
  const account = await readAccount();
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
  await writeAccount(account);
  return account;
}

export async function deleteTransaction(id: string): Promise<Account> {
  const account = await readAccount();
  account.transactions = account.transactions.filter((tx) => tx.id !== id);
  account.balance = recomputeBalance(account.transactions);
  await writeAccount(account);
  return account;
}

export async function addGoal(input: { name: string; price: number }): Promise<Account> {
  const account = await readAccount();
  const goal: Goal = {
    id: randomUUID(),
    name: input.name,
    price: input.price,
    createdAt: new Date().toISOString(),
  };
  account.goals.push(goal);
  await writeAccount(account);
  return account;
}

export async function deleteGoal(id: string): Promise<Account> {
  const account = await readAccount();
  account.goals = account.goals.filter((goal) => goal.id !== id);
  await writeAccount(account);
  return account;
}
