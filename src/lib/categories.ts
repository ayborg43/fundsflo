import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { categories } from "./db/schema";
import type { Category } from "./types";

export async function listCategories(userId: string): Promise<Category[]> {
  const rows = await db.select().from(categories).where(eq(categories.userId, userId));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createCategory(
  userId: string,
  input: { name: string; emoji: string }
): Promise<Category> {
  const [created] = await db
    .insert(categories)
    .values({ userId, name: input.name, emoji: input.emoji })
    .returning();
  return {
    id: created.id,
    name: created.name,
    emoji: created.emoji,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}
