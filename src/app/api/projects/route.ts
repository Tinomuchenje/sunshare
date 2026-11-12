import type { ProjectsResponse } from "@/lib/api-types";
import { handle, listViews, ready } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async (): Promise<ProjectsResponse> => {
    await ready();
    return { projects: await listViews() };
  });
}
