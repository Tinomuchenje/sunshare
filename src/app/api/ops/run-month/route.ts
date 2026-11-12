import type { RunMonthRequest, RunMonthResponse } from "@/lib/api-types";
import { ApiError, handle, readJson, ready, requireProject, runMonth } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<RunMonthResponse> => {
    const { projectId, scenario = "normal" } = await readJson<RunMonthRequest>(req);
    if (scenario !== "normal" && scenario !== "underperform") {
      throw new ApiError(400, 'scenario must be "normal" or "underperform".');
    }
    await ready();
    return runMonth((await requireProject(projectId)).id, scenario);
  });
}
