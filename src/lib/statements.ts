import { eq, and, desc } from "drizzle-orm";
import { db } from "./db/client";
import { statements } from "./db/schema";

export type Statement = {
  id: string;
  filename: string;
  analysis: string | null;
  createdAt: string;
};

export async function listStatements(userId: string): Promise<Statement[]> {
  const rows = await db
    .select({
      id: statements.id,
      filename: statements.filename,
      analysis: statements.analysis,
      createdAt: statements.createdAt,
    })
    .from(statements)
    .where(eq(statements.userId, userId))
    .orderBy(desc(statements.createdAt));

  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    analysis: r.analysis,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createStatement(
  userId: string,
  input: { filename: string; rawContent: string }
): Promise<{ id: string; createdAt: string }> {
  const [created] = await db
    .insert(statements)
    .values({ userId, filename: input.filename, rawContent: input.rawContent })
    .returning({ id: statements.id, createdAt: statements.createdAt });
  return { id: created.id, createdAt: created.createdAt.toISOString() };
}

export async function setStatementAnalysis(id: string, analysis: string): Promise<void> {
  await db.update(statements).set({ analysis }).where(eq(statements.id, id));
}

export async function deleteStatement(userId: string, id: string): Promise<void> {
  await db.delete(statements).where(and(eq(statements.id, id), eq(statements.userId, userId)));
}
