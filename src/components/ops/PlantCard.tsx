import { FastForward, Play } from "lucide-react";
import type { ProjectView } from "@/lib/api-types";
import { monthLabel, num, pct } from "@/lib/format";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";

export type PlantAction = "fast-forward" | "run" | "run-fault";

/** One solar plant with the single demo action that applies to its current state. */
export function PlantCard({
  project,
  busy,
  running,
  error,
  onAction,
}: {
  project: ProjectView;
  /** Any action is in progress somewhere on the page. */
  busy: boolean;
  /** This plant's action is the one in progress. */
  running: PlantAction | null;
  error: string | null;
  onAction: (action: PlantAction) => void;
}) {
  const operating = project.status === "operating";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{project.name}</h3>
          <p className="text-sm text-muted">
            {project.locationName}, {project.country}
          </p>
        </div>
        {operating ? (
          <Badge tone="green">Operating</Badge>
        ) : (
          <Badge tone="sun">Funding</Badge>
        )}
      </div>

      <p className="tabular mt-3 text-sm text-muted">
        {project.capacityKw} kW · {num(project.ownerCount)} owners
        {project.yourCells > 0 ? (
          <>
            {" "}
            · <span className="font-medium text-ink">you own {num(project.yourCells)} cells</span>
          </>
        ) : null}
      </p>

      {operating ? (
        <div className="mt-4">
          <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={() => onAction("run")}>
            <Play className="size-4" aria-hidden />
            {running === "run" ? "Running" : `Run ${monthLabel(project.nextMonth)}`}
          </Button>
          <div className="mt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction("run-fault")}
              className="min-h-11 rounded-full px-1 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running === "run-fault" ? "Running with a fault" : "Or run it with a simulated fault"}
            </button>
            <p className="text-xs text-muted">Lets you see the monitoring agent catch a problem.</p>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <ProgressBar value={project.fundedPct} label={`${project.name} funding`} />
          <p className="tabular mt-2 text-sm text-muted">
            {pct(project.fundedPct)} funded · {num(project.cellsAvailable)} cells left
          </p>
          <Button
            variant="secondary"
            className="mt-4 min-h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={() => onAction("fast-forward")}
          >
            <FastForward className="size-4" aria-hidden />
            {running === "fast-forward" ? "Fast-forwarding" : "Fast-forward: fund and install"}
          </Button>
          <p className="mt-2 text-xs text-muted">
            Demo shortcut. Sells the remaining cells to sample investors and marks the plant
            installed, skipping weeks of real fundraising and installation.
          </p>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
