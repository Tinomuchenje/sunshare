// Language-model layer. Demo mode uses rule-based wording in each agent;
// live mode calls a model with fetch (Workers-safe): Anthropic's Messages API
// when ANTHROPIC_API_KEY is set, otherwise OpenAI's Chat Completions API when
// OPENAI_API_KEY is set. Agents always speak the Anthropic message shape;
// the OpenAI path translates to and from it.

import type { AiMode } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export class AiError extends Error {
  status = 502;
}

export function aiMode(): AiMode {
  return process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? "live" : "demo";
}

export interface AiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type AiContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface AiMessage {
  role: "user" | "assistant";
  content: string | AiContentBlock[];
}

export interface AiResponse {
  content: AiContentBlock[];
  stop_reason: string;
}

/** One call to the Messages API. Throws AiError with Anthropic's own message on failure. */
export async function callClaude(req: {
  system: string;
  messages: AiMessage[];
  tools?: AiTool[];
  maxTokens?: number;
}): Promise<AiResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    if (process.env.OPENAI_API_KEY) return callOpenAi(req, process.env.OPENAI_API_KEY);
    throw new AiError("No AI key is set (ANTHROPIC_API_KEY or OPENAI_API_KEY).");
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: req.messages,
        ...(req.tools ? { tools: req.tools } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new AiError(`Could not reach the AI service: ${(e as Error).message}`);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error?.message ?? res.statusText;
    throw new AiError(`AI service error (${res.status}): ${detail}`);
  }
  return body as AiResponse;
}

type OpenAiMessage = Record<string, unknown>;

/** Anthropic-shaped messages -> OpenAI chat messages. */
function toOpenAiMessages(system: string, messages: AiMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const text = m.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (m.role === "assistant") {
      const calls = m.content.flatMap((b) =>
        b.type === "tool_use"
          ? [{ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }]
          : [],
      );
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      for (const b of m.content) {
        if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
      }
      if (text) out.push({ role: "user", content: text });
    }
  }
  return out;
}

/** One call to OpenAI Chat Completions, returned in the Anthropic response shape. */
async function callOpenAi(
  req: { system: string; messages: AiMessage[]; tools?: AiTool[]; maxTokens?: number },
  key: string,
): Promise<AiResponse> {
  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || OPENAI_DEFAULT_MODEL,
        max_completion_tokens: req.maxTokens ?? 1024,
        messages: toOpenAiMessages(req.system, req.messages),
        ...(req.tools
          ? {
              tools: req.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.input_schema },
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new AiError(`Could not reach the AI service: ${(e as Error).message}`);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error?.message ?? res.statusText;
    throw new AiError(`AI service error (${res.status}): ${detail}`);
  }

  const choice = body?.choices?.[0];
  const content: AiContentBlock[] = [];
  if (typeof choice?.message?.content === "string" && choice.message.content) {
    content.push({ type: "text", text: choice.message.content });
  }
  for (const call of choice?.message?.tool_calls ?? []) {
    let input: unknown = {};
    try {
      input = JSON.parse(call.function?.arguments || "{}");
    } catch {
      throw new AiError("The AI sent tool arguments that were not valid JSON.");
    }
    content.push({ type: "tool_use", id: call.id, name: call.function?.name, input });
  }
  return { content, stop_reason: choice?.finish_reason === "tool_calls" ? "tool_use" : "end_turn" };
}

export function textOf(res: AiResponse): string {
  return res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Asks for a JSON object and parses it. The prompt must describe the shape. */
export async function askJson<T>(system: string, prompt: string): Promise<T> {
  const res = await callClaude({
    system: `${system}\nReply with one JSON object only, no other text.`,
    messages: [{ role: "user", content: prompt }],
  });
  const text = textOf(res).replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError("The AI reply was not valid JSON.");
  }
}

/** House style for every model-written sentence shown in the UI. */
export const WRITING_STYLE =
  "Write in plain English for a first-time visitor: short sentences, no jargon, no hype, no exclamation marks. " +
  "Never present income as guaranteed; say it is estimated and depends on sunshine and usage. " +
  "Use only the figures you are given; do not calculate new numbers.";
