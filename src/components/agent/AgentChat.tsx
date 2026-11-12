"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import type { AgentChatResponse, AgentProposal, ChatMessage } from "@/lib/api-types";
import type { AiMode } from "@/lib/types";
import { api } from "@/lib/api";
import { AgentAvatar } from "./agents";
import { ProposalCard } from "./ProposalCard";

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; proposal?: AgentProposal; aiMode: AiMode };

const suggestions = [
  "Invest $50 in clinic solar in Zimbabwe",
  "Put $30 into whatever is closest to being fully funded",
  "What should I invest in?",
];

export function AgentChat({ onBought }: { onBought: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length === 0 && !pending && !error) return;
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, pending, error]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history: ChatMessage[] = [
      ...turns.map(({ role, content }) => ({ role, content })),
      { role: "user", content },
    ];
    setTurns((t) => [...t, { role: "user", content }]);
    setInput("");
    setError(null);
    setPending(true);
    try {
      const res = await api<AgentChatResponse>("/api/agent/chat", { messages: history });
      setTurns((t) => [
        ...t,
        { role: "assistant", content: res.reply, proposal: res.proposal, aiMode: res.aiMode },
      ]);
    } catch (err) {
      // Take the unsent message back out of the conversation and return it to the box.
      setTurns((t) => t.slice(0, -1));
      setInput((current) => current || content);
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <section aria-labelledby="chat-heading" className="mt-8">
      <h2 id="chat-heading" className="sr-only">
        Conversation with the investor agent
      </h2>

      <div role="log" aria-live="polite" className="space-y-5">
        <AssistantBubble>
          Tell me what you would like to invest in. I will suggest solar cells within your limits,
          and I will not buy anything until you approve.
        </AssistantBubble>

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-green px-4 py-2.5 text-white">
                {turn.content}
              </p>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              <AssistantBubble>
                {turn.content}
                <span className="mt-2 block text-xs text-muted">
                  {turn.aiMode === "live"
                    ? "Live AI reply. Prices and limits are checked in code."
                    : "Simulated reply. Rule-based, because no AI key is set."}
                </span>
              </AssistantBubble>
              {turn.proposal ? (
                <div className="sm:pl-12">
                  <ProposalCard proposal={turn.proposal} onBought={onBought} />
                </div>
              ) : null}
            </div>
          ),
        )}

        {pending ? (
          <AssistantBubble>
            <span className="sr-only">The agent is thinking</span>
            <span className="flex items-center gap-1.5 py-1.5" aria-hidden>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 rounded-full bg-muted motion-safe:animate-pulse"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </AssistantBubble>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-card border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
            <span className="font-medium">The agent could not reply.</span> {error}
            <span className="mt-1 block">Your message is back in the box below, so you can send it again.</span>
          </p>
        ) : null}
      </div>

      {turns.length === 0 && !pending ? (
        <div className="mt-5 flex flex-wrap gap-2 sm:pl-12">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="min-h-11 rounded-full border border-line bg-surface px-4 py-2 text-left text-sm transition-colors hover:border-green hover:text-green-dark"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 flex items-center gap-2">
        <label htmlFor="agent-input" className="sr-only">
          Message the investor agent
        </label>
        <input
          id="agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="For example: invest $40 in farm solar"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-surface px-5 text-base outline-none placeholder:text-muted/70 focus:border-green focus:ring-2 focus:ring-green/30"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Send"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-green text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </form>
      <div ref={endRef} />
    </section>
  );
}

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar agent="investor" />
      <div className="min-w-0 max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-2.5">
        {children}
      </div>
    </div>
  );
}
