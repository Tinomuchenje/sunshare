// In-memory store, used by `next dev` and whenever there is no D1 binding.
// Data resets when the server restarts or when resetStore() is called.
// No function awaits between its checks and its writes, so each one is atomic
// within the process, as the matching D1 statements are in the database.

import { seedHoldings, seedInvestors, seedMandate, seedProjects } from "./seed";
import type { HoldResult, Store } from "./store";
import type { Holding, Investor, Mandate, MonthlyReport, Payout, Project, Purchase } from "./types";

interface Db {
  projects: Project[];
  investors: Investor[];
  holdings: Holding[];
  purchases: Purchase[];
  reports: MonthlyReport[];
  payouts: Payout[];
  mandate: Mandate;
  /** Set once the seeded payout history has been generated. */
  historySeeded: boolean;
  /** Captures in progress: purchase id -> the hold on its cells. */
  holds: Map<string, { token: string; heldAt: string }>;
}

function freshDb(): Db {
  return structuredClone({
    projects: seedProjects,
    investors: seedInvestors,
    holdings: seedHoldings,
    purchases: [] as Purchase[],
    reports: [] as MonthlyReport[],
    payouts: [] as Payout[],
    mandate: seedMandate,
    historySeeded: false,
    holds: new Map(),
  });
}

const g = globalThis as unknown as { __sunshareDb?: Db };

function db(): Db {
  if (!g.__sunshareDb) g.__sunshareDb = freshDb();
  return g.__sunshareDb;
}

function project(id: string): Project {
  const p = db().projects.find((x) => x.id === id);
  if (!p) throw new Error(`Project not found: ${id}`);
  return p;
}

function purchase(id: string): Purchase {
  const p = db().purchases.find((x) => x.id === id);
  if (!p) throw new Error(`Purchase not found: ${id}`);
  return p;
}

function addCells(investorId: string, projectId: string, cells: number): void {
  const h = db().holdings.find((x) => x.investorId === investorId && x.projectId === projectId);
  if (h) h.cells += cells;
  else db().holdings.push({ investorId, projectId, cells });
}

/** Completed and held agent purchases by `investorId` created in `month`. */
function agentSpent(investorId: string, month: string): number {
  return db()
    .purchases.filter(
      (x) =>
        x.investorId === investorId &&
        x.placedBy === "agent" &&
        x.createdAt.startsWith(month) &&
        (x.status === "completed" || db().holds.has(x.id)),
    )
    .reduce((sum, x) => sum + x.amountCents, 0);
}

/** Whether `token` holds the cells of a still-open purchase. */
function holds(p: Purchase, token: string): boolean {
  return p.status === "created" && db().holds.get(p.id)?.token === token;
}

export const memoryStore: Store = {
  async resetStore() {
    g.__sunshareDb = freshDb();
  },

  async listProjects() {
    return structuredClone(db().projects);
  },

  async getProject(id) {
    const p = db().projects.find((x) => x.id === id);
    return p ? structuredClone(p) : undefined;
  },

  async setVetting(projectId, vetting) {
    project(projectId).vetting = structuredClone(vetting);
  },

  async fillAndInstall(projectId, cellsSoldBefore, grants, month) {
    const p = project(projectId);
    if (p.status !== "funding" || p.cellsSold !== cellsSoldBefore) return false;
    for (const { investorId, cells } of grants) addCells(investorId, projectId, cells);
    Object.assign(p, { cellsSold: p.totalCells, status: "operating", nextMonth: month });
    return true;
  },

  async setNextMonth(projectId, expected, value) {
    const p = project(projectId);
    if (p.status !== "operating" || p.nextMonth !== expected) return false;
    p.nextMonth = value;
    return true;
  },

  async listInvestors() {
    return structuredClone(db().investors);
  },

  async getInvestor(id) {
    const i = db().investors.find((x) => x.id === id);
    return i ? structuredClone(i) : undefined;
  },

  async listHoldings(filter) {
    return structuredClone(
      db().holdings.filter(
        (h) =>
          (!filter?.projectId || h.projectId === filter.projectId) &&
          (!filter?.investorId || h.investorId === filter.investorId),
      ),
    );
  },

  async listPurchases(investorId) {
    return structuredClone(db().purchases.filter((p) => !investorId || p.investorId === investorId));
  },

  async getPurchaseByOrderId(paypalOrderId) {
    const p = db().purchases.find((x) => x.paypalOrderId === paypalOrderId);
    return p ? structuredClone(p) : undefined;
  },

  async insertPurchase(p) {
    if (db().purchases.some((x) => x.paypalOrderId === p.paypalOrderId)) {
      throw new Error(`Duplicate PayPal order: ${p.paypalOrderId}`);
    }
    db().purchases.push(structuredClone(p));
  },

  async holdCells(input, token, { staleBefore, agentBudget }): Promise<HoldResult> {
    const p = purchase(input.id);
    if (p.status !== "created") return p.status;
    const now = new Date().toISOString();
    const hold = db().holds.get(p.id);
    if (hold) {
      if (hold.heldAt >= staleBefore) return "busy";
      // The earlier capture stopped part way; its cells are still counted as sold.
      db().holds.set(p.id, { token, heldAt: now });
      return "held";
    }
    const pr = project(p.projectId);
    const room = pr.status === "funding" && pr.cellsSold + p.cells <= pr.totalCells;
    const budgetOk =
      !agentBudget ||
      p.placedBy !== "agent" ||
      agentSpent(p.investorId, agentBudget.month) + p.amountCents <= agentBudget.limitCents;
    if (!room || !budgetOk) return "unavailable";
    pr.cellsSold += p.cells;
    db().holds.set(p.id, { token, heldAt: now });
    return "held";
  },

  async releaseCells(input, token) {
    const p = purchase(input.id);
    if (!holds(p, token)) return;
    project(p.projectId).cellsSold -= p.cells;
    db().holds.delete(p.id);
  },

  async completePurchase(input, token) {
    const p = purchase(input.id);
    if (holds(p, token)) {
      addCells(p.investorId, p.projectId, p.cells);
      p.status = "completed";
      db().holds.delete(p.id);
    }
    return structuredClone(p);
  },

  async listReports(projectId) {
    return structuredClone(db().reports.filter((r) => !projectId || r.projectId === projectId));
  },

  async recordMonth(report, payouts) {
    if (db().reports.some((r) => r.projectId === report.projectId && r.month === report.month)) {
      throw new Error(`A report for ${report.projectId} ${report.month} already exists.`);
    }
    db().reports.push(structuredClone(report));
    db().payouts.push(...structuredClone(payouts));
  },

  async listPayouts(filter) {
    return structuredClone(
      db().payouts.filter(
        (p) =>
          (!filter?.projectId || p.projectId === filter.projectId) &&
          (!filter?.investorId || p.investorId === filter.investorId),
      ),
    );
  },

  async getMandate() {
    return structuredClone(db().mandate);
  },

  async setMandate(m) {
    db().mandate = structuredClone(m);
  },

  async isHistorySeeded() {
    return db().historySeeded;
  },

  async markHistorySeeded() {
    db().historySeeded = true;
  },
};
