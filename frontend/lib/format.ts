export function formatPrice(value?: number | null, currency?: string | null) {
  if (!value) return "Price on request";
  const code = currency || "KES";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-KE").format(value);
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return "No signals yet";
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(delta / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function vehicleTitle(listing: { year?: number | null; make?: string | null; model?: string | null; variant?: string | null }) {
  return [listing.year, listing.make, listing.model, listing.variant].filter(Boolean).join(" ") || "Unidentified vehicle";
}

export function confidenceToPercent(value: unknown) {
  if (typeof value !== "number") return null;
  return `${Math.round(value * 100)}%`;
}
