import type { ProjectView } from "@/lib/api-types";
import { money, num, pct } from "@/lib/format";
import { Card, Stat } from "@/components/ui";
import { SectionHeading } from "./bits";

export function KeyFacts({ project }: { project: ProjectView }) {
  const saving = 1 - project.tariffCentsPerKwh / project.previousCostCentsPerKwh;
  return (
    <section aria-labelledby="facts">
      <SectionHeading id="facts">Key facts</SectionHeading>
      <Card>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Plant size" value={`${num(project.capacityKw)} kW`} />
          <Stat label="Cells" value={num(project.totalCells)} hint={`${num(project.ownerCount)} owners`} />
          <Stat label="Price per cell" value={money(project.cellPriceCents)} />
          <Stat label="Power used by the site" value={pct(project.utilisation * 100)} hint="of what it makes" />
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-xl bg-sun-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            The site pays <strong className="tabular">{money(project.tariffCentsPerKwh)}</strong> per
            kWh for this power, down from{" "}
            <strong className="tabular">{money(project.previousCostCentsPerKwh)}</strong> for
            diesel or grid power before.
          </p>
          {saving > 0 ? (
            <p className="tabular shrink-0 text-lg font-semibold">{pct(saving * 100)} cheaper</p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
