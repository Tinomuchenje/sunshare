"use client";

import type { ProjectsResponse } from "@/lib/api-types";
import { Notice } from "@/components/ui";
import { ErrorNotice, Loading } from "./bits";
import { ProjectCard, ProjectCardSkeleton } from "./ProjectCard";
import { useApi } from "./useApi";

const grid = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function ProjectList({ headingLevel }: { headingLevel?: "h2" | "h3" }) {
  const { data, error, loading, retry } = useApi<ProjectsResponse>("/api/projects");

  if (loading) {
    return (
      <Loading label="Loading projects">
        <div className={grid}>
          {[0, 1, 2].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </Loading>
    );
  }
  if (error || !data) {
    return <ErrorNotice message={`Could not load projects. ${error ?? ""}`} onRetry={retry} />;
  }
  if (data.projects.length === 0) {
    return <Notice>No projects are open right now. Check back soon.</Notice>;
  }

  return (
    <ul className={grid}>
      {data.projects.map((p) => (
        <li key={p.id}>
          <ProjectCard project={p} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
