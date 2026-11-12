// Cloudflare D1 store (schema in migrations/0001_init.sql). Same behaviour as
// store-memory.ts, but requests may run in different Worker isolates at once,
// so writes that must not race are guarded by the database itself:
// conditional UPDATEs, UNIQUE and CHECK constraints, and batches, which D1
// runs as one transaction (all statements succeed or none do).

import * as seed from "./seed";
import { insert, seedStatements, type SqlStatement, type SqlValue } from "./seed-sql";
import type { HoldResult, Store } from "./store";
import type { Holding, Investor, Mandate, MonthlyReport, Payout, Project, Purchase, PurchaseStatus } from "./types";

/** The part of the Workers D1 binding this file uses. */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
interface D1PreparedStatement {
  bind(...values: SqlValue[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1Result<T = unknown> {
  results: T[];
  meta: { changes: number };
}

type Row = Record<string, SqlValue>;

const PURCHASE = "id, investorId, projectId, cells, amountCents, paypalOrderId, status, placedBy, createdAt";

function toProject({ vetting, ...rest }: Row): Project {
  return { ...(rest as unknown as Project), ...(vetting ? { vetting: JSON.parse(vetting as string) } : {}) };
}

function toInvestor(r: Row): Investor {
  return { ...(r as unknown as Investor), isYou: r.isYou === 1 };
}

/** Adds cells to a holding (params: investorId, projectId, cells), only where `guard` is true. */
const addCellsWhere = (guard: string) =>
  `INSERT INTO holdings (investorId, projectId, cells) SELECT ?, ?, ? WHERE ${guard} ` +
  "ON CONFLICT (investorId, projectId) DO UPDATE SET cells = cells + excluded.cells";

/** True while `token` holds the cells of a still-open purchase. Params: id, token. */
const HELD_BY = "EXISTS (SELECT 1 FROM purchases WHERE id = ? AND holdToken = ? AND status = 'created')";

export function d1Store(db: D1Database): Store {
  const q = (sql: string, ...params: SqlValue[]) => db.prepare(sql).bind(...params);
  const prepared = ({ sql, params }: SqlStatement) => q(sql, ...params);
  const rows = async <T>(sql: string, ...params: SqlValue[]) => (await q(sql, ...params).all<T>()).results;
  const getPurchase = (id: string) => q(`SELECT ${PURCHASE} FROM purchases WHERE id = ?`, id).first<Purchase>();

  return {
    async resetStore() {
      await db.batch(seedStatements(seed).map(prepared));
    },

    async listProjects() {
      return (await rows<Row>("SELECT * FROM projects ORDER BY rowid")).map(toProject);
    },

    async getProject(id) {
      const r = await q("SELECT * FROM projects WHERE id = ?", id).first<Row>();
      return r ? toProject(r) : undefined;
    },

    async setVetting(projectId, vetting) {
      const { meta } = await q("UPDATE projects SET vetting = ? WHERE id = ?", JSON.stringify(vetting), projectId).run();
      if (!meta.changes) throw new Error(`Project not found: ${projectId}`);
    },

    async fillAndInstall(projectId, cellsSoldBefore, grants, month) {
      const unchanged = "EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'funding' AND cellsSold = ?)";
      const results = await db.batch([
        ...grants.map((g) =>
          q(addCellsWhere(unchanged), g.investorId, projectId, g.cells, projectId, cellsSoldBefore),
        ),
        q(
          "UPDATE projects SET cellsSold = totalCells, status = 'operating', nextMonth = ? " +
            "WHERE id = ? AND status = 'funding' AND cellsSold = ?",
          month,
          projectId,
          cellsSoldBefore,
        ),
      ]);
      return results[results.length - 1].meta.changes === 1;
    },

    async setNextMonth(projectId, expected, value) {
      const { meta } = await q(
        "UPDATE projects SET nextMonth = ? WHERE id = ? AND status = 'operating' AND nextMonth = ?",
        value,
        projectId,
        expected,
      ).run();
      return meta.changes === 1;
    },

    async listInvestors() {
      return (await rows<Row>("SELECT * FROM investors ORDER BY rowid")).map(toInvestor);
    },

    async getInvestor(id) {
      const r = await q("SELECT * FROM investors WHERE id = ?", id).first<Row>();
      return r ? toInvestor(r) : undefined;
    },

    async listHoldings(filter) {
      return rows<Holding>(
        "SELECT investorId, projectId, cells FROM holdings " +
          "WHERE (?1 IS NULL OR projectId = ?1) AND (?2 IS NULL OR investorId = ?2) ORDER BY rowid",
        filter?.projectId || null,
        filter?.investorId || null,
      );
    },

    async listPurchases(investorId) {
      return rows<Purchase>(
        `SELECT ${PURCHASE} FROM purchases WHERE (?1 IS NULL OR investorId = ?1) ORDER BY rowid`,
        investorId || null,
      );
    },

    async getPurchaseByOrderId(paypalOrderId) {
      return (await q(`SELECT ${PURCHASE} FROM purchases WHERE paypalOrderId = ?`, paypalOrderId).first<Purchase>()) ?? undefined;
    },

    async insertPurchase(p) {
      await prepared(insert("purchases", p)).run();
    },

    async holdCells(p, token, { staleBefore, agentBudget }): Promise<HoldResult> {
      const now = new Date().toISOString();
      const room = "EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'funding' AND cellsSold + ? <= totalCells)";
      const budget =
        agentBudget && p.placedBy === "agent"
          ? {
              sql:
                " AND (SELECT COALESCE(SUM(amountCents), 0) FROM purchases WHERE investorId = ? AND placedBy = 'agent'" +
                " AND substr(createdAt, 1, 7) = ? AND (status = 'completed' OR holdToken IS NOT NULL)) + ? <= ?",
              params: [p.investorId, agentBudget.month, p.amountCents, agentBudget.limitCents],
            }
          : { sql: "", params: [] };
      const [, , , state] = await db.batch([
        // A new hold, only if the project has room (and the budget allows).
        q(
          `UPDATE purchases SET holdToken = ?, heldAt = ? WHERE id = ? AND status = 'created' AND holdToken IS NULL AND ${room}${budget.sql}`,
          token,
          now,
          p.id,
          p.projectId,
          p.cells,
          ...budget.params,
        ),
        // Count the newly held cells as sold. (The takeover below has not run yet.)
        q(`UPDATE projects SET cellsSold = cellsSold + ? WHERE id = ? AND ${HELD_BY}`, p.cells, p.projectId, p.id, token),
        // Take over a hold abandoned part way; its cells are already counted.
        q(
          "UPDATE purchases SET holdToken = ?, heldAt = ? WHERE id = ? AND status = 'created' AND holdToken <> ? AND heldAt < ?",
          token,
          now,
          p.id,
          token,
          staleBefore,
        ),
        q("SELECT status, holdToken FROM purchases WHERE id = ?", p.id),
      ]);
      const row = state.results[0] as { status: PurchaseStatus; holdToken: string | null } | undefined;
      if (!row) throw new Error(`Purchase not found: ${p.id}`);
      if (row.holdToken === token) return "held";
      if (row.status !== "created") return row.status;
      return row.holdToken ? "busy" : "unavailable";
    },

    async releaseCells(p, token) {
      await db.batch([
        q(`UPDATE projects SET cellsSold = cellsSold - ? WHERE id = ? AND ${HELD_BY}`, p.cells, p.projectId, p.id, token),
        q("UPDATE purchases SET holdToken = NULL, heldAt = NULL WHERE id = ? AND holdToken = ? AND status = 'created'", p.id, token),
      ]);
    },

    async completePurchase(p, token) {
      await db.batch([
        q(addCellsWhere(HELD_BY), p.investorId, p.projectId, p.cells, p.id, token),
        q(
          "UPDATE purchases SET status = 'completed', holdToken = NULL, heldAt = NULL WHERE id = ? AND holdToken = ? AND status = 'created'",
          p.id,
          token,
        ),
      ]);
      const stored = await getPurchase(p.id);
      if (!stored) throw new Error(`Purchase not found: ${p.id}`);
      return stored;
    },

    async listReports(projectId) {
      return rows<MonthlyReport>("SELECT * FROM reports WHERE (?1 IS NULL OR projectId = ?1) ORDER BY rowid", projectId || null);
    },

    async recordMonth(report, payouts) {
      await db.batch([insert("reports", report), ...payouts.map((x) => insert("payouts", x))].map(prepared));
    },

    async listPayouts(filter) {
      return rows<Payout>(
        "SELECT * FROM payouts WHERE (?1 IS NULL OR projectId = ?1) AND (?2 IS NULL OR investorId = ?2) ORDER BY rowid",
        filter?.projectId || null,
        filter?.investorId || null,
      );
    },

    async getMandate() {
      const m = await q("SELECT maxPerPurchaseCents, monthlyBudgetCents FROM mandate WHERE id = 1").first<Mandate>();
      if (!m) throw new Error("The database has no data yet. Run the seed step in docs/DEPLOY.md.");
      return m;
    },

    async setMandate(m) {
      await q(
        "INSERT INTO mandate (id, maxPerPurchaseCents, monthlyBudgetCents) VALUES (1, ?, ?) " +
          "ON CONFLICT (id) DO UPDATE SET maxPerPurchaseCents = excluded.maxPerPurchaseCents, " +
          "monthlyBudgetCents = excluded.monthlyBudgetCents",
        m.maxPerPurchaseCents,
        m.monthlyBudgetCents,
      ).run();
    },

    async isHistorySeeded() {
      return (await q("SELECT 1 AS x FROM flags WHERE name = 'historySeeded'").first()) !== null;
    },

    async markHistorySeeded() {
      await q("INSERT OR IGNORE INTO flags (name) VALUES ('historySeeded')").run();
    },
  };
}
