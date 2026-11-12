import type { Project } from "@/lib/types";

/**
 * Estimated income for a number of cells, from the vetting agent's yearly yield.
 * Returns null when the project has not been vetted. Not guaranteed.
 */
export function estimateIncome(project: Project, cells: number) {
  if (!project.vetting) return null;
  const yearlyCents = Math.floor(
    (cells * project.cellPriceCents * project.vetting.estimatedYieldPct) / 100,
  );
  return { yearlyCents, monthlyCents: Math.floor(yearlyCents / 12) };
}
