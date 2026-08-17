import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import "./globals.css";
import "./detail.css";
import "./enhancements.css";
import "./product.css";
import "./signals.css";
import "./home.css";
import "./footer.css";
import "./gallery.css";
import "./brand.css";
import "./cards.css";
import "./theme.css";
import "./theme-coverage.css";

const siteUrl = getSiteUrl();
const ADSENSE_CLIENT = "ca-pub-5456473575052681";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: "The Torque — Vehicle Listings",
    template: "%s | The Torque",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "vehicle listings",
    "cars for sale",
    "used cars",
    "Kenya vehicle listings",
    "car prices",
    "vehicle comparison",
    "seller photos",
    "The Torque",
    "A3S Labs",
  ],
  authors: [{ name: "A3S Labs" }],
  creator: "A3S Labs",
  publisher: "A3S Labs",
  category: "automotive",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "The Torque — Vehicle Listings",
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_KE",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Torque — Vehicle Listings",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  other: {
    "google-adsense-account": ADSENSE_CLIENT,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#f3f2ed",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
