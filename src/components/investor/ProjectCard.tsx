import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { ProjectView } from "@/lib/api-types";
import { num, pct } from "@/lib/format";
import { Badge } from "@/components/ui";
import { GradeBadge, KindBadge, Skeleton } from "./bits";
import { FundingSummary } from "./FundingSummary";

export function ProjectCard({
  project,
  headingLevel = "h2",
}: {
  project: ProjectView;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink/30 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={project.kind} />
        <GradeBadge vetting={project.vetting} />
        {project.yourCells > 0 ? (
          <Badge tone="green">You own {num(project.yourCells)}</Badge>
        ) : null}
      </div>

      <Heading className="mt-4 text-lg font-semibold tracking-tight">{project.name}</Heading>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        {project.locationName}, {project.country}
      </p>
      <p className="mt-3 line-clamp-3 text-sm">{project.summary}</p>

      <div className="mt-auto pt-5">
        <FundingSummary project={project} />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
          <p>
            {project.vetting ? (
              <>
                <span className="tabular font-semibold">
                  {pct(project.vetting.estimatedYieldPct, 1)}
                </span>{" "}
                <span className="text-muted">a year, estimated</span>
              </>
            ) : (
              <span className="text-muted">Estimate after vetting</span>
            )}
          </p>
          <span className="flex items-center gap-1 font-medium text-green-dark">
            View
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
      <Skeleton className="mt-6 h-5 w-1/3" />
      <Skeleton className="mt-2 h-14 w-full" />
      <Skeleton className="mt-6 h-5 w-full" />
    </div>
  );
}
