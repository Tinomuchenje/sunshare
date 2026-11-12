"use client";

import { useState } from "react";
import type { OpsResponse } from "@/lib/api-types";
import type { PayoutStatus } from "@/lib/types";
import { YOU_ID } from "@/lib/seed";
import { moneyExact, monthLabel, num } from "@/lib/format";
import { Badge, Button } from "@/components/ui";
import { td, th } from "./ReportsTable";

const LATEST = 20;

const status: Record<PayoutStatus, { label: string; tone: "green" | "neutral" | "bad" }> = {
  sent: { label: "Sent", tone: "green" },
  seeded: { label: "Sample", tone: "neutral" },
  failed: { label: "Failed", tone: "bad" },
};

/** Every payout to every owner, most recent first. */
export function PayoutLedger({ payouts }: { payouts: OpsResponse["payouts"] }) {
  const [showAll, setShowAll] = useState(false);

  if (payouts.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">No payouts yet.</p>;
  }

  const rows = showAll ? payouts : payouts.slice(0, LATEST);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[760px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={th}>Month</th>
              <th scope="col" className={th}>Project</th>
              <th scope="col" className={th}>Owner</th>
              <th scope="col" className={`${th} text-right`}>Cells</th>
              <th scope="col" className={`${th} text-right`}>Amount</th>
              <th scope="col" className={th}>PayPal batch</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => {
              const isYou = p.investorId === YOU_ID;
              return (
                <tr key={p.id} className={isYou ? "bg-sun-soft/60" : undefined}>
                  <td className={`${td} whitespace-nowrap`}>{monthLabel(p.month)}</td>
                  <td className={td}>{p.projectName}</td>
                  <td className={`${td} whitespace-nowrap ${isYou ? "font-semibold" : ""}`}>
                    {p.investorName}
                  </td>
                  <td className={`${td} text-right`}>{num(p.cells)}</td>
                  <td className={`${td} text-right font-medium`}>{moneyExact(p.amountCents)}</td>
                  <td className={`${td} font-mono text-xs text-muted`}>{p.paypalBatchId}</td>
                  <td className={td}>
                    <Badge tone={status[p.status].tone}>{status[p.status].label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {payouts.length > LATEST ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
          <span className="tabular">
            Showing {num(rows.length)} of {num(payouts.length)} payouts
          </span>
          <Button
            variant="ghost"
            className="min-h-11"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? `Show latest ${LATEST}` : "Show all"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
