// Payout agent: turns metered output into income, splits it by cells owned
// (all in integer cents) and pays owners through PayPal Payouts.

import type { AgentStep } from "../api-types";
import { money, moneyExact, monthLabel, num } from "../format";
import { demoId, PaypalError, sendPayoutBatch } from "../paypal";
import { newId } from "../store";
import {
  MAINTENANCE_RESERVE_RATE,
  PLATFORM_FEE_RATE,
  type Holding,
  type Investor,
  type Payout,
  type Project,
} from "../types";

export interface Settlement {
  usedKwh: number;
  revenueCents: number;
  platformFeeCents: number;
  maintenanceReserveCents: number;
  distributableCents: number;
  payouts: Payout[];
  steps: AgentStep[];
}

/** "seeded" records history without calling PayPal. */
export type PayoutChannel = "seeded" | "demo" | "sandbox";

/** Each owner gets distributable × cells ÷ totalCells, rounded down to the cent. */
function allocate(distributable: number, holdings: Holding[], totalCells: number) {
  return holdings
    .map((h) => ({
      investorId: h.investorId,
      cells: h.cells,
      amountCents: Math.floor((distributable * h.cells) / totalCells),
    }))
    .filter((s) => s.amountCents > 0);
}

export async function settleMonth(input: {
  project: Project;
  month: string;
  reportId: string;
  actualKwh: number;
  holdings: Holding[];
  investors: Investor[];
  channel: PayoutChannel;
  createdAt: string;
}): Promise<Settlement> {
  const { project: p, month } = input;
  const usedKwh = Math.round(input.actualKwh * p.utilisation);
  const revenueCents = usedKwh * p.tariffCentsPerKwh;
  const platformFeeCents = Math.round(revenueCents * PLATFORM_FEE_RATE);
  const baseReserveCents = Math.round(revenueCents * MAINTENANCE_RESERVE_RATE);
  const shareableCents = revenueCents - platformFeeCents - baseReserveCents;

  const shares = allocate(shareableCents, input.holdings, p.totalCells);
  const distributableCents = shares.reduce((sum, s) => sum + s.amountCents, 0);
  // Rounding leftovers (and any unowned cells) go to the maintenance reserve.
  const leftoverCents = shareableCents - distributableCents;
  const maintenanceReserveCents = baseReserveCents + leftoverCents;

  const emails = new Map(input.investors.map((i) => [i.id, i.paypalEmail]));
  const payouts: Payout[] = shares.map((s) => ({
    id: newId("payout"),
    reportId: input.reportId,
    projectId: p.id,
    investorId: s.investorId,
    month,
    cells: s.cells,
    amountCents: s.amountCents,
    paypalBatchId: "",
    status: "sent",
    createdAt: input.createdAt,
  }));

  const steps: AgentStep[] = [
    {
      agent: "payout",
      title: "Worked out the month's income",
      detail: `The site used ${num(usedKwh)} kWh at ${p.tariffCentsPerKwh}¢ per kWh, so income is ${moneyExact(revenueCents)}.`,
      status: "ok",
    },
    {
      agent: "payout",
      title: `Split ${moneyExact(distributableCents)} among ${payouts.length} owners`,
      detail:
        `Platform fee ${moneyExact(platformFeeCents)}, maintenance reserve ${moneyExact(maintenanceReserveCents)}` +
        (leftoverCents > 0 ? ` (including ${moneyExact(leftoverCents)} left over from rounding)` : "") +
        `. Each cell earned about ${num(distributableCents / p.totalCells, 2)}¢.`,
      status: "ok",
    },
  ];

  const batch = await payOwners(input.channel, payouts, emails, p, month, input.reportId);
  for (const payout of payouts) {
    payout.paypalBatchId = batch.batchId;
    payout.status = batch.status;
  }
  steps.push(batch.step);

  return {
    usedKwh,
    revenueCents,
    platformFeeCents,
    maintenanceReserveCents,
    distributableCents,
    payouts,
    steps,
  };
}

async function payOwners(
  channel: PayoutChannel,
  payouts: Payout[],
  emails: Map<string, string>,
  p: Project,
  month: string,
  reportId: string,
): Promise<{ batchId: string; status: Payout["status"]; step: AgentStep }> {
  const total = moneyExact(payouts.reduce((sum, x) => sum + x.amountCents, 0));
  const count = `${payouts.length} payment${payouts.length === 1 ? "" : "s"}`;

  if (channel === "seeded") {
    const batchId = `SEED-${month}-${p.id}`;
    return {
      batchId,
      status: "seeded",
      step: { agent: "payout", title: "Recorded sample payout history", detail: `${count}, ${total} in total.`, status: "ok" },
    };
  }

  if (channel === "demo") {
    const batchId = demoId("DEMO-BATCH");
    return {
      batchId,
      status: "sent",
      step: {
        agent: "payout",
        title: "Sent PayPal payouts (demo)",
        detail: `Batch ${batchId}: ${count}, ${total} in total. Demo mode, so no real money moved.`,
        status: "ok",
      },
    };
  }

  try {
    const batchId = await sendPayoutBatch({
      // One batch per monthly report, so a retry can never pay twice.
      senderBatchId: `sunshare-${reportId}`,
      subject: `Your SunShare income from ${p.name}`,
      note: `Your share of ${p.name} income for ${monthLabel(month)}.`,
      items: payouts.map((x) => ({
        email: emails.get(x.investorId) ?? "",
        amountCents: x.amountCents,
        itemId: x.id,
      })),
    });
    return {
      batchId,
      status: "sent",
      step: {
        agent: "payout",
        title: "Sent PayPal payout batch",
        detail: `PayPal sandbox accepted batch ${batchId}: ${count} to owners' PayPal emails, ${total} in total.`,
        status: "ok",
      },
    };
  } catch (e) {
    if (!(e instanceof PaypalError)) throw e;
    return {
      batchId: "",
      status: "failed",
      step: {
        agent: "payout",
        title: "PayPal payout failed",
        detail: `${e.message} The ${money(payouts.reduce((s, x) => s + x.amountCents, 0))} owed is recorded as failed and not paid.`,
        status: "error",
      },
    };
  }
}
