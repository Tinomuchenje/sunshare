"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { AgentStep } from "@/lib/api-types";
import { Badge } from "@/components/ui";
import { AgentAvatar, agents } from "./agents";

const STEP_DELAY_MS = 700;

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Agent steps as a vertical timeline, revealed one at a time so a viewer can follow along.
 * `after` appears once every step is shown. Give the component a new `key` for each new run.
 */
export function StepTimeline({ steps, after }: { steps: AgentStep[]; after?: ReactNode }) {
  const [shown, setShown] = useState(() =>
    prefersReducedMotion() ? steps.length : Math.min(1, steps.length),
  );

  useEffect(() => {
    if (shown >= steps.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_DELAY_MS);
    return () => clearTimeout(t);
  }, [shown, steps.length]);

  const next = steps[shown];

  return (
    <div>
      <ol aria-live="polite" aria-relevant="additions">
        {steps.slice(0, shown).map((step, i) => (
          <li
            key={i}
            className="relative flex gap-3 pb-5 transition duration-300 last:pb-0 starting:translate-y-1 starting:opacity-0"
          >
            {i < steps.length - 1 ? (
              <span className="absolute top-10 bottom-1 left-[17px] w-px bg-line" aria-hidden />
            ) : null}
            <AgentAvatar agent={step.agent} status={step.status} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                {agents[step.agent].name}
                {step.status === "warning" ? <Badge tone="warn">Needs attention</Badge> : null}
                {step.status === "error" ? <Badge tone="bad">Failed</Badge> : null}
              </p>
              <p className="mt-0.5 font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {next ? (
        <p className="mt-5 flex items-center gap-3 text-sm text-muted" aria-hidden>
          <span className="grid size-9 place-items-center rounded-full border border-dashed border-line">
            <LoaderCircle className="size-4 motion-safe:animate-spin" />
          </span>
          {agents[next.agent].name} is working
        </p>
      ) : (
        after
      )}
    </div>
  );
}
