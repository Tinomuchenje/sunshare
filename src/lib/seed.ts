import type { Holding, Investor, Mandate, Project } from "./types";

// Sample data for the prototype. Project names and people are invented.

export const YOU_ID = "you";

export const seedInvestors: Investor[] = [
  { id: YOU_ID, name: "You", paypalEmail: "investor@example.com", isYou: true },
  { id: "inv-a", name: "Tariro M.", paypalEmail: "tariro@example.com", isYou: false },
  { id: "inv-b", name: "Kwame A.", paypalEmail: "kwame@example.com", isYou: false },
  { id: "inv-c", name: "Amina H.", paypalEmail: "amina@example.com", isYou: false },
  { id: "inv-d", name: "Sipho N.", paypalEmail: "sipho@example.com", isYou: false },
  { id: "inv-e", name: "Grace O.", paypalEmail: "grace@example.com", isYou: false },
  { id: "inv-f", name: "Daniel K.", paypalEmail: "daniel@example.com", isYou: false },
];

export const seedProjects: Project[] = [
  {
    id: "clinic-goromonzi",
    name: "Chikwaka Rural Clinic",
    kind: "clinic",
    status: "funding",
    locationName: "Goromonzi District",
    country: "Zimbabwe",
    lat: -17.75,
    lon: 31.45,
    summary:
      "Solar and battery storage to keep vaccine fridges cold and the maternity ward lit through the night.",
    impact: "Reliable power for a clinic serving about 8,000 people",
    capacityKw: 12,
    totalCells: 2800,
    cellsSold: 1736,
    cellPriceCents: 500,
    tariffCentsPerKwh: 13,
    previousCostCentsPerKwh: 38,
    utilisation: 0.85,
    nextMonth: "2026-11",
  },
  {
    id: "irrigation-mutoko",
    name: "Mutoko Smallholder Irrigation",
    kind: "irrigation",
    status: "funding",
    locationName: "Mutoko District",
    country: "Zimbabwe",
    lat: -17.4,
    lon: 32.22,
    summary:
      "Solar pumps that let 64 smallholder farmers grow vegetables year-round instead of one rain-fed harvest.",
    impact: "Year-round irrigation for 64 farming families",
    capacityKw: 20,
    totalCells: 4400,
    cellsSold: 3872,
    cellPriceCents: 500,
    tariffCentsPerKwh: 11,
    previousCostCentsPerKwh: 42,
    utilisation: 0.8,
    nextMonth: "2026-11",
  },
  {
    id: "coldroom-kisumu",
    name: "Kisumu Produce Cold Room",
    kind: "cold-storage",
    status: "operating",
    locationName: "Kisumu County",
    country: "Kenya",
    lat: -0.09,
    lon: 34.77,
    summary:
      "A solar-powered cold room where fish traders and vegetable farmers store produce instead of losing it to heat.",
    impact: "Cuts spoilage for about 120 traders and farmers",
    capacityKw: 15,
    totalCells: 3300,
    cellsSold: 3300,
    cellPriceCents: 500,
    tariffCentsPerKwh: 14,
    previousCostCentsPerKwh: 35,
    utilisation: 0.9,
    nextMonth: "2026-08",
  },
];

export const seedHoldings: Holding[] = [
  { investorId: "inv-a", projectId: "clinic-goromonzi", cells: 520 },
  { investorId: "inv-b", projectId: "clinic-goromonzi", cells: 410 },
  { investorId: "inv-c", projectId: "clinic-goromonzi", cells: 336 },
  { investorId: "inv-d", projectId: "clinic-goromonzi", cells: 250 },
  { investorId: "inv-e", projectId: "clinic-goromonzi", cells: 220 },

  { investorId: "inv-a", projectId: "irrigation-mutoko", cells: 900 },
  { investorId: "inv-b", projectId: "irrigation-mutoko", cells: 760 },
  { investorId: "inv-c", projectId: "irrigation-mutoko", cells: 700 },
  { investorId: "inv-d", projectId: "irrigation-mutoko", cells: 612 },
  { investorId: "inv-e", projectId: "irrigation-mutoko", cells: 500 },
  { investorId: "inv-f", projectId: "irrigation-mutoko", cells: 400 },

  { investorId: "inv-a", projectId: "coldroom-kisumu", cells: 800 },
  { investorId: "inv-b", projectId: "coldroom-kisumu", cells: 700 },
  { investorId: "inv-c", projectId: "coldroom-kisumu", cells: 600 },
  { investorId: "inv-d", projectId: "coldroom-kisumu", cells: 500 },
  { investorId: "inv-e", projectId: "coldroom-kisumu", cells: 400 },
  { investorId: "inv-f", projectId: "coldroom-kisumu", cells: 300 },
];

/** Average peak sun hours per day, used when the NASA POWER lookup is unavailable. */
export const seedSunHours: Record<string, number> = {
  "clinic-goromonzi": 5.6,
  "irrigation-mutoko": 5.8,
  "coldroom-kisumu": 5.4,
};

export const seedMandate: Mandate = {
  maxPerPurchaseCents: 10000,
  monthlyBudgetCents: 20000,
};

/** Months of history to generate for the operating project on first load. */
export const SEED_HISTORY_MONTHS = 3;
