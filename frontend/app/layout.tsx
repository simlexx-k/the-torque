import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import "./globals.css";
import "./detail.css";
import "./enhancements.css";

export const metadata: Metadata = {
  title: "The Torque — Vehicle Intelligence",
  description: "AI-assisted vehicle listing intelligence from live social-market signals.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
