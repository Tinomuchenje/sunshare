"use client";

import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import type { HoldingView, PortfolioResponse } from "@/lib/api-types";
import type { PayoutStatus } from "@/lib/types";
import { money, moneyExact, monthLabel, num } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader, Stat } from "@/components/ui";
import { ErrorNotice, Loading, SectionHeading, shortDate, Skeleton } from "./bits";
import { Table } from "./Table";
import { useApi } from "./useApi";

export function Portfolio() {
  const { data, error, loading, retry } = useApi<PortfolioResponse>("/api/portfolio");

  return (
    <>
      <PageHeader
        title="Your portfolio"
        intro={
          data
            ? `The solar cells you own and what they have earned. Payouts go to ${data.investor.paypalEmail}.`
            : "The solar cells you own and what they have earned."
        }
      />
      {loading ? (
        <PortfolioSkeleton />
      ) : error || !data ? (
        <ErrorNotice message={`Could not load your portfolio. ${error ?? ""}`} onRetry={retry} />
      ) : data.holdings.length === 0 && data.purchases.length === 0 ? (
        <Empty />
      ) : (
        <Filled data={data} />
      )}
    </>
  );
}

function Filled({ data }: { data: PortfolioResponse }) {
  const { totals } = data;
  return (
    <div className="space-y-12">
      <Card>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Invested" value={money(totals.investedCents)} />
          <Stat label="Earned so far" value={moneyExact(totals.earnedCents)} />
          <Stat label="Cells owned" value={num(totals.cells)} />
          <Stat
            label="Clean energy from your cells"
            value={`${num(totals.kwhGenerated)} kWh`}
          />
        </div>
      </Card>

      <section aria-labelledby="holdings">
        <SectionHeading id="holdings">Holdings</SectionHeading>
        <ul className="space-y-3">
          {data.holdings.map((h) => (
            <li key={h.project.id}>
              <HoldingRow holding={h} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="payouts">
        <SectionHeading
          id="payouts"
          intro="Your share of each month's electricity income, sent to your PayPal."
        >
          Payouts received
        </SectionHeading>
        {data.payouts.length === 0 ? (
          <Card>
            <p className="text-muted">
              No payouts yet. They start once a plant you own is installed and running.
            </p>
          </Card>
        ) : (
          <Table
            caption="Payouts received"
            head={[
              { label: "Month" },
              { label: "Project" },
              { label: "Amount", right: true },
              { label: "PayPal batch" },
              { label: "Status" },
            ]}
            rows={data.payouts.map((p) => ({
              key: p.id,
              cells: [
                monthLabel(p.month),
                p.projectName,
                moneyExact(p.amountCents),
                <span key="batch" className="font-mono text-xs break-all">
                  {p.paypalBatchId}
                </span>,
                <Badge key="status" tone={payoutBadge[p.status].tone}>
                  {payoutBadge[p.status].text}
                </Badge>,
              ],
            }))}
          />
        )}
      </section>

      <section aria-labelledby="purchases">
        <SectionHeading id="purchases">Purchases</SectionHeading>
        <Table
          caption="Purchases"
          head={[
            { label: "Date" },
            { label: "Project" },
            { label: "Cells", right: true },
            { label: "Amount", right: true },
            { label: "Placed by" },
          ]}
          rows={data.purchases.map((p) => ({
            key: p.id,
            cells: [
              shortDate(p.createdAt),
              p.status === "completed"
                ? p.projectName
                : `${p.projectName} (${p.status === "created" ? "not completed" : "cancelled"})`,
              num(p.cells),
              moneyExact(p.amountCents),
              p.placedBy === "agent" ? (
                <Badge key="by" tone="sun">
                  <Bot className="size-3.5" aria-hidden />
                  Agent
                </Badge>
              ) : (
                <Badge key="by">You</Badge>
              ),
            ],
          }))}
        />
      </section>
    </div>
  );
}

const payoutBadge: Record<PayoutStatus, { tone: "green" | "neutral" | "bad"; text: string }> = {
  sent: { tone: "green", text: "Sent" },
  seeded: { tone: "neutral", text: "Sample" },
  failed: { tone: "bad", text: "Failed" },
};

function HoldingRow({ holding: h }: { holding: HoldingView }) {
  const running = h.project.status === "operating";
  return (
    <Link
      href={`/projects/${h.project.id}`}
      className="group block rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink/30 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{h.project.name}</h3>
        <Badge tone={running ? "green" : "sun"}>
          {running ? "Operating" : `Funding · ${Math.round(h.project.fundedPct)}%`}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Cells" value={num(h.cells)} hint={`${money(h.costCents)} paid`} />
        <Figure label="Your share" value={`${h.sharePct.toFixed(h.sharePct < 1 ? 2 : 1)}%`} />
        <Figure label="Earned" value={moneyExact(h.earnedCents)} />
        <Figure
          label="Est. monthly"
          value={h.estMonthlyCents > 0 ? moneyExact(h.estMonthlyCents) : "Not yet"}
          hint={running ? "Estimate" : "Once installed"}
        />
      </dl>
    </Link>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

function Empty() {
  return (
    <Card className="py-10 text-center sm:py-14">
      <h2 className="text-xl font-semibold">You do not own any solar cells yet</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Pick a project and buy a few cells with PayPal, or tell the agent what you want and
        approve its suggestion.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/projects" size="lg" className="min-h-12">
          Browse projects
          <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
        <ButtonLink href="/agent" size="lg" variant="secondary" className="min-h-12">
          <Bot className="size-4" aria-hidden />
          Ask the agent
        </ButtonLink>
      </div>
    </Card>
  );
}

function PortfolioSkeleton() {
  return (
    <Loading label="Loading your portfolio">
      <Card>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-8 w-24" />
            </div>
          ))}
        </div>
      </Card>
      <Skeleton className="mt-12 h-7 w-32" />
      <Skeleton className="mt-5 h-32 w-full rounded-card" />
      <Skeleton className="mt-3 h-32 w-full rounded-card" />
    </Loading>
  );
}
