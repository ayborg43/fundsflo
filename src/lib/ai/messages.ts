import { eq, asc, desc } from "drizzle-orm";
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

// What the model is allowed to see of the conversation. The UI shows the full
// history, but the prompt cannot: statement analyses run well over a thousand
// characters each, so an uncapped history means every later answer pays for
// every earlier upload. Newest messages win -- an old greeting matters far
// less than the last few turns.
const PROMPT_MESSAGE_LIMIT = 30;
const PROMPT_CHAR_BUDGET = 12000;

export async function getPromptMessages(userId: string): Promise<StoredMessage[]> {
  const rows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.userId, userId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(PROMPT_MESSAGE_LIMIT);

  // Walk newest-first spending the character budget, then flip back to
  // chronological order so the model reads the exchange forwards. The first
  // message is always kept, even if it alone blows the budget -- dropping the
  // message just asked would be worse than a long prompt.
  const kept: typeof rows = [];
  let chars = 0;
  for (const row of rows) {
    chars += row.content.length;
    if (chars > PROMPT_CHAR_BUDGET && kept.length > 0) break;
    kept.push(row);
  }
  kept.reverse();

  return kept.map((row) => ({
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveMessage(userId: string, role: ChatRole, content: string): Promise<void> {
  await db.insert(aiMessages).values({ userId, role, content });
}
