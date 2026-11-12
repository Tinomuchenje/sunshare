// Writes the D1 seed SQL generated from src/lib/seed.ts.
// Usage: node --experimental-strip-types scripts/seed-sql.ts [output-file]
// With no file it prints to stdout. Running the output empties every table first.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as seed from "../src/lib/seed.ts";
import { seedStatements, toSqlScript } from "../src/lib/seed-sql.ts";

const sql = `-- Generated from src/lib/seed.ts by scripts/seed-sql.ts. Do not edit.\n${toSqlScript(seedStatements(seed))}`;
const out = process.argv[2];
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, sql);
} else {
  process.stdout.write(sql);
}
