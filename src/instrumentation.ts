export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db } = await import("./lib/db/client");

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[freeze-fund] database migrations applied");
}
