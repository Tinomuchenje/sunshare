import { Activity } from "lucide-react";
import type { ProjectView } from "@/lib/api-types";
import { money, num, pct } from "@/lib/format";
import { CellGrid } from "./CellGrid";

/** Funding progress as a filling panel of cells, or the operating state. */
export function FundingSummary({
  project,
  size = "card",
}: {
  project: ProjectView;
  size?: "card" | "large";
}) {
  const large = size === "large";
  const yourPct = (project.yourCells / project.totalCells) * 100;

  if (project.status === "operating") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-green-soft px-4 py-3 text-green-dark">
        <Activity className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Operating</p>
          <p className="text-sm">
            Fully funded by {num(project.ownerCount)} owners. Income is paid out each month.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className={`tabular font-semibold ${large ? "text-2xl" : "text-base"}`}>
          {pct(project.fundedPct)} funded
        </p>
        <p className="tabular text-sm text-muted">
          {money(project.raisedCents)} of {money(project.targetCents)}
        </p>
      </div>
      <CellGrid
        fundedPct={project.fundedPct}
        yourPct={large ? yourPct : 0}
        columns={large ? 25 : 20}
        rows={large ? 4 : 2}
        label={`${pct(project.fundedPct)} of cells sold${
          large && project.yourCells > 0 ? `, including your ${num(project.yourCells)}` : ""
        }`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
        <p className="tabular">
          {project.cellsAvailable > 0
            ? `${num(project.cellsAvailable)} cells left`
            : "Fully funded. Installation is next."}
        </p>
        {large ? <Legend showYours={project.yourCells > 0} /> : null}
      </div>
    </div>
  );
}

function Legend({ showYours }: { showYours: boolean }) {
  const items = [
    { color: "bg-sun", text: "Sold" },
    ...(showYours ? [{ color: "bg-green", text: "Yours" }] : []),
    { color: "bg-line", text: "Available" },
  ];
  return (
    <ul className="flex gap-3" aria-hidden>
      {items.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${i.color}`} />
          {i.text}
        </li>
      ))}
    </ul>
  );
}
