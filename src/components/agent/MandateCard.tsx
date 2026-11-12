"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import type { MandateResponse } from "@/lib/api-types";
import type { Mandate } from "@/lib/types";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { Button, Card, Notice, ProgressBar } from "@/components/ui";

/** The investor's spending limits for the agent: the trust mechanism, shown compactly. */
export function MandateCard({
  data,
  error,
  onRetry,
  onSaved,
}: {
  data: MandateResponse | null;
  error: string | null;
  onRetry: () => void;
  onSaved: (data: MandateResponse) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (error && !data) {
    return (
      <Notice tone="bad">
        Could not load your limits: {error}{" "}
        <button type="button" onClick={onRetry} className="font-medium underline">
          Try again
        </button>
      </Notice>
    );
  }

  if (!data) {
    return <div className="h-[132px] animate-pulse rounded-card border border-line bg-surface" />;
  }

  const { mandate, spentThisMonthCents } = data;
  const left = Math.max(0, mandate.monthlyBudgetCents - spentThisMonthCents);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-64 gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-soft text-green-dark">
            <ShieldCheck className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">Your limits</h2>
            <p className="tabular mt-0.5 text-muted">
              The agent may spend up to{" "}
              <strong className="font-semibold text-ink">{money(mandate.maxPerPurchaseCents)}</strong>{" "}
              per purchase and{" "}
              <strong className="font-semibold text-ink">{money(mandate.monthlyBudgetCents)}</strong>{" "}
              per month.
            </p>
          </div>
        </div>
        {!editing ? (
          <Button variant="secondary" className="min-h-11" onClick={() => setEditing(true)}>
            Change limits
          </Button>
        ) : null}
      </div>

      {editing ? (
        <MandateForm
          mandate={mandate}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            onSaved(next);
          }}
        />
      ) : (
        <div className="mt-4 sm:pl-12">
          <ProgressBar
            value={(spentThisMonthCents / Math.max(1, mandate.monthlyBudgetCents)) * 100}
            label="Spent by the agent this month"
          />
          <p className="tabular mt-2 text-sm text-muted">
            Spent this month: {money(spentThisMonthCents)} of {money(mandate.monthlyBudgetCents)}.{" "}
            {money(left)} left.
          </p>
        </div>
      )}
    </Card>
  );
}

function MandateForm({
  mandate,
  onCancel,
  onSaved,
}: {
  mandate: Mandate;
  onCancel: () => void;
  onSaved: (data: MandateResponse) => void;
}) {
  const [perPurchase, setPerPurchase] = useState(String(mandate.maxPerPurchaseCents / 100));
  const [monthly, setMonthly] = useState(String(mandate.monthlyBudgetCents / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Mandate = {
      maxPerPurchaseCents: Math.round(Number(perPurchase) * 100),
      monthlyBudgetCents: Math.round(Number(monthly) * 100),
    };
    if (!(next.maxPerPurchaseCents > 0) || !(next.monthlyBudgetCents > 0)) {
      setError("Enter an amount above $0 for both limits.");
      return;
    }
    if (next.maxPerPurchaseCents > next.monthlyBudgetCents) {
      setError("The limit per purchase cannot be more than the monthly limit.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<MandateResponse>("/api/agent/mandate", next, "PUT"));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 sm:pl-12" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <DollarField label="Most per purchase" value={perPurchase} onChange={setPerPurchase} />
        <DollarField label="Most per month" value={monthly} onChange={setMonthly} />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={saving}>
          {saving ? "Saving" : "Save limits"}
        </Button>
        <Button type="button" variant="secondary" className="min-h-11" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DollarField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="mt-1.5 flex min-h-11 items-center rounded-xl border border-line bg-paper px-3 focus-within:border-green focus-within:ring-2 focus-within:ring-green/30">
        <span className="text-muted" aria-hidden>
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tabular w-full bg-transparent px-1.5 py-2 text-base outline-none"
        />
      </span>
    </label>
  );
}
