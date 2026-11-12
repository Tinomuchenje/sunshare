import type { FastForwardRequest, FastForwardResponse } from "@/lib/api-types";
import { fastForward, handle, readJson, ready, requireProject } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<FastForwardResponse> => {
    const { projectId } = await readJson<FastForwardRequest>(req);
    await ready();
    return fastForward((await requireProject(projectId)).id);
  });
}
