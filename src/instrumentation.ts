const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db } = await import("./lib/db/client");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("[fundsflow] database migrations applied");
      return;
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      const message = err instanceof Error ? err.message : String(err);
      const hint = message.includes("ENOTFOUND")
        ? " -- hostname in DATABASE_URL doesn't resolve; if this persists past the first ~20s, it's not a startup race, it's a misconfigured host/network (wrong service name, or app and DB on different Dokploy networks/environments)."
        : "";

      if (isLastAttempt) {
        console.error(
          `[fundsflow] could not reach the database after ${MAX_ATTEMPTS} attempts, giving up: ${message}${hint}`
        );
        throw err;
      }

      console.warn(
        `[fundsflow] database not ready (attempt ${attempt}/${MAX_ATTEMPTS}): ${message}${hint} -- retrying in ${BASE_DELAY_MS * attempt}ms`
      );
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
}
