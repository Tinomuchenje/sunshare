import type { AgentChatRequest, AgentChatResponse } from "@/lib/api-types";
import { aiMode } from "@/lib/ai";
import { chat } from "@/lib/agents/investor";
import { ApiError, handle, readJson, ready } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<AgentChatResponse> => {
    const { messages } = await readJson<AgentChatRequest>(req);
    const valid =
      Array.isArray(messages) &&
      messages.length > 0 &&
      messages.every(
        (m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string",
      );
    if (!valid) throw new ApiError(400, "messages must be a non-empty list of { role, content }.");
    await ready();
    return { ...(await chat(messages)), aiMode: aiMode() };
  });
}
