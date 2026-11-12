# SunShare build contract

Read this before writing code. It is the shared agreement between the people building the backend and the screens.

## What the product is

People buy solar cells in a project that powers an African clinic or farm, using PayPal. The site pays for the electricity it uses. Each month the income is split among cell owners and paid out through PayPal. Four AI agents do the work:

- **Vetting agent** scores a project before investors see it (sunlight at the site, forecast output, risks).
- **Monitoring agent** compares the plant's metered output with the forecast each month and flags problems.
- **Payout agent** works out each owner's share and sends it through PayPal Payouts.
- **Investor agent** takes a plain instruction ("invest $50 in clinic solar in Zimbabwe"), proposes purchases inside the limits the investor set (the mandate), and buys only after the investor approves.

This is a hackathon entry (PayPal AI Hackathon). Judges score implementation, design, impact, innovation and presentation equally. It must feel like a finished, calm, trustworthy product, and it must be very easy to follow.

## Stage we are at

Locally (`npm run dev`) data lives in memory and resets on restart. Deployed, the app runs on Cloudflare Workers with a D1 database (`docs/DEPLOY.md`); `src/lib/store.ts` picks the backend. So:

- Server code must run on Cloudflare Workers: use `fetch` and Web Crypto. No `fs`, no Node-only modules, no SDKs that need Node internals.
- All data access goes through the async functions in `src/lib/store.ts`. Do not keep state anywhere else on the server.
- Requests may run in separate Worker instances at once. In-process queues (`serialize` in `domain.ts`) do not protect data there; any write that must not race has to be one atomic store function.

## Two modes, chosen by environment variables

| Thing | Demo mode (default, no keys) | Real mode |
|---|---|---|
| PayPal | Orders and payouts are generated locally with ids like `DEMO-ORDER-…` | `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` set: real calls to `https://api-m.sandbox.paypal.com` (Orders v2, Payouts v1) |
| AI | Rule-based logic with templated wording | `ANTHROPIC_API_KEY` set: Claude writes the narratives and drives the investor agent with tool calls. Model from `AI_MODEL`, default `claude-sonnet-5-5` |

The numbers (scores, kWh, payout amounts) are always computed in code, never by the language model. The model explains and decides; code does the arithmetic. If a real call fails, return a clear error; do not silently fall back to demo data.

The UI shows the current mode honestly (a small "Demo mode" note), via `GET /api/status`.

## Shared files (already written, treat as fixed)

- `src/lib/types.ts`: domain types. Money is integer cents.
- `src/lib/api-types.ts`: request and response shapes for every route. This is the API.
- `src/lib/store.ts`: data access.
- `src/lib/seed.ts`: sample projects, investors, holdings, sunlight fallbacks.
- `src/lib/format.ts`: money, number and month formatting helpers.
- `src/components/ui/index.tsx`: Button, ButtonLink, Card, Badge, ProgressBar, Stat, PageHeader, Notice. Import from `@/components/ui`.
- `src/lib/api.ts`: `api<T>(path, body?, method?)` for calling routes from the browser; throws an Error with the server's message.
- `src/app/layout.tsx`, `src/app/globals.css`: shell, navigation, colours and type.

If a shared file needs changing, make the smallest change that works and list it in your final report.

## Routes

All under `src/app/api`. Shapes are in `src/lib/api-types.ts`. Errors return `{ error }` with a 4xx or 5xx status.

| Route | Purpose |
|---|---|
| `GET /api/status` | Which modes are active |
| `GET /api/projects` | All projects with computed figures |
| `GET /api/projects/[id]` | One project plus its monthly reports |
| `POST /api/checkout/create` | Start buying cells; returns where to send the buyer to approve |
| `GET /api/checkout/order?token=` | Order summary for the approval and return pages |
| `POST /api/checkout/capture` | Complete the purchase after approval; records ownership |
| `GET /api/portfolio` | The current investor's holdings, purchases, payouts |
| `GET /api/ops` | Operations overview: reports and payout ledger |
| `POST /api/ops/fast-forward` | Demo control: fill remaining cells with sample investors, mark installed |
| `POST /api/ops/run-month` | Simulate a month: generate output, verify, pay owners |
| `POST /api/vetting` | Re-run the vetting agent on a project |
| `POST /api/agent/chat` | Talk to the investor agent; may return a proposal |
| `POST /api/agent/execute` | Carry out an approved proposal |
| `GET, PUT /api/agent/mandate` | Read or change the agent's spending limits |
| `POST /api/demo/reset` | Reset all data to the seed |

## Checkout flow (same in both modes)

1. UI posts to `/api/checkout/create`, gets `approveUrl`, and sends the browser there.
2. Sandbox mode: that is PayPal's approval page, which returns to `/checkout/return?token=<orderId>`. Demo mode: it is `/checkout/approve?token=<orderId>`, a stand-in page in this app, clearly labelled as a demo, with an Approve button that goes to `/checkout/return?token=<orderId>`.
3. `/checkout/return` posts to `/api/checkout/capture` and shows the confirmation.

Capturing twice must be safe: the second call returns the same completed purchase.

## Money rules

- Monthly output forecast (kWh) = capacityKw × sunHoursPerDay × days in month × 0.78.
- Used energy = actual output × project utilisation.
- Revenue = used kWh × tariff.
- 10% platform fee, 10% maintenance reserve, the rest is distributed.
- Each owner gets distributable × (their cells ÷ total cells), rounded down to the cent. Any leftover cents go to the maintenance reserve so totals always reconcile.
- Never present returns as guaranteed. Use "estimated" and say it depends on sunshine and usage.

## Next.js notes

This is Next.js 16 with React 19 and Tailwind 4. It differs from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing a route or page (for example, `params` and `searchParams` are promises). `cacheComponents` is off. Any server page or route that reads the store must opt out of static rendering (`export const dynamic = "force-dynamic"`), otherwise it will show stale data.

Verify your work with `npm run build` and `npm run lint` before finishing. Do not run `npm run dev` on port 3000 in the background and leave it running.

## Writing in the UI

Plain words. Short sentences. No jargon, no hype, no exclamation marks. A first-time visitor should understand each screen in a few seconds. Say "solar cells", "your share", "paid to your PayPal". Sample data is invented; do not present it as real.
