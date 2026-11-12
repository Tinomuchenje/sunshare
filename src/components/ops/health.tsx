import type { PlantHealth } from "@/lib/types";
import { Badge } from "@/components/ui";

const health: Record<PlantHealth, { label: string; tone: "green" | "warn" | "bad" }> = {
  healthy: { label: "Healthy", tone: "green" },
  watch: { label: "Watch", tone: "warn" },
  underperforming: { label: "Underperforming", tone: "bad" },
};

export function HealthBadge({ value }: { value: PlantHealth }) {
  return <Badge tone={health[value].tone}>{health[value].label}</Badge>;
}
