import type { Metadata } from "next";
import { ApproveOrder } from "@/components/investor/ApproveOrder";

export const metadata: Metadata = { title: "Simulated payment step · SunShare" };

export default async function ApprovePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <ApproveOrder token={typeof token === "string" ? token : ""} />;
}
