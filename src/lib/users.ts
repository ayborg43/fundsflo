import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { User } from "./types";
import { hashPassword, verifyPassword } from "./password";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function readUsers(): Promise<User[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.email === normalizeEmail(email)) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function createUser(email: string, password: string): Promise<User> {
  const users = await readUsers();
  const normalized = normalizeEmail(email);
  if (users.some((u) => u.email === normalized)) {
    throw new Error("An account with that email already exists");
  }
  const user: User = {
    id: randomUUID(),
    email: normalized,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}
