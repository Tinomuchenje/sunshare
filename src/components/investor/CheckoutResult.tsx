"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { CaptureCheckoutRequest, CaptureCheckoutResponse } from "@/lib/api-types";
import { api } from "@/lib/api";
import { money, num, pct } from "@/lib/format";
import { ButtonLink, Card } from "@/components/ui";
import { ErrorNotice, Loading, sharePct, Skeleton } from "./bits";
import { estimateIncome } from "./estimate";

export function CheckoutResult({ token }: { token: string }) {
  const [result, setResult] = useState<CaptureCheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : "This link has no order in it.",
  );
  const started = useRef(false);

  const capture = useCallback(() => {
    const body: CaptureCheckoutRequest = { orderId: token };
    api<CaptureCheckoutResponse>("/api/checkout/capture", body).then(setResult, (e: Error) =>
      setError(e.message),
    );
  }, [token]);

  // Capture once. Strict mode runs effects twice in development; the ref stops the second call.
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    capture();
  }, [token, capture]);

  function retry() {
    setError(null);
    capture();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">We could not complete this payment</h1>
        <ErrorNotice message={error} onRetry={token ? retry : undefined}>
          <ButtonLink href="/projects" variant="secondary" className="min-h-11">
            Back to projects
          </ButtonLink>
        </ErrorNotice>
      </div>
    );
  }
  if (!result) {
    return (
      <Loading label="Completing your payment">
        <div className="mx-auto max-w-xl">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="mt-5 h-9 w-3/4" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-8 h-56 w-full rounded-card" />
        </div>
      </Loading>
    );
  }
  return <Confirmation result={result} />;
}

function Confirmation({ result: { purchase, project } }: { result: CaptureCheckoutResponse }) {
  const income = estimateIncome(project, project.yourCells);
  const next =
    project.status === "operating"
      ? ["The plant is already running.", "Your first payout comes with the next monthly report."]
      : project.cellsAvailable === 0
        ? [
            "The plant is now fully funded and will be installed.",
            "Payouts start once it is running, each month, to your PayPal.",
          ]
        : [
            `The plant is ${pct(project.fundedPct)} funded. It is installed once every cell is sold.`,
            "Payouts start once it is running, each month, to your PayPal.",
          ];

  return (
    <div className="mx-auto max-w-xl">
      <CircleCheck className="size-12 text-green" aria-hidden />
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">
        {project.yourCells > purchase.cells
          ? `You bought ${num(purchase.cells)} more solar cells`
          : `You now own ${num(purchase.cells)} solar cells`}
      </h1>
      <p className="mt-3 text-lg text-muted">
        Paid {money(purchase.amountCents)} with PayPal for cells in {project.name}.
      </p>

      <Card className="mt-8 space-y-5">
        <dl className="grid grid-cols-2 gap-5">
          <Fact label="Your cells in this plant" value={num(project.yourCells)} />
          <Fact label="Your share of the plant" value={sharePct(project.yourCells, project.totalCells)} />
          {income ? (
            <Fact
              label="Estimated income"
              value={`${money(income.monthlyCents)} a month`}
              hint="Not guaranteed"
            />
          ) : null}
          <Fact label="PayPal order" value={purchase.paypalOrderId} small />
        </dl>
        <div className="border-t border-line pt-5">
          <h2 className="font-semibold">What happens next</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            {next.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/portfolio" size="lg" className="min-h-12">
          View your portfolio
        </ButtonLink>
        <ButtonLink href="/projects" size="lg" variant="secondary" className="min-h-12">
          See more projects
        </ButtonLink>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
  small,
}: {
  label: string;
  value: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`tabular mt-1 font-semibold break-all ${small ? "text-sm" : "text-xl"}`}>
        {value}
      </dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}
