// One identity per AI agent (name, role, icon), used on every screen that shows agent work.

import { Activity, Banknote, Bot, ShieldCheck, type LucideIcon } from "lucide-react";
import type { AgentStep } from "@/lib/api-types";

export type AgentId = AgentStep["agent"];

export const agents: Record<AgentId, { name: string; role: string; Icon: LucideIcon }> = {
  vetting: {
    name: "Vetting agent",
    role: "Checks sunlight, forecast and risks before a project is listed.",
    Icon: ShieldCheck,
  },
  monitoring: {
    name: "Monitoring agent",
    role: "Compares each month's metered output with the forecast.",
    Icon: Activity,
  },
  payout: {
    name: "Payout agent",
    role: "Works out each owner's share and pays it through PayPal.",
    Icon: Banknote,
  },
  investor: {
    name: "Investor agent",
    role: "Suggests cells to buy within your limits, and buys only when you approve.",
    Icon: Bot,
  },
};

const tones = {
  ok: "bg-green-soft text-green-dark",
  warning: "bg-warn-soft text-warn",
  error: "bg-bad-soft text-bad",
};

export function AgentAvatar({
  agent,
  status = "ok",
}: {
  agent: AgentId;
  status?: AgentStep["status"];
}) {
  const { Icon } = agents[agent];
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-full ${tones[status]}`}
      aria-hidden
    >
      <Icon className="size-4.5" strokeWidth={2} />
    </span>
  );
}
