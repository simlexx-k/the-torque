import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SystemPage from "@/components/SystemPage";

export const metadata: Metadata = {
  title: "System",
  robots: { index: false, follow: false },
};

export default function OperationsPage() {
  const enabled = process.env.NODE_ENV !== "production" || process.env.TORQUE_PUBLIC_OPERATOR_ROUTES === "true";
  if (!enabled) notFound();
  return <SystemPage />;
}
