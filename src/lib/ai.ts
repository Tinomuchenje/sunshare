// Language-model layer. Demo mode uses rule-based wording in each agent;
// live mode calls the Anthropic Messages API with fetch (Workers-safe).

import type { AiMode } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";

export class AiError extends Error {
  status = 502;
}

export function aiMode(): AiMode {
  return process.env.ANTHROPIC_API_KEY ? "live" : "demo";
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
  if (!key) throw new AiError("ANTHROPIC_API_KEY is not set.");

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
