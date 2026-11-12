import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";

export const metadata: Metadata = {
  title: "Investor agent | SunShare",
};

export default function AgentPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Your investing agent"
          intro="Tell the agent what you want in plain words. It suggests solar cells to buy within the limits you set, and nothing is bought until you approve."
        />
      </div>
      <AgentWorkspace />
    </>
  );
}
