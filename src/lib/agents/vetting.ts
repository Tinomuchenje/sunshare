// Vetting agent: sunlight lookup, output forecast, score and narrative.
// Every number is computed here; in live mode the model only writes the words.

import type { AgentStep } from "../api-types";
import { AiError, aiMode, askJson, WRITING_STYLE } from "../ai";
import { money, num } from "../format";
import { seedSunHours } from "../seed";
import {
  MAINTENANCE_RESERVE_RATE,
  PLATFORM_FEE_RATE,
  SYSTEM_EFFICIENCY,
  type Project,
  type VettingReport,
} from "../types";

const DAYS_PER_MONTH = 365 / 12;

/** Annual average daily sunshine (kWh/m2/day) from NASA POWER, or null if unavailable. */
async function nasaSunHours(lat: number, lon: number): Promise<number | null> {
  const url =
    "https://power.larc.nasa.gov/api/temporal/climatology/point" +
    `?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const body = await res.json();
    const ann = body?.properties?.parameter?.ALLSKY_SFC_SW_DWN?.ANN;
    // NASA uses -999 for missing values.
    return typeof ann === "number" && ann > 0 ? ann : null;
  } catch {
    return null;
  }
}

/** Scales x from [lo, hi] onto [0, max], clamped. */
function scale(x: number, lo: number, hi: number, max: number): number {
  return Math.max(0, Math.min(max, ((x - lo) / (hi - lo)) * max));
}

interface Figures {
  sunHoursPerDay: number;
  sunDataSource: VettingReport["sunDataSource"];
  forecastKwhPerMonth: number;
  estimatedYieldPct: number;
  savingPct: number;
  targetCents: number;
  factors: { sun: number; saving: number; utilisation: number; size: number };
  score: number;
  grade: VettingReport["grade"];
}

function computeFigures(
  p: Project,
  sunHoursPerDay: number,
  sunDataSource: Figures["sunDataSource"],
): Figures {
  const yearlyKwh = p.capacityKw * sunHoursPerDay * 365 * SYSTEM_EFFICIENCY;
  const yearlyIncomeCents = yearlyKwh * p.utilisation * p.tariffCentsPerKwh;
  const shareRate = 1 - PLATFORM_FEE_RATE - MAINTENANCE_RESERVE_RATE;
  const perCellCents = (yearlyIncomeCents * shareRate) / p.totalCells;
  const savingPct = (1 - p.tariffCentsPerKwh / p.previousCostCentsPerKwh) * 100;
  const targetCents = p.totalCells * p.cellPriceCents;

  // Four explainable factors adding up to 100.
  const factors = {
    sun: scale(sunHoursPerDay, 3.5, 6.5, 30), // stronger sun, more output
    saving: scale(savingPct, 0, 70, 25), // bigger saving, more reason to keep paying
    utilisation: scale(p.utilisation, 0.5, 0.95, 25), // less wasted output
    size: 20 - scale(targetCents, 1_500_000, 6_000_000, 15), // smaller raises are simpler to deliver
  };
  const score = Math.round(
    factors.sun + factors.saving + factors.utilisation + factors.size,
  );
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  return {
    sunHoursPerDay: Math.round(sunHoursPerDay * 100) / 100,
    sunDataSource,
    forecastKwhPerMonth: Math.round(
      p.capacityKw * sunHoursPerDay * DAYS_PER_MONTH * SYSTEM_EFFICIENCY,
    ),
    estimatedYieldPct: Math.round((perCellCents / p.cellPriceCents) * 1000) / 10,
    savingPct: Math.round(savingPct),
    targetCents,
    factors,
    score,
    grade,
  };
}

const SITE_NAME: Record<Project["kind"], string> = {
  clinic: "the clinic",
  irrigation: "the farmers' pumps",
  "cold-storage": "the cold room",
};

const KIND_RISK: Record<Project["kind"], string> = {
  clinic:
    "Income depends on the clinic paying its power bill each month; a funding gap at the clinic could delay payments.",
  irrigation:
    "Pumping is seasonal, so less power may be used in the rainy months.",
  "cold-storage":
    "Demand follows harvests and fish catches, so usage can vary from month to month.",
};

function rulesNarrative(p: Project, f: Figures) {
  const strengths: string[] = [];
  const risks: string[] = [];

  const sunText = `${num(f.sunHoursPerDay, 1)} peak sun hours a day`;
  if (f.sunHoursPerDay >= 5.5) strengths.push(`Strong sunshine: ${sunText}.`);
  else if (f.sunHoursPerDay < 4.5) risks.push(`Weaker sunshine than ideal: ${sunText}.`);
  else strengths.push(`Good sunshine: ${sunText}.`);

  const savingText = `The site pays ${p.tariffCentsPerKwh}¢ per kWh instead of ${p.previousCostCentsPerKwh}¢ before, a ${f.savingPct}% saving`;
  if (f.savingPct >= 50) strengths.push(`${savingText}, so it has a strong reason to keep paying.`);
  else if (f.savingPct < 30) risks.push(`${savingText}, a small margin if prices change.`);
  else strengths.push(`${savingText}.`);

  const used = Math.round(p.utilisation * 100);
  if (p.utilisation >= 0.85) strengths.push(`The site uses ${used}% of the power produced, so little is wasted.`);
  else if (p.utilisation < 0.75) risks.push(`Only ${used}% of the power produced is used; unused power earns nothing.`);
  else risks.push(`About ${100 - used}% of the power produced goes unused, which lowers income.`);

  if (f.targetCents <= 2_000_000) strengths.push(`A modest raise of ${money(f.targetCents)}, which keeps delivery simple.`);
  else risks.push(`A larger raise of ${money(f.targetCents)} takes longer to fill.`);

  risks.push(KIND_RISK[p.kind]);
  if (f.sunDataSource === "seeded") {
    risks.push("The sunshine figure is a stored estimate because the NASA lookup was unavailable.");
  }
  risks.push("Income is an estimate. It depends on sunshine and on how much power the site uses.");

  const summary =
    `${p.name} scores ${f.score} out of 100 (grade ${f.grade}). ` +
    `The plant should produce about ${num(f.forecastKwhPerMonth)} kWh a month for ${SITE_NAME[p.kind]}. ` +
    `Estimated income is about ${num(f.estimatedYieldPct, 1)}% of the cell price a year, not guaranteed.`;
  return { summary, strengths, risks };
}

async function aiNarrative(p: Project, f: Figures) {
  const facts = {
    project: { name: p.name, kind: p.kind, location: `${p.locationName}, ${p.country}`, summary: p.summary, impact: p.impact },
    sunHoursPerDay: f.sunHoursPerDay,
    sunDataSource: f.sunDataSource === "nasa-power" ? "NASA POWER satellite climatology" : "stored estimate (NASA lookup unavailable)",
    forecastKwhPerMonth: f.forecastKwhPerMonth,
    estimatedYearlyIncomePctOfCellPrice: f.estimatedYieldPct,
    tariffCentsPerKwh: p.tariffCentsPerKwh,
    previousCostCentsPerKwh: p.previousCostCentsPerKwh,
    savingPct: f.savingPct,
    utilisationPct: Math.round(p.utilisation * 100),
    fundingTarget: money(f.targetCents),
    score: f.score,
    grade: f.grade,
    scoreFactors: {
      sunOutOf30: Math.round(f.factors.sun),
      savingOutOf25: Math.round(f.factors.saving),
      utilisationOutOf25: Math.round(f.factors.utilisation),
      sizeOutOf20: Math.round(f.factors.size),
    },
  };
  const out = await askJson<{ summary: string; strengths: string[]; risks: string[] }>(
    `You are the vetting agent for SunShare, where people buy solar cells in plants that power African clinics and farms. ${WRITING_STYLE}`,
    `Write the investor-facing vetting narrative for this project from these computed facts:\n${JSON.stringify(facts, null, 2)}\n\n` +
      'Return {"summary": string (2-3 sentences, mention the score and grade), "strengths": string[] (2-4 items), "risks": string[] (2-4 items, always include that income depends on sunshine and usage)}.',
  );
  if (typeof out.summary !== "string" || !Array.isArray(out.strengths) || !Array.isArray(out.risks)) {
    throw new AiError("The AI vetting reply was missing fields.");
  }
  return { summary: out.summary, strengths: out.strengths.map(String), risks: out.risks.map(String) };
}

export async function vetProject(
  p: Project,
): Promise<{ report: VettingReport; steps: AgentStep[] }> {
  const nasa = await nasaSunHours(p.lat, p.lon);
  const f = computeFigures(p, nasa ?? seedSunHours[p.id] ?? 5, nasa ? "nasa-power" : "seeded");
  // If the AI call fails, use the rule-based wording and label it as such
  // (writtenBy), so one failed call cannot take the project pages down.
  let live = aiMode() === "live";
  let words = rulesNarrative(p, f);
  if (live) {
    try {
      words = await aiNarrative(p, f);
    } catch {
      live = false;
    }
  }

  const report: VettingReport = {
    score: f.score,
    grade: f.grade,
    sunHoursPerDay: f.sunHoursPerDay,
    sunDataSource: f.sunDataSource,
    forecastKwhPerMonth: f.forecastKwhPerMonth,
    estimatedYieldPct: f.estimatedYieldPct,
    ...words,
    writtenBy: live ? "ai" : "rules",
  };

  const steps: AgentStep[] = [
    nasa
      ? {
          agent: "vetting",
          title: "Looked up sunshine at the site",
          detail: `NASA POWER satellite data gives ${num(f.sunHoursPerDay, 2)} peak sun hours a day at ${p.lat}, ${p.lon}.`,
          status: "ok",
        }
      : {
          agent: "vetting",
          title: "Used the stored sunshine estimate",
          detail: `NASA POWER could not be reached within 3 seconds, so the stored figure of ${num(f.sunHoursPerDay, 1)} peak sun hours a day was used.`,
          status: "warning",
        },
    {
      agent: "vetting",
      title: "Forecast monthly output",
      detail: `${p.capacityKw} kW × ${num(f.sunHoursPerDay, 2)} sun hours × 30.4 days × 78% system efficiency ≈ ${num(f.forecastKwhPerMonth)} kWh a month.`,
      status: "ok",
    },
    {
      agent: "vetting",
      title: `Scored ${f.score} out of 100 (grade ${f.grade})`,
      detail:
        `Sunshine ${Math.round(f.factors.sun)}/30, saving for the site ${Math.round(f.factors.saving)}/25, ` +
        `power used ${Math.round(f.factors.utilisation)}/25, size ${Math.round(f.factors.size)}/20. ` +
        `Estimated income per cell: about ${num(f.estimatedYieldPct, 1)}% of its price a year, not guaranteed.`,
      status: f.score >= 50 ? "ok" : "warning",
    },
    {
      agent: "vetting",
      title: live ? "Wrote the summary with Claude" : "Wrote the summary",
      detail: `${report.strengths.length} strengths and ${report.risks.length} risks listed for investors.`,
      status: "ok",
    },
  ];
  return { report, steps };
}
