import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { OperationsView } from "@/components/ops/OperationsView";

export const metadata: Metadata = {
  title: "Operations | SunShare",
};

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        intro="Behind the scenes. Run a month at a solar plant and watch the agents check the meter readings and pay every owner through PayPal."
      />
      <OperationsView />
    </>
  );
}
