import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import "./globals.css";
import "./detail.css";
import "./enhancements.css";
import "./product.css";
import "./signals.css";

export const metadata: Metadata = {
  title: {
    default: "The Torque — Vehicle Intelligence",
    template: "%s — The Torque",
  },
  description: "AI-assisted vehicle listing intelligence from live social-market signals.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
