import type { AgentExecuteRequest, AgentExecuteResponse } from "@/lib/api-types";
import { execute } from "@/lib/agents/investor";
import { ApiError, handle, readJson, ready, siteOrigin } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<AgentExecuteResponse> => {
    const { proposal } = await readJson<AgentExecuteRequest>(req);
    if (!proposal || typeof proposal !== "object") throw new ApiError(400, "Missing proposal.");
    await ready();
    return execute(proposal, siteOrigin(req));
  });
}
