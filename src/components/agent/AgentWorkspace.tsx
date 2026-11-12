"use client";

import { useCallback, useEffect, useState } from "react";
import type { MandateResponse } from "@/lib/api-types";
import { api } from "@/lib/api";
import { AgentChat } from "./AgentChat";
import { MandateCard } from "./MandateCard";

export function AgentWorkspace() {
  const [mandate, setMandate] = useState<MandateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMandate = useCallback(() => {
    api<MandateResponse>("/api/agent/mandate")
      .then((data) => {
        setMandate(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(loadMandate, [loadMandate]);

  return (
    <div className="mx-auto max-w-3xl">
      <MandateCard data={mandate} error={error} onRetry={loadMandate} onSaved={setMandate} />
      <AgentChat onBought={loadMandate} />
    </div>
  );
}
