import type { Metadata } from "next";
import MarketIntelligencePage from "@/components/MarketIntelligencePage";

export const metadata: Metadata = {
  title: "Market Snapshot",
  description: "Explore current asking-price, mileage, make and body-style patterns across vehicles listed on The Torque.",
  alternates: { canonical: "/market" },
};

export default function MarketPage() {
  return <MarketIntelligencePage />;
}
