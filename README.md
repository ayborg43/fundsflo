# FundsFlow

A fun, chunky money tracker for kids — earnings, spending, and savings goals — built on [Next.js](https://nextjs.org) and bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
