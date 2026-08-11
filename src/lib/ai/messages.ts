import { eq, asc } from "drizzle-orm";
import { db } from "../db/client";
import { aiMessages } from "../db/schema";

export type ChatRole = "user" | "assistant";

export type StoredMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export async function getMessages(userId: string): Promise<StoredMessage[]> {
  const rows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.userId, userId))
    .orderBy(asc(aiMessages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveMessage(userId: string, role: ChatRole, content: string): Promise<void> {
  await db.insert(aiMessages).values({ userId, role, content });
}
