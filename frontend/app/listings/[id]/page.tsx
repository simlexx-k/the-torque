import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import ListingDetail from "@/components/ListingDetail";
import ListingHistoryPanel from "@/components/ListingHistoryPanel";
import type { Listing } from "@/lib/types";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { SITE_DESCRIPTION } from "@/lib/site";

const PUBLIC_LISTING_RE = /^lst_[A-Za-z0-9_-]{22}$/;
const LEGACY_LISTING_RE = /^[1-9][0-9]{0,17}$/;

function validListingReference(value: string) {
  return PUBLIC_LISTING_RE.test(value) || LEGACY_LISTING_RE.test(value);
}

function backendHeaders() {
  const headers = new Headers({ Accept: "application/json" });
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (clientId && clientSecret) {
    headers.set("CF-Access-Client-Id", clientId);
    headers.set("CF-Access-Client-Secret", clientSecret);
  }
  return headers;
}

const fetchListingForMetadata = cache(async (id: string): Promise<Listing | null> => {
  if (!validListingReference(id)) return null;
  const baseUrl = (process.env.TORQUE_API_BASE_URL || process.env.TORQUE_API_INTERNAL_URL)?.replace(/\/+$/, "");
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/api/listings/${encodeURIComponent(id)}`, {
      headers: backendHeaders(),
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as Listing;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListingForMetadata(id);

  if (!listing) {
    return {
      title: "Vehicle listing",
      description: SITE_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }

  const publicRef = listing.public_id || id;
  const canonical = `/listings/${publicRef}`;
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

  if (!validListingReference(id)) {
    notFound();
  }

  if (LEGACY_LISTING_RE.test(id)) {
    const listing = await fetchListingForMetadata(id);
    if (listing?.public_id) {
      redirect(`/listings/${listing.public_id}`);
    }
  }

  return (
    <>
      <ListingDetail id={id} />
      <ListingHistoryPanel id={id} />
    </>
  );
}
