import { defineConfig } from "@playwright/test";

// The suite drives a real app container against a real Postgres and the
// deterministic stub in tests/aistub. Run it with scripts/e2e.sh, which brings
// that stack up and points E2E_BASE_URL at it.
//
// One worker, no parallelism: every test shares the one database and the one
// stub, and the stub's recorded state is asserted on directly.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://proxy",
    // The stack fronts the app with Caddy's internal CA so that Secure session
    // cookies behave exactly as they do in production; the cert is self-signed
    // by design.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
});
