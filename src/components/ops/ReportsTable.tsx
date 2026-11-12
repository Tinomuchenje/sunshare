import type { OpsResponse } from "@/lib/api-types";
import { moneyExact, monthLabel, num, pct } from "@/lib/format";
import { HealthBadge } from "./health";

export const th = "px-4 py-3 text-left font-medium text-muted";
export const td = "px-4 py-3 align-top";

/** Every monthly report the monitoring agent has written, most recent first. */
export function ReportsTable({ reports }: { reports: OpsResponse["reports"] }) {
  if (reports.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">No months have run yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[640px] text-sm">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Project</th>
            <th scope="col" className={th}>Month</th>
            <th scope="col" className={`${th} text-right`}>Output vs forecast</th>
            <th scope="col" className={th}>Health</th>
            <th scope="col" className={`${th} text-right`}>Paid to owners</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {reports.map((r) => (
            <tr key={r.id}>
              <td className={`${td} font-medium`}>{r.projectName}</td>
              <td className={`${td} whitespace-nowrap`}>{monthLabel(r.month)}</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                {num(r.actualKwh)} / {num(r.forecastKwh)} kWh
                <span className="block text-xs text-muted">{pct(r.performance * 100)}</span>
              </td>
              <td className={td}>
                <HealthBadge value={r.health} />
              </td>
              <td className={`${td} text-right`}>{moneyExact(r.distributableCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
