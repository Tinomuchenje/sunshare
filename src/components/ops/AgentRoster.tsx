import { AgentAvatar, agents, type AgentId } from "@/components/agent/agents";

const order: AgentId[] = ["vetting", "investor", "monitoring", "payout"];

/** The four agents and what each one does, in one line each. */
export function AgentRoster() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {order.map((id) => (
        <li key={id} className="flex gap-3 rounded-card border border-line bg-surface p-4">
          <AgentAvatar agent={id} />
          <div className="min-w-0">
            <p className="font-medium">{agents[id].name}</p>
            <p className="mt-0.5 text-sm text-muted">{agents[id].role}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
