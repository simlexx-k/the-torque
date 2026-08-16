import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import "./globals.css";
import "./detail.css";
import "./enhancements.css";
import "./product.css";
import "./signals.css";
import "./home.css";

export const metadata: Metadata = {
  title: {
    default: "The Torque — Vehicle Listings",
    template: "%s — The Torque",
  },
  description: "Browse current vehicle listings with seller photos, structured specifications and source-linked details.",
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
