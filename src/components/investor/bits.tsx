// Small presentational pieces shared by the investor screens.

import { Droplets, RotateCw, Snowflake, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";
import type { ProjectKind, VettingReport } from "@/lib/types";
import { kindLabel } from "@/lib/format";
import { Badge, Button, Notice } from "@/components/ui";

const kindIcon: Record<ProjectKind, typeof Stethoscope> = {
  clinic: Stethoscope,
  irrigation: Droplets,
  "cold-storage": Snowflake,
};

export function KindBadge({ kind }: { kind: ProjectKind }) {
  const Icon = kindIcon[kind];
  return (
    <Badge>
      <Icon className="size-3.5" aria-hidden />
      {kindLabel[kind]}
    </Badge>
  );
}

export const gradeWord: Record<VettingReport["grade"], string> = {
  A: "Strong",
  B: "Good",
  C: "Fair",
  D: "Weak",
};

export function GradeBadge({ vetting }: { vetting?: VettingReport }) {
  if (!vetting) return <Badge>Not vetted yet</Badge>;
  const tone = vetting.grade === "A" || vetting.grade === "B" ? "green" : "warn";
  return (
    <Badge tone={tone} title={`Vetting score ${vetting.score} out of 100`}>
      Grade {vetting.grade}
      <span className="sr-only">, {gradeWord[vetting.grade].toLowerCase()}</span>
    </Badge>
  );
}

/** Grey placeholder block that holds the space while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

/** Wraps a loading placeholder so screen readers hear "Loading". */
export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      {children}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
  children,
}: {
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <Notice tone="bad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <div className="flex flex-wrap gap-2">
          {children}
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry} className="min-h-11">
              <RotateCw className="size-4" aria-hidden />
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </Notice>
  );
}

export function SectionHeading({
  id,
  children,
  intro,
}: {
  id?: string;
  children: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {children}
      </h2>
      {intro ? <p className="mt-1.5 text-muted">{intro}</p> : null}
    </div>
  );
}

/** "Nov 11, 2026" */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** Share of the plant as a readable percentage, keeping small shares visible. */
export function sharePct(cells: number, total: number): string {
  const share = (cells / total) * 100;
  const digits = share < 1 ? 2 : 1;
  return `${share.toFixed(digits)}%`;
}
