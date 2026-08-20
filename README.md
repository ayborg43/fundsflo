# FundsFlow

A fun, chunky money tracker for kids — earnings, spending, and savings goals — built on [Next.js](https://nextjs.org) and bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Chat-first home screen

The home screen is the Money Buddy chat. You type what happened in plain language
("spent 12 on lunch", "made 50 from chores") and it becomes a transaction; you can
also just ask questions about your money. Everything else — accounts, insights,
budgets, bills, statements, categories, settings — lives behind the ☰ menu.

Logging works in two passes, both through the same provider-agnostic AI config:

1. **Classify.** One small non-streaming call decides whether the message records
   money, and if so extracts type/amount/description plus an account and category
   *by list number* (never by UUID, which models copy unreliably). Deliberately not
   tool/function calling — support for that is uneven across OpenAI-compatible
   endpoints, and `src/lib/ai/client.ts` stays free of provider assumptions.
2. **Confirm.** Nothing is written yet. The parsed transaction appears as an
   editable card in the chat, and only *Save it* commits — so a misread amount or
   account is a correction, not a bad row to hunt down later. Cancelling leaves no
   trace: the message isn't saved to chat history until the draft is committed,
   which also keeps it out of the context later answers are built from.

The same classify-then-confirm pass also handles **new categories** — "add a
category for pets" proposes a name and emoji on a card, and only *Add it* creates
it. Duplicate names are rejected, since categories are matched by name elsewhere
(CSV import, the AI's own numbered list). Recording money always wins over creating
a category, so "spent 20 on pet food" is a log even when no pet category exists.

Anything that isn't a transaction or a category request (a question, a greeting)
streams back as a normal answer exactly as before. If the classifier call fails, the
message falls through to normal chat rather than being lost.

**📎 Statement upload** sits in the composer: CSV/Excel straight into the chat,
analysed by the same `/api/statements` the Statements screen uses. Analysis-only —
it never creates transactions. Uploads started from the chat are mirrored into chat
history so they read back as a normal exchange, under a label the server writes
rather than the client, so history can't be seeded with text the server didn't
produce. The Statements screen is unchanged and writes no history.

Reviewing spending and asking where things are headed are **just questions** — "review
my spending", "where are my balances headed?" — answered as ordinary conversational
turns. There are no buttons for them: the chat already has the full financial
context, and an answer in the thread can be followed up on, which a one-shot button
result cannot. The Insights screen keeps its dedicated recap/forecast endpoints. The
instruction to caveat a projection as a rough, directional estimate lives in the
shared system prompt, so it applies wherever the question is asked.

When a message doesn't name an account, the transaction goes to the **default
account** set in Settings; failing that, to the only account if there's just one;
otherwise the card asks. A message that says *when* ("yesterday", "last Monday") is
backdated, and the date is editable on the card — the model resolves relative days
against the server's date, and "last Monday" is genuinely ambiguous in English, so
it is shown rather than assumed. A logged entry can be taken straight back out with
**Undo** on the confirmation.

Note that the extra classify pass means each message costs one small AI call on top
of the answer itself.

### What the model is sent

`buildFinancialContext` composes accounts, goals, budgets (with this month's spend
against each limit), recurring bills, and the 50 most recent transactions. Budgets
and bills matter: without them, "am I over my food budget?" gets answered from raw
transactions — confidently, and wrong.

Chat history is capped before it reaches the model (`getPromptMessages`): the newest
30 messages, within a character budget. The UI still shows everything. Statement
analyses run well over a thousand characters each, so an uncapped history would mean
every later answer paying for every earlier upload.

Upstream failures never reach the browser verbatim. `friendlyAIError` logs the
provider payload server-side and returns a short message, because provider responses
carry model names and pool diagnostics that don't belong in a kid-facing chat bubble.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Tests

```bash
./scripts/e2e.sh              # whole suite
./scripts/e2e.sh --grep undo  # extra args pass through to playwright
```

Everything runs in containers, so no Node.js is needed on the host — only Docker.
The script builds the production image and runs it against a scratch Postgres and
the deterministic stub in `tests/aistub/`, then tears the whole stack down.

Two details worth knowing before changing it:

- The stack fronts the app with Caddy's internal CA. Session cookies are marked
  `Secure` in production, and neither a browser nor Playwright's request layer will
  send those over plain HTTP — so rather than weakening the cookie for tests, the
  suite talks HTTPS and exercises the real production cookie path.
- The stub records what the app sent it (`GET /_stats`), which is how the suite
  asserts things that are invisible from the outside: that the prompt carries
  budgets and bills, and that history is capped rather than resent in full.

The stub is deterministic by design, so these tests cover the app's plumbing, not
the model's judgement. Whether the classifier correctly reads "spent 20 on pet food"
as a log rather than a category request is a property of the prompt and the model,
and is checked against the real provider by hand.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy on Dokploy

This repo ships with a production `Dockerfile` (multi-stage, `output: "standalone"`) plus a `docker-compose.yml` for local testing (app + Postgres). Data is stored in PostgreSQL — schema migrations (in `drizzle/`) run automatically on server boot via `src/instrumentation.ts`, so there's no manual migration step.

1. **Provision the database first.** In Dokploy, create a **Database → PostgreSQL** resource (separate from the app). Dokploy manages its volume/backups for you. Copy the internal connection string it gives you (something like `postgres://user:pass@service-name:5432/dbname`).
2. Create a new application in Dokploy and point it at this repo/branch.
3. Set the build type to **Dockerfile** (the `Dockerfile` at the repo root is picked up automatically).
4. Under **Environment**, set:
   - `DATABASE_URL` — the connection string from step 1.
   - `SESSION_SECRET` — a random string (e.g. `openssl rand -base64 32`). The app throws on any request in production if this is missing, by design, so it can't silently sign sessions with a guessable dev secret.
   - `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — for the Money Buddy chat/recap/forecast feature and for parsing spoken-language transactions on the home screen. Generic OpenAI-compatible chat-completions config (see `.env.example`); the app has no provider-specific code, so pointing these at a different provider later is a config change, not a code change. Without `AI_API_KEY` set, the chat/recap/forecast endpoints return a clear error rather than crashing the app (they're not called from `instrumentation.ts`, so a missing key only affects those three routes, not startup).
5. Set the container port to `3000` (matches `EXPOSE 3000` / `PORT=3000` in the Dockerfile) and let Dokploy's Traefik proxy handle the domain/HTTPS.
6. Deploy. Dokploy will build the image, boot `node server.js`, which applies any pending migrations before serving the first request.

A `/api/health` endpoint is included for Dokploy's health check configuration.

To test the exact same image locally before pushing (spins up Postgres too):

```bash
docker compose up --build
```

### Changing the schema

Edit `src/lib/db/schema.ts`, then generate a migration:

```bash
npx drizzle-kit generate
```

Commit the generated file(s) in `drizzle/` — they apply automatically on the next deploy.
