import Link from "next/link";
import type { MonthlyReport, PlantHealth } from "@/lib/types";
import { monthLabel, moneyExact, num, pct } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { SectionHeading } from "./bits";

const healthBadge: Record<PlantHealth, { tone: "green" | "warn" | "bad"; text: string }> = {
  healthy: { tone: "green", text: "Healthy" },
  watch: { tone: "warn", text: "Watch" },
  underperforming: { tone: "bad", text: "Underperforming" },
};

export function MonthlyReports({ reports }: { reports: MonthlyReport[] }) {
  return (
    <section aria-labelledby="reports">
      <SectionHeading
        id="reports"
        intro="Each month the monitoring agent checks the meter against the forecast, and the payout agent pays owners."
      >
        Monthly reports
      </SectionHeading>
      {reports.length === 0 ? (
        <Card>
          <p className="text-muted">The first monthly report appears after the plant&apos;s first month.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="grid gap-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{monthLabel(r.month)}</h3>
                    <Badge tone={healthBadge[r.health].tone}>{healthBadge[r.health].text}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.note}</p>
                </div>
                <div className="text-sm">
                  <p className="text-muted">Output</p>
                  <p className="tabular font-medium">
                    {num(r.actualKwh)} of {num(r.forecastKwh)} kWh forecast ({pct(r.performance * 100)})
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="text-muted">Paid to owners</p>
                  <p className="tabular text-lg font-semibold">{moneyExact(r.distributableCents)}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-muted">
        Every payout is listed on the{" "}
        <Link href="/operations" className="font-medium text-green-dark underline underline-offset-2">
          Operations page
        </Link>
        .
      </p>
    </section>
  );
}
