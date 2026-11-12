import Link from "next/link";
import type { RunMonthResponse } from "@/lib/api-types";
import { YOU_ID } from "@/lib/seed";
import { moneyExact, num, pct } from "@/lib/format";
import { HealthBadge } from "./health";

/** What one simulated month produced and where the money went. */
export function MonthSummary({ result }: { result: RunMonthResponse }) {
  const { report, payouts, mode } = result;
  const yours = payouts.find((p) => p.investorId === YOU_ID);
  const failed = payouts.filter((p) => p.status === "failed").length;

  const rows: [string, string][] = [
    ["Generated", `${num(report.actualKwh)} kWh of ${num(report.forecastKwh)} kWh forecast`],
    ["Used by the site", `${num(report.usedKwh)} kWh`],
    ["Electricity income", moneyExact(report.revenueCents)],
    ["Platform fee (10%)", moneyExact(report.platformFeeCents)],
    ["Maintenance reserve", moneyExact(report.maintenanceReserveCents)],
    ["Paid to owners", moneyExact(report.distributableCents)],
    ["Owners paid", num(payouts.length - failed)],
  ];

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">
          Output was {pct(report.performance * 100)} of forecast
        </h3>
        <HealthBadge value={report.health} />
      </div>
      <p className="mt-1 text-sm text-muted">{report.note}</p>

      <dl className="tabular mt-4 divide-y divide-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {failed > 0 ? (
        <p className="mt-3 text-sm text-bad">
          {failed} {failed === 1 ? "payout" : "payouts"} failed. See the ledger below.
        </p>
      ) : null}

      {yours ? (
        <div className="mt-4 rounded-xl border border-sun/40 bg-sun-soft p-4">
          <p className="text-sm">Your share for {yours.cells} cells</p>
          <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight">
            {moneyExact(yours.amountCents)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {yours.status === "failed"
              ? "This payout failed and was not sent."
              : mode === "demo"
                ? "Sent to your PayPal (simulated in demo mode)."
                : "Sent to your PayPal sandbox account."}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          You do not own cells in this plant, so no payout went to you.{" "}
          <Link href="/projects" className="font-medium text-green-dark underline underline-offset-4">
            Browse projects
          </Link>
        </p>
      )}
    </div>
  );
}
