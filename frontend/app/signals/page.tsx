import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SignalFeedPage from "@/components/SignalFeedPage";

export const metadata: Metadata = {
  title: "Signals",
  description: "Raw captured seller posts and enrichment state for The Torque operators.",
  robots: { index: false, follow: false },
};

export default function SignalsPage() {
  const enabled = process.env.NODE_ENV !== "production" || process.env.TORQUE_PUBLIC_OPERATOR_ROUTES === "true";
  if (!enabled) notFound();
  return <SignalFeedPage />;
}
