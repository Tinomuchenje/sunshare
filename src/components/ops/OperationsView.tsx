"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentStep,
  FastForwardResponse,
  OpsResponse,
  ProjectView,
  RunMonthResponse,
} from "@/lib/api-types";
import { api } from "@/lib/api";
import { money, monthLabel, num } from "@/lib/format";
import { Card, Notice, Stat } from "@/components/ui";
import { StepTimeline, prefersReducedMotion } from "@/components/agent/StepTimeline";
import { AgentRoster } from "./AgentRoster";
import { MonthSummary } from "./MonthSummary";
import { PayoutLedger } from "./PayoutLedger";
import { PlantCard, type PlantAction } from "./PlantCard";
import { ReportsTable } from "./ReportsTable";
import { ResetDemo } from "./ResetDemo";

interface Activity {
  id: number;
  heading: string;
  steps: AgentStep[];
  month?: RunMonthResponse;
}

export function OperationsView() {
  const [data, setData] = useState<OpsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState<{ projectId: string; action: PlantAction } | null>(null);
  const [actionError, setActionError] = useState<{ projectId: string; message: string } | null>(
    null,
  );
  const [activity, setActivity] = useState<Activity | null>(null);
  const busy = useRef(false);
  const logHeading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    return api<OpsResponse>("/api/ops")
      .then((d) => {
        setData(d);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activity) return;
    // On narrow screens the log sits below the plants: bring it into view so the run can be watched.
    const el = logHeading.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      el.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [activity]);

  /** Each run gets a new id so the timeline starts again from the first step. */
  function show(next: Omit<Activity, "id">) {
    setActivity((prev) => ({ id: (prev?.id ?? 0) + 1, ...next }));
  }

  async function act(project: ProjectView, action: PlantAction) {
    if (busy.current) return;
    busy.current = true;
    setRunning({ projectId: project.id, action });
    setActionError(null);
    try {
      if (action === "fast-forward") {
        const res = await api<FastForwardResponse>("/api/ops/fast-forward", {
          projectId: project.id,
        });
        show({ heading: `${project.name}: funded and installed`, steps: res.steps });
      } else {
        const res = await api<RunMonthResponse>("/api/ops/run-month", {
          projectId: project.id,
          scenario: action === "run-fault" ? "underperform" : "normal",
        });
        show({
          heading: `${project.name}: ${monthLabel(res.report.month)}`,
          steps: res.steps,
          month: res,
        });
      }
      await load();
    } catch (err) {
      setActionError({ projectId: project.id, message: (err as Error).message });
    } finally {
      busy.current = false;
      setRunning(null);
    }
  }

  if (!data) {
    return loadError ? (
      <Notice tone="bad">
        Could not load operations data: {loadError}{" "}
        <button type="button" onClick={load} className="font-medium underline">
          Try again
        </button>
      </Notice>
    ) : (
      <div className="space-y-6" aria-busy="true">
        <div className="h-28 animate-pulse rounded-card border border-line bg-surface" />
        <div className="h-72 animate-pulse rounded-card border border-line bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section aria-labelledby="agents-heading">
        <h2 id="agents-heading" className="mb-4 text-xl font-semibold tracking-tight">
          The four agents
        </h2>
        <AgentRoster />
      </section>

      <Card className="grid gap-6 sm:grid-cols-3">
        <Stat label="Paid out to owners" value={money(data.totals.paidOutCents)} />
        <Stat label="Clean energy generated" value={`${num(data.totals.kwhGenerated)} kWh`} />
        <Stat label="Payouts sent" value={num(data.totals.payoutsSent)} />
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="plants-heading">
          <h2 id="plants-heading" className="text-xl font-semibold tracking-tight">
            Solar plants
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">Pick an action to watch the agents work.</p>
          <div className="space-y-4">
            {data.projects.map((p) => (
              <PlantCard
                key={p.id}
                project={p}
                busy={running !== null}
                running={running?.projectId === p.id ? running.action : null}
                error={actionError?.projectId === p.id ? actionError.message : null}
                onAction={(action) => act(p, action)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="log-heading">
          <h2
            id="log-heading"
            ref={logHeading}
            className="scroll-mt-20 text-xl font-semibold tracking-tight"
          >
            Agent activity
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            {activity ? activity.heading : "What each agent did, step by step."}
          </p>
          <Card>
            {activity ? (
              <StepTimeline
                key={activity.id}
                steps={activity.steps}
                after={
                  activity.month ? (
                    <MonthSummary result={activity.month} />
                  ) : (
                    <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
                      The plant is now operating. Run its first month to see the monitoring and
                      payout agents at work.
                    </p>
                  )
                }
              />
            ) : (
              <p className="py-6 text-center text-sm text-muted">
                Nothing yet. Run a month or fast-forward a plant, and each agent&apos;s work will
                appear here.
              </p>
            )}
          </Card>
        </section>
      </div>

      <section aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="mb-4 text-xl font-semibold tracking-tight">
          Monthly reports
        </h2>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <ReportsTable reports={data.reports} />
        </div>
      </section>

      <section aria-labelledby="ledger-heading">
        <h2 id="ledger-heading" className="text-xl font-semibold tracking-tight">
          Payout ledger
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Every payment to every owner, newest first. Your rows are highlighted.
        </p>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <PayoutLedger payouts={data.payouts} />
        </div>
      </section>

      <div className="border-t border-line pt-6">
        <ResetDemo
          disabled={running !== null}
          onReset={() => {
            setActivity(null);
            setActionError(null);
            load();
          }}
        />
      </div>
    </div>
  );
}
