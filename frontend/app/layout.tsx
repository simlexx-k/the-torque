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
import "./footer.css";
import "./gallery.css";

export const metadata: Metadata = {
  title: {
    default: "The Torque — Vehicle Listings",
    template: "%s — The Torque",
  },
  description: "Browse current vehicle listings with seller photos, asking prices and key specifications in one place.",
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
