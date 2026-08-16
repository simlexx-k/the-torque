import type { Metadata } from "next";
import SignalFeedPage from "@/components/SignalFeedPage";

export const metadata: Metadata = {
  title: "Signals",
  description: "Raw captured seller posts and enrichment state for The Torque operators.",
  robots: { index: false, follow: false },
};

export default function SignalsPage() {
  return <SignalFeedPage />;
}
