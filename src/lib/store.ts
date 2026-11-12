// Data access. Routes and agents read and write data only through these functions.
//
// Two implementations with the same behaviour:
// - store-d1.ts: Cloudflare D1, used on Workers when the D1 binding `DB` exists.
// - store-memory.ts: in memory, used everywhere else (including `next dev`).
// The choice is made on every call, in impl() below.
//
// On Workers, requests can run in different isolates at once, so writes that
// must not race (capturing a purchase, filling a project, running a month) are
// single store calls that check and write atomically.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { d1Store, type D1Database } from "./store-d1";
import { memoryStore } from "./store-memory";
import type {
  Holding,
  Investor,
  Mandate,
  MonthlyReport,
  Payout,
  Project,
  Purchase,
  VettingReport,
} from "./types";

/**
 * Outcome of holdCells: "held" means this caller now holds the cells; "busy"
 * means another request holds them; "unavailable" means the project has no
 * room, is not funding, or the agent's monthly budget does not allow it.
 */
export type HoldResult = "held" | "busy" | "unavailable" | "completed" | "cancelled";

export interface Store {
  /** Replaces all data with the seed. */
  resetStore(): Promise<void>;

  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  setVetting(projectId: string, vetting: VettingReport): Promise<void>;
  /**
   * Gives `grants` the unsold cells and marks the project operating from `month`,
   * only if it is still funding with exactly `cellsSoldBefore` sold. Returns whether it did.
   */
  fillAndInstall(
    projectId: string,
    cellsSoldBefore: number,
    grants: { investorId: string; cells: number }[],
    month: string,
  ): Promise<boolean>;
  /** Sets an operating project's nextMonth only if it is still `expected`. Returns whether it did. */
  setNextMonth(projectId: string, expected: string, value: string): Promise<boolean>;

  listInvestors(): Promise<Investor[]>;
  getInvestor(id: string): Promise<Investor | undefined>;

  listHoldings(filter?: { projectId?: string; investorId?: string }): Promise<Holding[]>;

  listPurchases(investorId?: string): Promise<Purchase[]>;
  getPurchaseByOrderId(paypalOrderId: string): Promise<Purchase | undefined>;
  insertPurchase(p: Purchase): Promise<void>;
  /**
   * Step 1 of a capture: counts a created purchase's cells as sold, if the project
   * still has room and, with `agentBudget`, an agent purchase fits the month's
   * budget (completed and held agent purchases count). A hold older than
   * `staleBefore` (ISO time) was abandoned and is taken over as it is.
   */
  holdCells(
    purchase: Purchase,
    token: string,
    opts: { staleBefore: string; agentBudget?: { month: string; limitCents: number } },
  ): Promise<HoldResult>;
  /** Gives held cells back, if `token` still holds them (payment failed). */
  releaseCells(purchase: Purchase, token: string): Promise<void>;
  /** Step 2: if `token` still holds the cells, adds them to the buyer's holding and completes the purchase. Returns it as stored. */
  completePurchase(purchase: Purchase, token: string): Promise<Purchase>;

  listReports(projectId?: string): Promise<MonthlyReport[]>;
  /** Saves a month's report and its payouts together. */
  recordMonth(report: MonthlyReport, payouts: Payout[]): Promise<void>;

  listPayouts(filter?: { projectId?: string; investorId?: string }): Promise<Payout[]>;

  getMandate(): Promise<Mandate>;
  setMandate(m: Mandate): Promise<void>;

  /** Whether the sample payout history has been generated. */
  isHistorySeeded(): Promise<boolean>;
  markHistorySeeded(): Promise<void>;
}

let warnedNoDb = false;

function impl(): Store {
  let env: { DB?: D1Database };
  try {
    env = getCloudflareContext().env as { DB?: D1Database };
  } catch {
    return memoryStore; // Not on Workers, e.g. `next dev`.
  }
  if (env.DB) return d1Store(env.DB);
  if (!warnedNoDb) {
    warnedNoDb = true;
    console.warn("No D1 binding named DB: using in-memory data, which is not shared between Worker isolates.");
  }
  return memoryStore;
}

/** Each export forwards to the store chosen for the current request. */
function forward<K extends keyof Store>(name: K): Store[K] {
  return ((...args: unknown[]) => (impl()[name] as (...a: unknown[]) => unknown)(...args)) as Store[K];
}

export const resetStore = forward("resetStore");
export const listProjects = forward("listProjects");
export const getProject = forward("getProject");
export const setVetting = forward("setVetting");
export const fillAndInstall = forward("fillAndInstall");
export const setNextMonth = forward("setNextMonth");
export const listInvestors = forward("listInvestors");
export const getInvestor = forward("getInvestor");
export const listHoldings = forward("listHoldings");
export const listPurchases = forward("listPurchases");
export const getPurchaseByOrderId = forward("getPurchaseByOrderId");
export const insertPurchase = forward("insertPurchase");
export const holdCells = forward("holdCells");
export const releaseCells = forward("releaseCells");
export const completePurchase = forward("completePurchase");
export const listReports = forward("listReports");
export const recordMonth = forward("recordMonth");
export const listPayouts = forward("listPayouts");
export const getMandate = forward("getMandate");
export const setMandate = forward("setMandate");
export const isHistorySeeded = forward("isHistorySeeded");
export const markHistorySeeded = forward("markHistorySeeded");

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
