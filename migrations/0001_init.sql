-- SunShare schema for Cloudflare D1 (SQLite).
-- Column names match the fields in src/lib/types.ts. Money is integer US cents;
-- STRICT tables reject a fractional value in an INTEGER column.

CREATE TABLE investors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  paypalEmail TEXT NOT NULL,
  isYou INTEGER NOT NULL CHECK (isYou IN (0, 1))
) STRICT;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('clinic', 'irrigation', 'cold-storage')),
  status TEXT NOT NULL CHECK (status IN ('funding', 'operating')),
  locationName TEXT NOT NULL,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  summary TEXT NOT NULL,
  impact TEXT NOT NULL,
  capacityKw REAL NOT NULL,
  totalCells INTEGER NOT NULL CHECK (totalCells > 0),
  cellsSold INTEGER NOT NULL,
  cellPriceCents INTEGER NOT NULL,
  tariffCentsPerKwh INTEGER NOT NULL,
  previousCostCentsPerKwh INTEGER NOT NULL,
  utilisation REAL NOT NULL,
  nextMonth TEXT NOT NULL,
  -- The stored vetting report (VettingReport as JSON); NULL until vetted.
  vetting TEXT,
  -- Last line of defence against overselling.
  CHECK (cellsSold BETWEEN 0 AND totalCells)
) STRICT;

CREATE TABLE holdings (
  investorId TEXT NOT NULL REFERENCES investors (id),
  projectId TEXT NOT NULL REFERENCES projects (id),
  cells INTEGER NOT NULL CHECK (cells >= 0),
  PRIMARY KEY (investorId, projectId)
) STRICT;

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  investorId TEXT NOT NULL REFERENCES investors (id),
  projectId TEXT NOT NULL REFERENCES projects (id),
  cells INTEGER NOT NULL CHECK (cells > 0),
  amountCents INTEGER NOT NULL,
  -- One purchase per PayPal order.
  paypalOrderId TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('created', 'completed', 'cancelled')),
  placedBy TEXT NOT NULL CHECK (placedBy IN ('you', 'agent')),
  createdAt TEXT NOT NULL,
  -- Set while a capture holds this purchase's cells (already counted in
  -- projects.cellsSold) and charges PayPal. Not part of the Purchase type.
  holdToken TEXT,
  heldAt TEXT
) STRICT;

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects (id),
  month TEXT NOT NULL,
  forecastKwh INTEGER NOT NULL,
  actualKwh INTEGER NOT NULL,
  performance REAL NOT NULL,
  health TEXT NOT NULL CHECK (health IN ('healthy', 'watch', 'underperforming')),
  note TEXT NOT NULL,
  usedKwh INTEGER NOT NULL,
  revenueCents INTEGER NOT NULL,
  platformFeeCents INTEGER NOT NULL,
  maintenanceReserveCents INTEGER NOT NULL,
  distributableCents INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  -- One report per project and month.
  UNIQUE (projectId, month)
) STRICT;

CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  reportId TEXT NOT NULL REFERENCES reports (id),
  projectId TEXT NOT NULL REFERENCES projects (id),
  investorId TEXT NOT NULL REFERENCES investors (id),
  month TEXT NOT NULL,
  cells INTEGER NOT NULL,
  amountCents INTEGER NOT NULL,
  paypalBatchId TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'seeded', 'failed')),
  createdAt TEXT NOT NULL,
  UNIQUE (reportId, investorId)
) STRICT;

-- The investor agent's spending limits: a single row.
CREATE TABLE mandate (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  maxPerPurchaseCents INTEGER NOT NULL,
  monthlyBudgetCents INTEGER NOT NULL
) STRICT;

-- Named on/off flags. A row means the flag is set ('historySeeded').
CREATE TABLE flags (
  name TEXT PRIMARY KEY
) STRICT;
