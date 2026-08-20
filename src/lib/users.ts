import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users } from "./db/schema";
import type { User } from "./types";
import { hashPassword, verifyPassword } from "./password";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  return user ? toUser(user) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ? toUser(user) : null;
}

export async function createUser(email: string, password: string): Promise<User> {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  try {
    const [created] = await db
      .insert(users)
      .values({ email: normalized, passwordHash })
      .returning();
    return toUser(created);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error("An account with that email already exists");
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export async function updateUserCurrency(userId: string, currency: string): Promise<User | null> {
  const [updated] = await db
    .update(users)
    .set({ currency })
    .where(eq(users.id, userId))
    .returning();
  return updated ? toUser(updated) : null;
}

export async function updateUserDefaultAccount(
  userId: string,
  defaultAccountId: string | null
): Promise<User | null> {
  const [updated] = await db
    .update(users)
    .set({ defaultAccountId })
    .where(eq(users.id, userId))
    .returning();
  return updated ? toUser(updated) : null;
}

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    currency: row.currency,
    defaultAccountId: row.defaultAccountId,
    createdAt: row.createdAt.toISOString(),
  };
}
