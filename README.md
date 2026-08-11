This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

This repo ships with a production `Dockerfile` (multi-stage, `output: "standalone"`) plus a `docker-compose.yml` for local testing. To deploy on [Dokploy](https://dokploy.com):

1. Create a new application in Dokploy and point it at this repo/branch.
2. Set the build type to **Dockerfile** (the `Dockerfile` at the repo root is picked up automatically).
3. Under **Advanced → Mounts**, add a volume mounted at `/app/data` — this is where `data/account.json` (balances, transactions, goals) is persisted. Without this, data is lost on every redeploy.
4. Set the container port to `3000` (matches `EXPOSE 3000` / `PORT=3000` in the Dockerfile) and let Dokploy's Traefik proxy handle the domain/HTTPS.
5. Optional env vars (see `.env.example`): `DATA_DIR` (defaults to `/app/data`) if you want the data file somewhere else in the container.
6. Deploy. Dokploy will build the image and run `node server.js`.

A `/api/health` endpoint is included for Dokploy's health check configuration.

To test the exact same image locally before pushing:

```bash
docker compose up --build
```
