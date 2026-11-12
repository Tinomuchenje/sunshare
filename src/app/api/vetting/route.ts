import type { VettingRequest, VettingResponse } from "@/lib/api-types";
import { handle, readJson, ready, requireProject, revet } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<VettingResponse> => {
    const { projectId } = await readJson<VettingRequest>(req);
    await requireProject(projectId);
    await ready();
    return revet(projectId as string);
  });
}
