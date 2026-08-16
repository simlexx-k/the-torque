import type { Listing } from "@/lib/types";

export function listingReference(listing: Pick<Listing, "id" | "public_id">): string {
  return listing.public_id || String(listing.id);
}

export function listingHref(listing: Pick<Listing, "id" | "public_id">): string {
  return `/listings/${encodeURIComponent(listingReference(listing))}`;
}

export function listingCollectionKeys(listing: Pick<Listing, "id" | "public_id">): string[] {
  const keys = [listing.public_id, String(listing.id)].filter(Boolean) as string[];
  return Array.from(new Set(keys));
}

export function listingCollectionKey(listing: Pick<Listing, "id" | "public_id">): string {
  return listing.public_id || String(listing.id);
}

export function listingShortReference(listing: Pick<Listing, "id" | "public_id">): string {
  if (listing.public_id) {
    return listing.public_id.slice(-6).toUpperCase();
  }
  return String(listing.id).padStart(4, "0");
}
