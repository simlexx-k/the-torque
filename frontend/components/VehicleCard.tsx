import Link from "next/link";
import type { CSSProperties } from "react";
import type { Listing } from "@/lib/types";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { ArrowIcon, PinIcon, RoadIcon } from "./Icons";

export default function VehicleCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const media = listing.post?.media?.[0];
  const image = media?.url || media?.preview_image_url;
  const status = (listing.status || "available").toLowerCase();

  return (
    <article className="vehicle-card" style={{ "--card-index": index } as CSSProperties}>
      <Link href={`/listings/${listing.id}`} className="vehicle-image-wrap" aria-label={vehicleTitle(listing)}>
        {image ? (
          <img className="vehicle-image" src={image} alt={vehicleTitle(listing)} loading="lazy" />
        ) : (
          <div className="vehicle-placeholder" aria-hidden="true">
            <span>THE TORQUE</span>
            <div className="placeholder-orbit" />
          </div>
        )}
        <div className="image-vignette" />
        <span className={`status-chip status-${status}`}>{status.replaceAll("_", " ")}</span>
        {listing.post?.media && listing.post.media.length > 1 && (
          <span className="media-count">{listing.post.media.length.toString().padStart(2, "0")} frames</span>
        )}
      </Link>

      <div className="vehicle-card-body">
        <div className="vehicle-eyebrow">
          <span>{listing.body_type || listing.generation || "Vehicle signal"}</span>
          <span className="mono">#{String(listing.id).padStart(4, "0")}</span>
        </div>
        <Link href={`/listings/${listing.id}`} className="vehicle-name">{vehicleTitle(listing)}</Link>
        <div className="vehicle-price">{formatPrice(listing.price, listing.currency)}</div>

        <div className="vehicle-facts">
          <span><RoadIcon size={16} />{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Mileage n/a"}</span>
          <span><PinIcon size={16} />{listing.location || "Location n/a"}</span>
        </div>

        <div className="vehicle-tags">
          {[listing.fuel, listing.transmission, listing.drivetrain, listing.engine_cc ? `${(listing.engine_cc / 1000).toFixed(1)}L` : null]
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => <span key={String(tag)}>{tag}</span>)}
        </div>

        <Link className="card-link" href={`/listings/${listing.id}`}>
          Open intelligence file <ArrowIcon size={17} />
        </Link>
      </div>
    </article>
  );
}
