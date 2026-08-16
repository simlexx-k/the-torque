import type { Metadata } from "next";
import SignalFeedPage from "@/components/SignalFeedPage";

export const metadata: Metadata = {
  title: "Signals",
  description: "Raw captured X seller posts and their enrichment state.",
};

export default function SignalsPage() {
  return <SignalFeedPage />;
}
