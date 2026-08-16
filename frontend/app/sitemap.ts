import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/inventory`, lastModified: now, changeFrequency: "hourly", priority: 0.95 },
    { url: `${siteUrl}/market`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/watchlist`, lastModified: now, changeFrequency: "weekly", priority: 0.55 },
    { url: `${siteUrl}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.55 },
  ];
}
