import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ProjectList } from "@/components/investor/ProjectList";

export const metadata: Metadata = { title: "Projects · SunShare" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        intro="Each project is a solar plant for a clinic or farm. Buy cells in one, and you receive your share of what the site pays for its electricity."
      />
      <ProjectList />
    </>
  );
}
