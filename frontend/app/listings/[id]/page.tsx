import type { Metadata } from "next";
import ListingDetail from "@/components/ListingDetail";
import type { Listing } from "@/lib/types";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { SITE_DESCRIPTION } from "@/lib/site";

async function fetchListingForMetadata(id: string): Promise<Listing | null> {
  const baseUrl = (process.env.TORQUE_API_BASE_URL || process.env.TORQUE_API_INTERNAL_URL)?.replace(/\/+$/, "");
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/api/listings/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as Listing;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const canonical = `/listings/${id}`;
  const listing = await fetchListingForMetadata(id);

  if (!listing) {
    return {
      title: `Vehicle listing #${id}`,
      description: SITE_DESCRIPTION,
      alternates: { canonical },
    };
  }

  const title = vehicleTitle(listing);
  const description = [
    formatPrice(listing.price, listing.currency),
    listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : null,
    listing.location,
    "Seller photos and vehicle details on The Torque.",
  ]
    .filter(Boolean)
    .join(" · ");
  const image = listing.post?.media?.map((item) => item.url || item.preview_image_url).find(Boolean) || undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${title} | The Torque`,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | The Torque`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingDetail id={id} />;
}
