export const SITE_NAME = "The Torque";
export const SITE_DESCRIPTION =
  "Browse current vehicle listings with seller photos, asking prices, key specifications, watchlists and side-by-side comparison tools.";

export function getSiteUrl() {
  const explicit = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}
