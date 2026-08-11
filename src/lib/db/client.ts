import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set");
  }
  return url;
}

declare global {
  var __freezeFundSql: ReturnType<typeof postgres> | undefined;
}

const sql = globalThis.__freezeFundSql ?? postgres(getConnectionString());
if (process.env.NODE_ENV !== "production") {
  globalThis.__freezeFundSql = sql;
}

export const db = drizzle(sql, { schema });
