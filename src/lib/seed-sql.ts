// Turns the sample data in seed.ts into SQL statements for D1. Used by the D1
// store to reset the demo and by scripts/seed-sql.ts to write the seed file,
// so both always match seed.ts.
//
// Only type imports here: scripts/seed-sql.ts runs this file with Node's
// built-in TypeScript support, which cannot resolve extensionless imports.

import type * as Seed from "./seed";

export type SqlValue = string | number | null;

export interface SqlStatement {
  sql: string;
  params: SqlValue[];
}

/** Every table, children before parents so deletes respect foreign keys. */
const TABLES = ["payouts", "reports", "purchases", "holdings", "projects", "investors", "mandate", "flags"];

/**
 * INSERT for one row whose keys are column names. Undefined values are left
 * out (NULL), booleans become 0/1 and objects are stored as JSON.
 */
export function insert(table: string, row: object): SqlStatement {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([k]) => k).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, v]) =>
      typeof v === "boolean" ? Number(v) : v !== null && typeof v === "object" ? JSON.stringify(v) : v,
    ),
  };
}

/** Empties every table and inserts the sample data. */
export function seedStatements(seed: typeof Seed): SqlStatement[] {
  return [
    ...TABLES.map((t) => ({ sql: `DELETE FROM ${t}`, params: [] })),
    ...seed.seedInvestors.map((i) => insert("investors", i)),
    ...seed.seedProjects.map((p) => insert("projects", p)),
    ...seed.seedHoldings.map((h) => insert("holdings", h)),
    insert("mandate", { id: 1, ...seed.seedMandate }),
  ];
}

function literal(v: SqlValue): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replaceAll("'", "''")}'`;
}

/** Renders statements as a SQL file, with values written inline. */
export function toSqlScript(statements: SqlStatement[]): string {
  return statements
    .map(({ sql, params }) => {
      const parts = sql.split("?");
      if (parts.length !== params.length + 1) throw new Error(`Parameter count mismatch in: ${sql}`);
      return parts.reduce((out, part, i) => out + literal(params[i - 1]) + part) + ";\n";
    })
    .join("");
}
