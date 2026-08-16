import type { Metadata } from "next";
import WatchlistPage from "@/components/WatchlistPage";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Keep a local shortlist of vehicles you want to revisit while browsing The Torque.",
  alternates: { canonical: "/watchlist" },
};

export default function SavedVehiclesPage() {
  return <WatchlistPage />;
}
