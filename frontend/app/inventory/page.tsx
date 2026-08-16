import type { Metadata } from "next";
import InventoryExplorer from "@/components/InventoryExplorer";

export const metadata: Metadata = {
  title: "Vehicle Listings",
  description: "Browse current vehicle listings with seller photos, asking prices, mileage, specifications and location details.",
  alternates: { canonical: "/inventory" },
};

export default function InventoryPage() {
  return <InventoryExplorer />;
}
