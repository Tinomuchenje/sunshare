// Shared domain types. All money is in integer US cents.

export type ProjectKind = "clinic" | "irrigation" | "cold-storage";
export type ProjectStatus = "funding" | "operating";

export interface VettingReport {
  /** 0-100, higher is safer. */
  score: number;
  grade: "A" | "B" | "C" | "D";
  /** Average peak sun hours per day at the site (kWh/m2/day). */
  sunHoursPerDay: number;
  /** Where the sunlight figure came from. */
  sunDataSource: "nasa-power" | "seeded";
  forecastKwhPerMonth: number;
  /** Estimated yearly income per cell as a percentage of cell price. Not guaranteed. */
  estimatedYieldPct: number;
  /** Short plain-language summary an investor can read in 10 seconds. */
  summary: string;
  strengths: string[];
  risks: string[];
  /** "ai" when a language model wrote the narrative, "rules" in demo mode. */
  writtenBy: "ai" | "rules";
}

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  locationName: string;
  country: string;
  lat: number;
  lon: number;
  /** One sentence on what the solar plant powers. */
  summary: string;
  /** Who benefits, in one line. */
  impact: string;
  capacityKw: number;
  totalCells: number;
  cellsSold: number;
  cellPriceCents: number;
  /** What the clinic or farm pays per kWh it uses. */
  tariffCentsPerKwh: number;
  /** What the site paid for diesel or grid power before, for comparison. */
  previousCostCentsPerKwh: number;
  /** Share of generated energy the site actually uses, 0-1. */
  utilisation: number;
  /** Next month to be simulated, "YYYY-MM". Only meaningful when operating. */
  nextMonth: string;
  vetting?: VettingReport;
}

export interface Investor {
  id: string;
  name: string;
  /** PayPal email that payouts are sent to. */
  paypalEmail: string;
  /** True for the person using the demo. */
  isYou: boolean;
}

export interface Holding {
  investorId: string;
  projectId: string;
  cells: number;
}

export type PurchaseStatus = "created" | "completed" | "cancelled";

export interface Purchase {
  id: string;
  investorId: string;
  projectId: string;
  cells: number;
  amountCents: number;
  /** PayPal order id (real in sandbox mode, generated in demo mode). */
  paypalOrderId: string;
  status: PurchaseStatus;
  /** "you" when bought by hand, "agent" when the investor agent bought it. */
  placedBy: "you" | "agent";
  createdAt: string;
}

export type PlantHealth = "healthy" | "watch" | "underperforming";

export interface MonthlyReport {
  id: string;
  projectId: string;
  /** "YYYY-MM" */
  month: string;
  forecastKwh: number;
  actualKwh: number;
  /** actual / forecast */
  performance: number;
  health: PlantHealth;
  /** Monitoring agent's one-line finding. */
  note: string;
  usedKwh: number;
  revenueCents: number;
  platformFeeCents: number;
  maintenanceReserveCents: number;
  distributableCents: number;
  createdAt: string;
}

export type PayoutStatus = "sent" | "seeded" | "failed";

export interface Payout {
  id: string;
  reportId: string;
  projectId: string;
  investorId: string;
  month: string;
  cells: number;
  amountCents: number;
  /** PayPal payout batch id (real in sandbox mode, generated in demo mode). */
  paypalBatchId: string;
  status: PayoutStatus;
  createdAt: string;
}

/** What the investor has authorised the investor agent to do. */
export interface Mandate {
  /** Most the agent may spend in one purchase. */
  maxPerPurchaseCents: number;
  /** Most the agent may spend in a calendar month. */
  monthlyBudgetCents: number;
}

export type Mode = "demo" | "sandbox";
export type AiMode = "demo" | "live";

export const PLATFORM_FEE_RATE = 0.1;
export const MAINTENANCE_RESERVE_RATE = 0.1;
export const SYSTEM_EFFICIENCY = 0.78;
