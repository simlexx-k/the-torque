import type { Metadata } from "next";
import ComparePage from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Compare Vehicles",
  description: "Compare up to four shortlisted vehicles side by side using asking price, mileage and available specifications.",
  alternates: { canonical: "/compare" },
};

export default function VehicleComparePage() {
  return <ComparePage />;
}
