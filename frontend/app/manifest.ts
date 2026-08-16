import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Vehicle Listings`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f1114",
    theme_color: "#d7ff3f",
    categories: ["automotive", "shopping"],
    icons: [
      { src: "/icons/icon-192.jpg", sizes: "192x192", type: "image/jpeg" },
      { src: "/icons/icon-512.jpg", sizes: "512x512", type: "image/jpeg" },
      { src: "/icons/maskable-512.jpg", sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
    ],
  };
}
