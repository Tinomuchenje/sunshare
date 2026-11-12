"use client";

import { useEffect, useState } from "react";
import type { StatusResponse } from "@/lib/api-types";

/** Says honestly whether PayPal and the AI are real or simulated right now. */
export function ModeNote() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const paypal =
    status.paypalMode === "sandbox" ? "PayPal sandbox" : "PayPal simulated";
  const ai = status.aiMode === "live" ? "AI live" : "AI simulated";

  return (
    <p className="flex items-center gap-2">
      <span
        className={`size-2 rounded-full ${
          status.paypalMode === "sandbox" && status.aiMode === "live"
            ? "bg-green"
            : "bg-sun"
        }`}
        aria-hidden
      />
      {paypal} · {ai}
    </p>
  );
}
