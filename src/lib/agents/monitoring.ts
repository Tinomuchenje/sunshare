// Monitoring agent: simulates the month's meter reading, compares it with the
// forecast and writes a one-line finding.

import type { AgentStep } from "../api-types";
import { AiError, askJson, WRITING_STYLE } from "../ai";
import { daysInMonth, monthLabel, num } from "../format";
import { SYSTEM_EFFICIENCY, type PlantHealth, type Project } from "../types";

export type Scenario = "normal" | "underperform";

export interface MeterReading {
  forecastKwh: number;
  actualKwh: number;
  performance: number;
  health: PlantHealth;
  note: string;
}

// Simulated faults for the "underperform" scenario: what the data shows and what to do.
const FAULTS = [
  {
    cause: "dust on the panels",
    signal: "Output was low evenly across every panel string on clear days.",
    action: "Panel cleaning has been requested from the site team.",
  },
  {
    cause: "an inverter fault",
    signal: "The inverter logged repeated restarts and went offline on several afternoons.",
    action: "An inverter check has been booked with the local installer.",
  },
  {
    cause: "shading or a loose connection on one panel string",
    signal: "One panel string produced far less than the others.",
    action: "A technician visit has been requested to inspect the wiring.",
  },
];

export function healthFor(performance: number): PlantHealth {
  if (performance >= 0.9) return "healthy";
  if (performance >= 0.75) return "watch";
  return "underperforming";
}

export function forecastKwh(p: Project, month: string): number {
  const sun = p.vetting?.sunHoursPerDay;
  if (!sun) throw new Error(`Project ${p.id} has not been vetted.`);
  return Math.round(p.capacityKw * sun * daysInMonth(month) * SYSTEM_EFFICIENCY);
}

/**
 * Reads the meter for one month. `rand` returns numbers in [0, 1); seeded
 * history passes a deterministic one. With `useAi` the model writes the note.
 */
export async function readMeter(
  p: Project,
  month: string,
  scenario: Scenario,
  rand: () => number,
  useAi: boolean,
): Promise<{ reading: MeterReading; steps: AgentStep[] }> {
  const forecast = forecastKwh(p, month);
  const ratio = scenario === "underperform" ? 0.6 + rand() * 0.1 : 0.92 + rand() * 0.12;
  const actualKwh = Math.round(forecast * ratio);
  const performance = Math.round((actualKwh / forecast) * 1000) / 1000;
  const health = healthFor(performance);
  const fault = scenario === "underperform" ? FAULTS[Math.floor(rand() * FAULTS.length)] : null;
  const pctText = `${Math.round(performance * 100)}%`;

  // If the AI call fails, fall back to the rule-based note so a month can still be run.
  const note = useAi
    ? await aiNote(p, month, forecast, actualKwh, pctText, health, fault).catch(() =>
        rulesNote(pctText, health, fault),
      )
    : rulesNote(pctText, health, fault);

  const reading = { forecastKwh: forecast, actualKwh, performance, health, note };
  const steps: AgentStep[] = [
    {
      agent: "monitoring",
      title: `Read the meter for ${monthLabel(month)}`,
      detail: `Meter shows ${num(actualKwh)} kWh against a forecast of ${num(forecast)} kWh (${pctText}).`,
      status: "ok",
    },
    {
      agent: "monitoring",
      title:
        health === "healthy"
          ? "Plant is healthy"
          : health === "watch"
            ? "Output a little low, watching"
            : "Flagged underperformance",
      detail: note,
      status: health === "healthy" ? "ok" : "warning",
    },
  ];
  return { reading, steps };
}

function rulesNote(
  pctText: string,
  health: PlantHealth,
  fault: (typeof FAULTS)[number] | null,
): string {
  if (fault) {
    return `Output was ${pctText} of forecast. ${fault.signal} Likely cause: ${fault.cause}. ${fault.action}`;
  }
  if (health === "healthy") return `Output was ${pctText} of forecast. The plant is working as expected.`;
  return `Output was ${pctText} of forecast, a little below normal, probably cloudier weather. Checking again next month.`;
}

async function aiNote(
  p: Project,
  month: string,
  forecast: number,
  actual: number,
  pctText: string,
  health: PlantHealth,
  fault: (typeof FAULTS)[number] | null,
): Promise<string> {
  const facts = {
    plant: `${p.name} (${p.capacityKw} kW, ${p.locationName}, ${p.country})`,
    month: monthLabel(month),
    forecastKwh: forecast,
    meteredKwh: actual,
    percentOfForecast: pctText,
    health,
    sensorEvidence: fault?.signal ?? "No faults logged; all panel strings within normal range.",
    actionAlreadyTaken: fault?.action ?? null,
  };
  const out = await askJson<{ note: string }>(
    `You are the monitoring agent for a solar plant. ${WRITING_STYLE}`,
    `Write the monthly finding from these facts:\n${JSON.stringify(facts, null, 2)}\n\n` +
      'Return {"note": string}: one or two sentences. State the percentage of forecast. If there is sensor evidence of a fault, name the most likely cause and the action taken.',
  );
  if (typeof out.note !== "string" || !out.note) throw new AiError("The AI monitoring reply had no note.");
  return out.note;
}
