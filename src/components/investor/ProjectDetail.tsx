"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import type { ProjectResponse } from "@/lib/api-types";
import { Card } from "@/components/ui";
import { ErrorNotice, GradeBadge, KindBadge, Loading, Skeleton } from "./bits";
import { BuyBox } from "./BuyBox";
import { FundingSummary } from "./FundingSummary";
import { KeyFacts } from "./KeyFacts";
import { MonthlyReports } from "./MonthlyReports";
import { useApi } from "./useApi";
import { VettingPanel } from "./VettingPanel";

const layout =
  "grid gap-8 md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-[auto_1fr] md:items-start";

export function ProjectDetail({ id }: { id: string }) {
  const { data, error, loading, retry } = useApi<ProjectResponse>(
    `/api/projects/${encodeURIComponent(id)}`,
  );

  return (
    <>
      <Link
        href="/projects"
        className="-ml-2 mb-6 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All projects
      </Link>
      {loading ? (
        <DetailSkeleton />
      ) : error || !data ? (
        <ErrorNotice message={`Could not load this project. ${error ?? ""}`} onRetry={retry} />
      ) : (
        <Detail data={data} />
      )}
    </>
  );
}

function Detail({ data: { project, reports } }: { data: ProjectResponse }) {
  return (
    <div className={layout}>
      <header className="md:col-start-1">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={project.kind} />
          <GradeBadge vetting={project.vetting} />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-muted">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {project.locationName}, {project.country}
        </p>
        <p className="mt-5 text-lg">{project.summary}</p>
        <p className="mt-3 flex items-start gap-2 text-muted">
          <Users className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
          {project.impact}
        </p>
        <div className="mt-8">
          <FundingSummary project={project} size="large" />
        </div>
      </header>

      <aside
        aria-label="Buy cells"
        className="md:sticky md:top-20 md:col-start-2 md:row-span-2 md:row-start-1"
      >
        <BuyBox project={project} />
      </aside>

      <div className="space-y-12 md:col-start-1">
        <KeyFacts project={project} />
        <VettingPanel vetting={project.vetting} />
        {project.status === "operating" ? <MonthlyReports reports={reports} /> : null}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <Loading label="Loading project">
      <div className={layout}>
        <div>
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-3 h-5 w-1/3" />
          <Skeleton className="mt-6 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-4/5" />
          <Skeleton className="mt-8 h-32 w-full" />
          <Skeleton className="mt-12 h-48 w-full" />
        </div>
        <Card className="space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </Card>
      </div>
    </Loading>
  );
}
