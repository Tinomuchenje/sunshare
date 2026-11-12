// Shared server logic used by the API routes: project views, lazy vetting,
// seeded history, purchases, running a month, fast-forward and the mandate.

import type { AgentStep, ProjectView, RunMonthResponse } from "./api-types";
import { aiMode } from "./ai";
import { readMeter, type Scenario } from "./agents/monitoring";
import { settleMonth, type PayoutChannel } from "./agents/payout";
import { vetProject } from "./agents/vetting";
import { money, monthLabel, nextMonth, num } from "./format";
import { captureOrder, createOrder, demoId, paypalMode } from "./paypal";
import { SEED_HISTORY_MONTHS, seedProjects, YOU_ID } from "./seed";
import * as store from "./store";
import type { Holding, MonthlyReport, Project, Purchase } from "./types";

// ---------- HTTP helpers ----------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Runs a route body and turns the result or error into a JSON response. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    const status = (e as { status?: unknown }).status;
    const message = e instanceof Error ? e.message : "Something went wrong.";
    if (typeof status !== "number") console.error(e);
    return Response.json({ error: message }, { status: typeof status === "number" ? status : 500 });
  }
}

export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body;
  } catch {}
  throw new ApiError(400, "The request body must be a JSON object.");
}

/** The site's own origin, for PayPal return links. Honours proxy headers. */
export function siteOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

// ---------- Serialising work ----------

// These queues only order work inside one server process (all of `next dev`,
// or one Worker isolate). What keeps data correct across Worker isolates is
// that each racing write is a single atomic store call (see store.ts).
const locks = ((globalThis as unknown as { __sunshareLocks?: Map<string, Promise<unknown>> })
  .__sunshareLocks ??= new Map());

/** Runs `fn` after any earlier work queued under the same key has finished. */
export function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

/** "YYYY-MM" for today (UTC). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ---------- Projects ----------

export function toView(p: Project, holdings: Holding[]): ProjectView {
  const own = holdings.filter((h) => h.projectId === p.id && h.cells > 0);
  return {
    ...p,
    cellsAvailable: p.totalCells - p.cellsSold,
    fundedPct: Math.floor((p.cellsSold * 100) / p.totalCells),
    targetCents: p.totalCells * p.cellPriceCents,
    raisedCents: p.cellsSold * p.cellPriceCents,
    ownerCount: own.length,
    yourCells: own.find((h) => h.investorId === YOU_ID)?.cells ?? 0,
  };
}

export async function listViews(): Promise<ProjectView[]> {
  const [projects, holdings] = await Promise.all([store.listProjects(), store.listHoldings()]);
  return projects.map((p) => toView(p, holdings));
}

export async function requireProject(id: unknown): Promise<Project> {
  if (typeof id !== "string" || !id) throw new ApiError(400, "Missing projectId.");
  const p = await store.getProject(id);
  if (!p) throw new ApiError(404, "Project not found.");
  return p;
}

export async function getView(id: string): Promise<ProjectView> {
  const p = await requireProject(id);
  return toView(p, await store.listHoldings({ projectId: id }));
}

/** Call before reading projects: makes sure every project is vetted and history exists. */
export async function ready(): Promise<void> {
  const projects = await store.listProjects();
  await Promise.all(projects.map((p) => ensureVetted(p.id)));
  await ensureHistory();
}

function ensureVetted(projectId: string): Promise<void> {
  return serialize(`vet:${projectId}`, async () => {
    const p = await store.getProject(projectId);
    if (!p || p.vetting) return;
    const { report } = await vetProject(p);
    await store.setVetting(p.id, report);
  });
}

export async function revet(projectId: string): Promise<{ project: ProjectView; steps: AgentStep[] }> {
  const p = await requireProject(projectId);
  return serialize(`vet:${p.id}`, async () => {
    const { report, steps } = await vetProject(p);
    await store.setVetting(p.id, report);
    return { project: await getView(p.id), steps };
  });
}

// ---------- Months: monitoring + payouts ----------

/** Small deterministic generator so seeded history is identical on every restart. */
function seededRandom(seed: string): () => number {
  let a = 2166136261;
  for (const ch of seed) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs p.nextMonth. The month is claimed first by advancing nextMonth, so it
 * is metered and paid once even if two requests try at the same time.
 * Returns null if another request claimed it first.
 */
async function runMonthFor(
  p: Project,
  opts: { scenario: Scenario; channel: PayoutChannel; rand: () => number; useAi: boolean; createdAt: string },
): Promise<Omit<RunMonthResponse, "mode"> | null> {
  const month = p.nextMonth;
  if (!(await store.setNextMonth(p.id, month, nextMonth(month)))) return null;
  const reportId = store.newId("report");
  let meter: Awaited<ReturnType<typeof readMeter>>;
  try {
    meter = await readMeter(p, month, opts.scenario, opts.rand, opts.useAi);
  } catch (e) {
    // Nothing has been paid yet, so give the month back.
    await store.setNextMonth(p.id, nextMonth(month), month);
    throw e;
  }
  const [holdings, investors] = await Promise.all([
    store.listHoldings({ projectId: p.id }),
    store.listInvestors(),
  ]);
  const s = await settleMonth({
    project: p,
    month,
    reportId,
    actualKwh: meter.reading.actualKwh,
    holdings,
    investors,
    channel: opts.channel,
    createdAt: opts.createdAt,
  });

  const report: MonthlyReport = {
    id: reportId,
    projectId: p.id,
    month,
    ...meter.reading,
    usedKwh: s.usedKwh,
    revenueCents: s.revenueCents,
    platformFeeCents: s.platformFeeCents,
    maintenanceReserveCents: s.maintenanceReserveCents,
    distributableCents: s.distributableCents,
    createdAt: opts.createdAt,
  };
  await store.recordMonth(report, s.payouts);

  const names = new Map(investors.map((i) => [i.id, i.name]));
  return {
    report,
    payouts: s.payouts.map((x) => ({ ...x, investorName: names.get(x.investorId) ?? x.investorId })),
    steps: [...meter.steps, ...s.steps],
  };
}

/**
 * Generates SEED_HISTORY_MONTHS of past months for projects that start out
 * operating. Works towards a fixed end month, so requests that run it at the
 * same time (or resume it after a failure) never add extra months.
 */
function ensureHistory(): Promise<void> {
  return serialize("history", async () => {
    if (await store.isHistorySeeded()) return;
    for (const start of seedProjects) {
      if (start.status !== "operating") continue;
      let end = start.nextMonth;
      for (let i = 0; i < SEED_HISTORY_MONTHS; i++) end = nextMonth(end);
      for (;;) {
        const p = await store.getProject(start.id);
        if (!p || p.status !== "operating" || p.nextMonth >= end) break;
        await runMonthFor(p, {
          scenario: "normal",
          channel: "seeded",
          rand: seededRandom(`${p.id}:${p.nextMonth}`),
          useAi: false,
          // Dated just after the month ended, as a real report would be.
          createdAt: `${nextMonth(p.nextMonth)}-01T09:00:00.000Z`,
        });
      }
    }
    await store.markHistorySeeded();
  });
}

export async function runMonth(projectId: string, scenario: Scenario): Promise<RunMonthResponse> {
  const id = (await requireProject(projectId)).id;
  return serialize(`month:${id}`, async () => {
    // If another request claims the month first, run the one after it.
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = (await store.getProject(id))!;
      if (p.status !== "operating") {
        throw new ApiError(400, `${p.name} is not operating yet. Fill and install it with fast-forward first.`);
      }
      const mode = paypalMode();
      const result = await runMonthFor(p, {
        scenario,
        channel: mode,
        rand: Math.random,
        useAi: aiMode() === "live",
        createdAt: new Date().toISOString(),
      });
      if (result) return { ...result, mode };
    }
    throw new ApiError(409, "Other month runs are in progress for this project. Try again in a moment.");
  });
}

// ---------- Fast-forward ----------

export async function fastForward(projectId: string): Promise<{ project: ProjectView; steps: AgentStep[] }> {
  const id = (await requireProject(projectId)).id;
  return serialize(`cells:${id}`, async () => {
    const p = (await store.getProject(id))!;
    if (p.status === "operating") throw new ApiError(400, `${p.name} is already installed and operating.`);

    const sample = (await store.listInvestors()).filter((i) => !i.isYou);
    const unsold = p.totalCells - p.cellsSold;
    const split = sample.map((inv, i) => ({
      inv,
      cells: Math.floor(unsold / sample.length) + (i < unsold % sample.length ? 1 : 0),
    }));
    const month = currentMonth();
    const grants = split.filter((s) => s.cells > 0).map((s) => ({ investorId: s.inv.id, cells: s.cells }));
    if (!(await store.fillAndInstall(p.id, p.cellsSold, grants, month))) {
      throw new ApiError(409, `Cells in ${p.name} were bought while it was being filled. Please try again.`);
    }
    const project = await getView(p.id);

    const steps: AgentStep[] = [
      unsold > 0
        ? {
            agent: "investor",
            title: `Sold the last ${num(unsold)} cells to sample investors`,
            detail: `${split.filter((s) => s.cells > 0).map((s) => `${s.inv.name} ${num(s.cells)}`).join(", ")}. Sample investors stand in for real buyers in this demo.`,
            status: "ok",
          }
        : { agent: "investor", title: "All cells were already sold", detail: "No sample purchases were needed.", status: "ok" },
      {
        agent: "investor",
        title: "Project fully funded",
        detail: `${money(project.raisedCents)} raised from ${project.ownerCount} owners for ${num(p.totalCells)} cells.`,
        status: "ok",
      },
      {
        agent: "monitoring",
        title: "Plant installed and metering started",
        detail: `${p.capacityKw} kW plant marked as operating. The first month to be metered and paid is ${monthLabel(month)}.`,
        status: "ok",
      },
    ];
    return { project, steps };
  });
}

// ---------- Purchases ----------

/** Throws unless `cells` can be bought in `p` right now. */
export function checkCells(p: Project, cells: unknown): asserts cells is number {
  if (p.status !== "funding") throw new ApiError(409, `${p.name} is no longer selling cells.`);
  if (typeof cells !== "number" || !Number.isInteger(cells) || cells < 1) {
    throw new ApiError(400, "Cells must be a whole number of at least 1.");
  }
  const available = p.totalCells - p.cellsSold;
  if (available === 0) throw new ApiError(409, `${p.name} is fully funded.`);
  if (cells > available) {
    throw new ApiError(409, `Only ${num(available)} cells are left in ${p.name}.`);
  }
}

/** Records a new purchase and the PayPal order the buyer must approve. */
export async function startPurchase(
  p: Project,
  cells: number,
  placedBy: Purchase["placedBy"],
  origin: string,
): Promise<{ purchase: Purchase; approveUrl: string }> {
  checkCells(p, cells);
  const id = store.newId("purchase");
  const amountCents = cells * p.cellPriceCents;

  let orderId: string;
  let approveUrl: string;
  if (paypalMode() === "sandbox") {
    ({ orderId, approveUrl } = await createOrder({
      amountCents,
      description: `${num(cells)} solar cells in ${p.name}`,
      referenceId: id,
      // PayPal appends ?token=<orderId>&PayerID=... to the return URL.
      returnUrl: `${origin}/checkout/return`,
      cancelUrl: `${origin}/projects/${p.id}`,
    }));
  } else {
    orderId = demoId("DEMO-ORDER");
    approveUrl = `/checkout/approve?token=${orderId}`;
  }

  const purchase: Purchase = {
    id,
    investorId: YOU_ID,
    projectId: p.id,
    cells,
    amountCents,
    paypalOrderId: orderId,
    status: "created",
    placedBy,
    createdAt: new Date().toISOString(),
  };
  await store.insertPurchase(purchase);
  return { purchase, approveUrl };
}

/** After this long a capture's hold on cells counts as abandoned (PayPal calls time out after 20s). */
const HOLD_TIMEOUT_MS = 2 * 60_000;
/** How long a second capture of the same order waits for the first to finish. */
const BUSY_WAIT_MS = 500;
const BUSY_WAIT_TRIES = 20;

/**
 * Captures payment (sandbox orders only) and records ownership. Safe to call
 * twice, also at the same time: a completed purchase is returned as it is.
 */
export async function capturePurchase(orderId: string): Promise<Purchase> {
  const found = await store.getPurchaseByOrderId(orderId);
  if (!found) throw new ApiError(404, "Order not found.");
  return serialize(`cells:${found.projectId}`, () => captureNow(found));
}

async function captureNow(purchase: Purchase): Promise<Purchase> {
  const orderId = purchase.paypalOrderId;
  const token = crypto.randomUUID();
  const mandate = purchase.placedBy === "agent" ? await store.getMandate() : undefined;

  // Hold the cells before taking money, so no other order can take them meanwhile.
  // Reaching totalCells leaves the status as "funding"; installation is a separate step.
  for (let tries = 0; ; tries++) {
    const hold = await store.holdCells(purchase, token, {
      staleBefore: new Date(Date.now() - HOLD_TIMEOUT_MS).toISOString(),
      agentBudget: mandate && { month: currentMonth(), limitCents: mandate.monthlyBudgetCents },
    });
    if (hold === "held") break;
    if (hold === "completed") return (await store.getPurchaseByOrderId(orderId))!;
    if (hold === "cancelled") throw new ApiError(409, "This order was cancelled.");
    if (hold === "unavailable") {
      checkCells(await requireProject(purchase.projectId), purchase.cells);
      if (mandate) {
        const left = Math.max(0, mandate.monthlyBudgetCents - (await agentSpentThisMonth()));
        throw new ApiError(409, `${money(purchase.amountCents)} is more than the ${money(left)} left in the agent's monthly budget.`);
      }
      throw new ApiError(409, "Those cells were just taken by another order. Please try again.");
    }
    // "busy": another request is completing this order right now.
    if (tries >= BUSY_WAIT_TRIES) throw new ApiError(409, "This order is still being completed. Refresh in a moment.");
    await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS));
  }

  try {
    if (!orderId.startsWith("DEMO-")) await captureOrder(orderId);
  } catch (e) {
    await store.releaseCells(purchase, token);
    throw e;
  }
  const done = await store.completePurchase(purchase, token);
  if (done.status !== "completed") throw new ApiError(409, "This order could not be completed. Please try again.");
  return done;
}

// ---------- Mandate ----------

export async function agentSpentThisMonth(): Promise<number> {
  const month = currentMonth();
  return (await store.listPurchases(YOU_ID))
    .filter((x) => x.placedBy === "agent" && x.status === "completed" && x.createdAt.startsWith(month))
    .reduce((sum, x) => sum + x.amountCents, 0);
}

/** For purchases the agent places through checkout: enforces the mandate. */
export async function assertWithinMandate(amountCents: number): Promise<void> {
  const [mandate, spent] = await Promise.all([store.getMandate(), agentSpentThisMonth()]);
  if (amountCents > mandate.maxPerPurchaseCents) {
    throw new ApiError(409, `${money(amountCents)} is above the agent's ${money(mandate.maxPerPurchaseCents)} per-purchase limit.`);
  }
  const left = Math.max(0, mandate.monthlyBudgetCents - spent);
  if (amountCents > left) {
    throw new ApiError(409, `${money(amountCents)} is more than the ${money(left)} left in the agent's monthly budget.`);
  }
}
