import { CircleCheck, TriangleAlert } from "lucide-react";
import type { VettingReport } from "@/lib/types";
import { num, pct } from "@/lib/format";
import { Card } from "@/components/ui";
import { gradeWord, SectionHeading } from "./bits";

const sunSource: Record<VettingReport["sunDataSource"], string> = {
  "nasa-power": "NASA POWER satellite records for this location",
  seeded: "a sample figure, because the NASA lookup was unavailable",
};

export function VettingPanel({ vetting }: { vetting?: VettingReport }) {
  return (
    <section aria-labelledby="vetting">
      <SectionHeading
        id="vetting"
        intro="The vetting agent reviews every project before it is listed."
      >
        Vetting report
      </SectionHeading>
      {vetting ? <Report vetting={vetting} /> : (
        <Card>
          <p className="text-muted">The vetting agent has not reviewed this project yet.</p>
        </Card>
      )}
    </section>
  );
}

function Report({ vetting }: { vetting: VettingReport }) {
  const strong = vetting.grade === "A" || vetting.grade === "B";
  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center gap-5">
        <div
          className={`grid size-16 shrink-0 place-items-center rounded-2xl text-3xl font-semibold ${
            strong ? "bg-green-soft text-green-dark" : "bg-warn-soft text-warn"
          }`}
        >
          <span className="sr-only">Grade </span>
          {vetting.grade}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {gradeWord[vetting.grade]} · score{" "}
            <span className="tabular">{vetting.score}</span> out of 100
          </p>
          <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-line" aria-hidden>
            <div className={`h-full rounded-full ${strong ? "bg-green" : "bg-warn"}`} style={{ width: `${vetting.score}%` }} />
          </div>
        </div>
      </div>

      <p className="text-lg">{vetting.summary}</p>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Figure
          label="Sunlight"
          value={`${num(vetting.sunHoursPerDay, 1)} hours a day`}
          hint={`From ${sunSource[vetting.sunDataSource]}`}
        />
        <Figure
          label="Forecast output"
          value={`${num(vetting.forecastKwhPerMonth)} kWh a month`}
          hint="Before weather and usage vary"
        />
        <Figure
          label="Estimated yearly income"
          value={`${pct(vetting.estimatedYieldPct, 1)} of cell price`}
          hint="An estimate, not guaranteed"
        />
      </dl>

      <div className="grid gap-6 sm:grid-cols-2">
        <Points title="Strengths" items={vetting.strengths} good />
        <Points title="Risks" items={vetting.risks} />
      </div>

      <p className="text-xs text-muted">
        {vetting.writtenBy === "ai"
          ? "Summary written by an AI model. All figures are calculated in code."
          : "Summary written from fixed rules in demo mode. All figures are calculated in code."}
      </p>
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-paper p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular mt-1 font-semibold">{value}</dd>
      <dd className="mt-1 text-xs text-muted">{hint}</dd>
    </div>
  );
}

function Points({ title, items, good }: { title: string; items: string[]; good?: boolean }) {
  const Icon = good ? CircleCheck : TriangleAlert;
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None noted.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${good ? "text-green" : "text-warn"}`}
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
