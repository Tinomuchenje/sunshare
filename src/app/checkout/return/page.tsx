import type { Metadata } from "next";
import { CheckoutResult } from "@/components/investor/CheckoutResult";

export const metadata: Metadata = { title: "Payment · SunShare" };

export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <CheckoutResult token={typeof token === "string" ? token : ""} />;
}
