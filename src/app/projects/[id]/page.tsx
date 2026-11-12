import type { Metadata } from "next";
import { ProjectDetail } from "@/components/investor/ProjectDetail";

export const metadata: Metadata = { title: "Project · SunShare" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
