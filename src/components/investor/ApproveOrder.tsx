"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import type { OrderSummaryResponse } from "@/lib/api-types";
import { money, num } from "@/lib/format";
import { ButtonLink } from "@/components/ui";
import { ErrorNotice, Loading, Skeleton } from "./bits";
import { useApi } from "./useApi";

/**
 * Stand-in for PayPal's approval page, used only in demo mode.
 * Deliberately plain and unlike both this app and PayPal, so nobody mistakes it for either.
 */
export function ApproveOrder({ token }: { token: string }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-lg border-2 border-dashed border-ink/40 bg-surface font-mono">
        <div className="flex items-center gap-2 bg-ink px-4 py-3 text-xs tracking-wide text-paper uppercase">
          <FlaskConical className="size-4" aria-hidden />
          Simulated payment step
        </div>
        <div className="p-5 sm:p-6">
          <h1 className="font-sans text-xl font-semibold">Approve this payment</h1>
          <p className="mt-2 font-sans text-sm text-muted">
            This prototype runs without a PayPal account, so this page stands in for
            PayPal&apos;s approval screen. No money moves.
          </p>
          {token ? <Order token={token} /> : <Missing />}
        </div>
      </div>
    </div>
  );
}

function Order({ token }: { token: string }) {
  const router = useRouter();
  const { data, error, loading, retry } = useApi<OrderSummaryResponse>(
    `/api/checkout/order?token=${encodeURIComponent(token)}`,
  );
  const returnUrl = `/checkout/return?token=${encodeURIComponent(token)}`;

  if (loading) {
    return (
      <Loading label="Loading order">
        <Skeleton className="mt-6 h-28 w-full" />
        <Skeleton className="mt-6 h-12 w-full" />
      </Loading>
    );
  }
  if (error || !data) {
    return (
      <div className="mt-6 font-sans">
        <ErrorNotice message={`Could not load this order. ${error ?? ""}`} onRetry={retry} />
      </div>
    );
  }

  const { purchase, project } = data;
  return (
    <>
      <dl className="mt-6 space-y-3 border-y border-dashed border-ink/30 py-4 text-sm">
        <Line label="Pay to" value="SunShare (prototype)" />
        <Line label="For" value={`${num(purchase.cells)} solar cells in ${project.name}`} />
        <Line label="Order" value={purchase.paypalOrderId} />
        <Line label="Amount" value={money(purchase.amountCents)} big />
      </dl>
      {purchase.status === "completed" ? (
        <div className="mt-6 font-sans">
          <p className="text-sm">This payment has already been approved.</p>
          <ButtonLink href={returnUrl} className="mt-3 min-h-11 w-full">
            See confirmation
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 font-sans">
          <button
            type="button"
            onClick={() => router.push(returnUrl)}
            className="min-h-12 rounded-md bg-ink px-6 font-medium text-paper transition-colors hover:bg-ink/85"
          >
            Approve {money(purchase.amountCents)}
          </button>
          <Link
            href={`/projects/${project.id}`}
            className="flex min-h-11 items-center justify-center rounded-md border border-ink/30 px-6 text-sm font-medium hover:border-ink"
          >
            Cancel and go back
          </Link>
        </div>
      )}
    </>
  );
}

function Line({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular text-right [overflow-wrap:anywhere] ${big ? "text-xl font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Missing() {
  return (
    <div className="mt-6 font-sans">
      <ErrorNotice message="This link has no order in it.">
        <Link href="/projects" className="inline-flex min-h-11 items-center font-medium underline">
          Back to projects
        </Link>
      </ErrorNotice>
    </div>
  );
}
