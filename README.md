# SunShare

Own solar that powers African clinics and farms. Buy solar cells with PayPal, the cells power a clinic or a farm that pays for the electricity, and you receive your share of that income each month through PayPal. AI agents vet the projects, verify the output, and pay the owners.

Built for the PayPal AI Hackathon.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No accounts or keys are needed: without them the app runs in demo mode, where PayPal and the AI are simulated and labelled as such in the footer.

## Try the flow

1. **Projects**: open a project, read the vetting report, choose some cells and pay.
2. **Agent**: tell the agent what you want ("Invest $50 in clinic solar in Zimbabwe"), review its proposal and approve it.
3. **Operations**: fast-forward a project to installed, then run a month. Watch the agents verify the output and pay every owner.
4. **Portfolio**: see what you own and what you have been paid.

Locally, data lives in memory and resets when the server restarts, or from the reset control on the Operations page.

## The four agents

| Agent | What it does |
|---|---|
| Vetting | Scores each project from sunlight at the site (NASA POWER), forecast output and risks |
| Monitoring | Compares metered output with the forecast each month and flags problems |
| Payout | Works out each owner's share and sends it through PayPal Payouts |
| Investor | Turns a plain instruction into purchases, inside spending limits you set, after you approve |

Numbers are always computed in code. The language model explains and decides; it never does the arithmetic behind a payout.

## Real PayPal sandbox and live AI

Copy `.env.example` to `.env.local` and fill in what you have.

| Variable | Effect |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Real PayPal sandbox orders and payouts (create an app at developer.paypal.com) |
| `ANTHROPIC_API_KEY` | Claude writes the reports and drives the investor agent |
| `AI_MODEL` | Optional model override |

## How it is built

- Next.js (App Router), React, TypeScript, Tailwind CSS.
- `src/lib/store.ts` is the only place that touches data. It uses Cloudflare D1 when deployed (`store-d1.ts`, schema in `migrations/`) and memory everywhere else (`store-memory.ts`).
- `src/lib/agents/` holds the four agents; `src/lib/paypal.ts` and `src/lib/ai.ts` wrap the outside services.
- `docs/CONTRACT.md` describes the routes, the checkout flow and the money rules.

## Deploy to Cloudflare

The app deploys to Cloudflare Workers with a D1 database; the free plans are enough. See [docs/DEPLOY.md](docs/DEPLOY.md) for the steps.

## Status and limits

This is a prototype. The projects and people are sample data. Plant output is simulated; a real deployment would read the same figures from the inverter or meter. Paying returns to the public is a regulated activity in most countries, so a live launch would need licensing and PayPal's approval. Earnings shown are estimates and are not guaranteed.

## Licence

MIT
