import type { ProjectResponse } from "@/lib/api-types";
import { getView, handle, ready } from "@/lib/domain";
import { listReports } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  return handle(async (): Promise<ProjectResponse> => {
    const { id } = await ctx.params;
    await ready();
    const project = await getView(id);
    const reports = (await listReports(id)).sort((a, b) => b.month.localeCompare(a.month));
    return { project, reports };
  });
}
