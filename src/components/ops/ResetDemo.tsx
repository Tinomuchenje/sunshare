"use client";

import { useState } from "react";
import type { ResetResponse } from "@/lib/api-types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

/** A quiet control that puts all data back to the sample state, with a confirm step. */
export function ResetDemo({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  const [stage, setStage] = useState<"idle" | "confirm" | "resetting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setStage("resetting");
    setError(null);
    try {
      await api<ResetResponse>("/api/demo/reset", {});
      setStage("idle");
      onReset();
    } catch (err) {
      setError((err as Error).message);
      setStage("confirm");
    }
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setStage("confirm")}
        className="min-h-11 rounded-full px-1 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reset demo data
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-sm" role="group" aria-label="Reset demo data">
      <p>
        This removes every purchase, month and payout made in this demo, and puts the sample
        projects back. It cannot be undone.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-bad">
          Could not reset: {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={stage === "resetting"}
          onClick={reset}
          className="min-h-11 rounded-full bg-bad px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-bad/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stage === "resetting" ? "Resetting" : "Yes, reset"}
        </button>
        <Button
          variant="secondary"
          className="min-h-11"
          disabled={stage === "resetting"}
          onClick={() => setStage("idle")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
