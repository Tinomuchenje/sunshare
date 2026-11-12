# Deploy SunShare to Cloudflare

SunShare runs on Cloudflare Workers through the OpenNext Cloudflare adapter (`@opennextjs/cloudflare`), with its data in a Cloudflare D1 database. The free Workers and D1 plans are enough for a demo. Nothing else is needed: no R2 bucket, no KV namespace.

Local development does not change: `npm run dev` keeps all data in memory and needs no Cloudflare account or setup.

## How the app picks its database

`src/lib/store.ts` checks every request for a D1 binding named `DB`. On Cloudflare (and in `npm run preview`) the binding exists, so data lives in D1. Under `npm run dev` there is no binding, so data lives in memory as before.

## What you need

- Node.js 22.12 or newer (Wrangler, Cloudflare's command-line tool, requires it).
- A Cloudflare account. The free plan is fine.
- `npm install` already run in this folder.

## Deploy, step by step

Run every command from the project folder.

1. **Log in to Cloudflare.** This opens a browser window.

   ```bash
   npx wrangler login
   ```

2. **Create the database.**

   ```bash
   npx wrangler d1 create sunshare
   ```

   Wrangler prints the new database's details, including a `database_id` (a long id like `1a2b3c4d-...`). If it asks whether to add the database to your config for you, answer **no**: the config already has the right entry, and step 3 fills in the id.

3. **Paste the database id.** Open `wrangler.jsonc`, find `"database_id": "00000000-0000-0000-0000-000000000000"` and replace the zeros with the id from step 2. Keep `"binding": "DB"` as it is.

4. **Create the tables.**

   ```bash
   npm run db:migrate:remote
   ```

   Answer yes if Wrangler asks to confirm.

5. **Load the sample data.**

   ```bash
   npm run db:seed:remote
   ```

   This writes `.wrangler/seed.sql` from `src/lib/seed.ts` and runs it on the database.

6. **Set the secrets (optional).** Without them the deployed app runs in demo mode, exactly like a local run with no keys. To use the PayPal sandbox and live AI, set any of these:

   ```bash
   npx wrangler secret put PAYPAL_CLIENT_ID
   npx wrangler secret put PAYPAL_CLIENT_SECRET
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put AI_MODEL
   ```

   Each command asks for the value. If Wrangler says the Worker `sunshare` does not exist yet and offers to create it, answer yes. You can also set secrets after step 7; they take effect straight away.

7. **Deploy.**

   ```bash
   npm run deploy
   ```

   This builds the app for Workers and uploads it. Wrangler prints the address, usually `https://sunshare.<your-subdomain>.workers.dev`. If your account has no workers.dev subdomain yet, Wrangler asks you to choose one.

Open the address. The first visit takes a little longer while the vetting agent scores each project and the sample payout history is written.

### Later deploys

After a code change, run `npm run deploy` again. If a new file appears in `migrations/`, run `npm run db:migrate:remote` first.

## Reset the demo data

Either:

- use the reset control on the Operations page (it calls `POST /api/demo/reset`), or
- run `npm run db:seed:remote`, which empties every table and loads the sample data again.

## Try it in the Workers runtime on your computer

This builds the app and runs it in Cloudflare's local Workers runtime with a local D1 database (stored under `.wrangler/`). No Cloudflare account is needed.

```bash
npm run db:migrate:local
npm run db:seed:local
npm run preview
```

`npm run preview` prints the local address (by default http://localhost:8787; add `-- --port 8790` to choose another port). Data survives restarts; `npm run db:seed:local` resets it.

## Environment variables

| Variable | Effect |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Real PayPal sandbox orders and payouts |
| `ANTHROPIC_API_KEY` | Claude writes the reports and drives the investor agent |
| `AI_MODEL` | Optional model override |

Where to put them:

- **Deployed app:** Wrangler secrets (step 6). Check them with `npx wrangler secret list`.
- **`npm run preview`:** copy `.dev.vars.example` to `.dev.vars` and fill it in.
- **`npm run dev`:** `.env.local`, as before (see `.env.example`).

The app reads them as `process.env.*` in every case; on Workers the adapter copies secrets into `process.env` before handling a request.

Note: the build also bundles values from `.env`, `.env.local` and `.env.production` into the Worker as defaults (secrets win when both are set). If your `.env.local` holds real keys, they are uploaded with `npm run deploy`. Empty or remove it before deploying if you do not want that.

## Free plan notes

- Workers Free and D1 Free are enough for a hackathon demo. Cloudflare publishes the current limits for each plan in its Workers and D1 documentation; check them there rather than relying on numbers copied into this file.
- The built Worker was about 1.1 MiB gzipped when this guide was written. `npx wrangler deploy --dry-run` shows the current size if you want to compare it with your plan's Worker size limit.
- If requests start failing with a resource-limit error under heavy use, the Workers Paid plan raises the limits. Nothing in the code needs to change.

## Good to know

- The demo controls (fast-forward, run month, reset, agent limits) are open to anyone who has the address, as they are locally. In sandbox mode, "run month" sends PayPal sandbox payouts.
- Purchases, monthly runs and fast-forward are protected against double processing by the database itself (conditional updates, unique keys and transactions), because requests on Workers can run in separate instances at the same time.
