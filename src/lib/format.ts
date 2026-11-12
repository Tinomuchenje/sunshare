// Formatting helpers shared by server and client code.

/** 1250 -> "$12.50", 500 -> "$5" */
export function money(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/** Always two decimals, for ledgers: 500 -> "$5.00" */
export function moneyExact(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** 1543.6 -> "1,544" */
export function num(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** 61.9 -> "62%" */
export function pct(n: number, digits = 0): string {
  return `${num(n, digits)}%`;
}

/** "2026-11" -> "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "2026-11" -> "2026-12" */
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-02" -> 28 */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const kindLabel: Record<string, string> = {
  clinic: "Clinic",
  irrigation: "Irrigation",
  "cold-storage": "Cold storage",
};
