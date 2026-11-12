import type { Metadata } from "next";
import { Portfolio } from "@/components/investor/Portfolio";

export const metadata: Metadata = { title: "Your portfolio · SunShare" };

export default function PortfolioPage() {
  return <Portfolio />;
}
