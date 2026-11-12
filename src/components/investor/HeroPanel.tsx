import { CellGrid } from "./CellGrid";

/** Decorative: one plant, many owners, a few cells that are yours. */
export function HeroPanel() {
  return (
    <div aria-hidden className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="rounded-xl bg-ink p-3">
        <CellGrid fundedPct={100} yourPct={8} columns={12} rows={6} label="" />
      </div>
      <div className="mx-auto h-6 w-2 bg-line" />
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-green" /> Your cells
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-sun" /> Other owners
        </span>
      </div>
    </div>
  );
}
