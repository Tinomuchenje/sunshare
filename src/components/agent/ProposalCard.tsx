"use client";

import { useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { AgentExecuteResponse, AgentProposal } from "@/lib/api-types";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { Badge, Button, ButtonLink, Notice } from "@/components/ui";
import { StepTimeline } from "./StepTimeline";

type State =
  | { kind: "open" }
  | { kind: "buying" }
  | { kind: "declined" }
  | { kind: "failed"; message: string }
  | { kind: "done"; result: AgentExecuteResponse };

/** A purchase the agent suggests. Nothing is bought until the investor approves. */
export function ProposalCard({
  proposal,
  onBought,
}: {
  proposal: AgentProposal;
  onBought: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "open" });
  const submitting = useRef(false);

  async function approve() {
    if (submitting.current) return;
    submitting.current = true;
    setState({ kind: "buying" });
    try {
      const result = await api<AgentExecuteResponse>("/api/agent/execute", { proposal });
      setState({ kind: "done", result });
      onBought();
    } catch (err) {
      submitting.current = false;
      setState({ kind: "failed", message: (err as Error).message });
    }
  }

  if (state.kind === "declined") {
    return (
      <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted">
        You said not now to this suggestion. Nothing was bought.
      </p>
    );
  }

  return (
    <section
      aria-label="Suggested purchase"
      className="rounded-card border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Suggested purchase</h3>
        {state.kind === "done" ? (
          <Badge tone="green">Approved</Badge>
        ) : proposal.withinMandate ? (
          <Badge tone="sun">Waiting for your approval</Badge>
        ) : (
          <Badge tone="warn">Outside your limits</Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">{proposal.rationale}</p>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {proposal.items.map((item) => (
          <li key={item.projectId} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium">{item.projectName}</p>
              <p className="tabular shrink-0 font-medium">{money(item.amountCents)}</p>
            </div>
            <p className="tabular text-sm text-muted">
              {item.cells} {item.cells === 1 ? "cell" : "cells"}. {item.reason}
            </p>
          </li>
        ))}
      </ul>
      <div className="tabular mt-3 flex items-baseline justify-between font-semibold">
        <span>Total</span>
        <span>{money(proposal.totalCents)}</span>
      </div>

      <div className="mt-5">
        {!proposal.withinMandate ? (
          <Notice tone="warn">
            The agent cannot buy this. {proposal.blockedReason} You can change your limits above,
            or ask for a smaller amount.
          </Notice>
        ) : state.kind === "done" ? (
          <StepTimeline
            steps={state.result.steps}
            after={<Receipt result={state.result} />}
          />
        ) : (
          <>
            {state.kind === "failed" ? (
              <div className="mb-4">
                <Notice tone="bad">The purchase did not go through: {state.message}</Notice>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                onClick={approve}
                disabled={state.kind === "buying"}
              >
                {state.kind === "buying"
                  ? "Buying"
                  : `Approve and pay ${money(proposal.totalCents)}`}
              </Button>
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => setState({ kind: "declined" })}
                disabled={state.kind === "buying"}
              >
                Not now
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Paid with PayPal. Nothing is charged until you approve.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Receipt({ result }: { result: AgentExecuteResponse }) {
  return (
    <div className="mt-5 rounded-xl bg-green-soft p-4">
      <p className="flex items-center gap-2 font-medium text-green-dark">
        <CircleCheck className="size-4.5" aria-hidden />
        {result.purchases.length === 1 ? "Purchase complete" : "Purchases complete"}
      </p>
      <ul className="tabular mt-2 space-y-1 text-sm">
        {result.purchases.map((p) => (
          <li key={p.id}>
            {p.cells} {p.cells === 1 ? "cell" : "cells"} in {p.projectName} for{" "}
            {money(p.amountCents)}.{" "}
            <span className="break-all text-muted">PayPal order {p.paypalOrderId}</span>
          </li>
        ))}
      </ul>
      {result.mode === "demo" ? (
        <p className="mt-2 text-xs text-muted">Demo mode: the PayPal payment was simulated.</p>
      ) : null}
      <ButtonLink href="/portfolio" variant="secondary" className="mt-4 min-h-11">
        See your portfolio
      </ButtonLink>
    </div>
  );
}
