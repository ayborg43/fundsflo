import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __freezeFundDb: Db | undefined;
}

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set");
  }
  return drizzle(postgres(url), { schema });
}

function getDb(): Db {
  if (!globalThis.__freezeFundDb) {
    globalThis.__freezeFundDb = createDb();
  }
  return globalThis.__freezeFundDb;
}

// Lazy so importing this module (e.g. during `next build`'s page-data
// collection, which has no DATABASE_URL) never touches Postgres — the
// connection is only opened on first real query at request time.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
