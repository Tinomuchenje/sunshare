"use client";

import { useState, type ComponentProps } from "react";
import { Minus, Plus } from "lucide-react";
import type { CreateCheckoutRequest, CreateCheckoutResponse, ProjectView } from "@/lib/api-types";
import { api } from "@/lib/api";
import { money, num } from "@/lib/format";
import { Button, ButtonLink, Card, Notice } from "@/components/ui";
import { sharePct } from "./bits";
import { estimateIncome } from "./estimate";

const quickAmounts = [2500, 5000, 10000];

export function BuyBox({ project }: { project: ProjectView }) {
  return (
    <Card className="space-y-5">
      {project.yourCells > 0 ? (
        <div className="rounded-xl bg-green-soft px-4 py-3 text-sm text-green-dark">
          You own <span className="tabular font-semibold">{num(project.yourCells)}</span> cells
          here, {sharePct(project.yourCells, project.totalCells)} of the plant.
        </div>
      ) : null}
      {project.cellsAvailable > 0 && project.status === "funding" ? (
        <BuyForm project={project} />
      ) : (
        <Closed project={project} />
      )}
    </Card>
  );
}

function Closed({ project }: { project: ProjectView }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">No cells left to buy</h2>
      <p className="mt-1.5 text-sm text-muted">
        {project.status === "operating"
          ? "This plant is running and fully owned. Its monthly reports are below."
          : "This plant is fully funded. It is installed next, and payouts start once it runs."}
      </p>
      <ButtonLink href="/projects" variant="secondary" className="mt-4 min-h-11 w-full">
        See other projects
      </ButtonLink>
    </div>
  );
}

function BuyForm({ project }: { project: ProjectView }) {
  const max = project.cellsAvailable;
  const [cells, setCells] = useState(Math.min(10, max));
  // What the visitor is typing, so clearing the field does not snap back at once.
  const [draft, setDraft] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (n: number) => {
    setDraft(null);
    setCells(Math.max(1, Math.min(max, Math.floor(n) || 1)));
  };
  const type = (text: string) => {
    const n = Number(text);
    if (text === "" || !(n >= 1)) return setDraft(text);
    set(n);
  };
  const total = cells * project.cellPriceCents;
  const income = estimateIncome(project, cells);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const body: CreateCheckoutRequest = { projectId: project.id, cells };
      const res = await api<CreateCheckoutResponse>("/api/checkout/create", body);
      window.location.assign(res.approveUrl);
    } catch (e) {
      setError((e as Error).message);
      setPaying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Buy cells</h2>
        <p className="mt-1 text-sm text-muted">
          {money(project.cellPriceCents)} per cell · {num(max)} left
        </p>
      </div>

      <div>
        <label htmlFor="cells" className="text-sm font-medium">
          Number of cells
        </label>
        <div className="mt-2 flex items-center gap-2">
          <StepButton label="One fewer cell" onClick={() => set(cells - 1)} disabled={cells <= 1}>
            <Minus className="size-4" aria-hidden />
          </StepButton>
          <input
            id="cells"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={draft ?? cells}
            onChange={(e) => type(e.target.value)}
            onBlur={() => setDraft(null)}
            className="tabular h-11 w-full min-w-0 rounded-xl border border-line bg-paper text-center text-lg font-semibold"
          />
          <StepButton label="One more cell" onClick={() => set(cells + 1)} disabled={cells >= max}>
            <Plus className="size-4" aria-hidden />
          </StepButton>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Quick amounts">
          {quickAmounts.map((amount) => {
            const n = Math.floor(amount / project.cellPriceCents);
            return (
              <button
                key={amount}
                type="button"
                onClick={() => set(n)}
                disabled={n < 1 || n > max}
                aria-pressed={cells === n}
                className="tabular min-h-11 rounded-xl border border-line text-sm font-medium transition-colors hover:border-ink/30 disabled:opacity-40 aria-pressed:border-green aria-pressed:bg-green-soft aria-pressed:text-green-dark"
              >
                {money(amount)}
              </button>
            );
          })}
        </div>
      </div>

      <dl className="space-y-2 border-t border-line pt-4 text-sm">
        <Row label="Total" value={money(total)} strong />
        <Row label="Your share of the plant" value={sharePct(cells + project.yourCells, project.totalCells)} />
        {income ? (
          <>
            <Row label="Estimated monthly income" value={money(income.monthlyCents)} />
            <Row label="Estimated yearly income" value={money(income.yearlyCents)} />
          </>
        ) : null}
      </dl>
      <p className="text-xs text-muted">
        {income
          ? "Estimated, not guaranteed. Income depends on sunshine and how much power the site uses, and starts once the plant is installed."
          : "An income estimate appears once the vetting agent has reviewed this project."}
      </p>

      <Button onClick={pay} disabled={paying} size="lg" className="min-h-12 w-full">
        {paying ? "Opening PayPal…" : `Pay ${money(total)} with PayPal`}
      </Button>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <p className="text-center text-xs text-muted">
        You approve the payment with PayPal next. Nothing is charged before that.
      </p>
    </div>
  );
}

function StepButton({
  label,
  ...props
}: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-xl border border-line transition-colors hover:border-ink/30 disabled:opacity-40"
      {...props}
    />
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular ${strong ? "text-xl font-semibold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
