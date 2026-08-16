"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Bookmark, Gauge, GitCompareArrows, Images, MapPin, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { Listing } from "@/lib/types";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { listingCollectionKey, listingHref, listingShortReference } from "@/lib/listingRef";
import { useVehicleCollections } from "@/lib/useVehicleCollections";

export default function VehicleCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const media = listing.post?.media?.[0];
  const image = media?.url || media?.preview_image_url;
  const status = (listing.status || "available").toLowerCase();
  const reduceMotion = useReducedMotion();
  const collectionKey = listingCollectionKey(listing);
  const href = listingHref(listing);
  const { isSaved, isCompared, toggleSaved, toggleCompare } = useVehicleCollections();
  const saved = isSaved(collectionKey, listing.id);
  const compared = isCompared(collectionKey, listing.id);

  const onSave = () => {
    const selected = toggleSaved(collectionKey, listing.id);
    toast(selected ? "Saved to your watchlist." : "Removed from your watchlist.");
  };

  const onCompare = () => {
    const result = toggleCompare(collectionKey, listing.id);
    if (result.full) {
      toast.error("You can compare up to four vehicles at a time.");
      return;
    }
    toast(result.selected ? "Added to comparison." : "Removed from comparison.");
  };

  return (
    <motion.article
      className="vehicle-card enhanced-vehicle-card"
      layout
      initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.34, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.2), ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
    >
      <Link href={href} className="vehicle-image-wrap" aria-label={vehicleTitle(listing)}>
        {image ? (
          <motion.img
            className="vehicle-image"
            src={image}
            alt={vehicleTitle(listing)}
            loading="lazy"
            whileHover={reduceMotion ? undefined : { scale: 1.035 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <div className="vehicle-placeholder" aria-hidden="true">
            <span>THE TORQUE</span>
            <div className="placeholder-orbit" />
          </div>
        )}
        <div className="image-vignette" />
        <span className={`status-chip status-${status}`}>{status.replaceAll("_", " ")}</span>
        {listing.post?.media && listing.post.media.length > 1 && (
          <span className="media-count"><Images size={13} /> {listing.post.media.length} photos</span>
        )}
      </Link>

      <div className="vehicle-card-body">
        <div className="vehicle-eyebrow">
          <span>{listing.body_type || listing.generation || "Vehicle"}</span>
          <span className="mono">REF {listingShortReference(listing)}</span>
        </div>
        <Link href={href} className="vehicle-name">{vehicleTitle(listing)}</Link>
        <div className="vehicle-price">{formatPrice(listing.price, listing.currency)}</div>

        <div className="vehicle-facts">
          <span><Gauge size={16} />{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Mileage not stated"}</span>
          <span><MapPin size={16} />{listing.location || "Location not stated"}</span>
        </div>

        <div className="vehicle-tags">
          {[listing.fuel, listing.transmission, listing.drivetrain, listing.engine_cc ? `${(listing.engine_cc / 1000).toFixed(1)}L` : null]
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => <span key={String(tag)}><Settings2 size={12} />{tag}</span>)}
        </div>

        <div className="vehicle-card-footer">
          <div className="vehicle-collection-actions">
            <button type="button" className={saved ? "active" : ""} onClick={onSave} aria-pressed={saved} title="Save to watchlist">
              <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
              <span>{saved ? "Saved" : "Save"}</span>
            </button>
            <button type="button" className={compared ? "active" : ""} onClick={onCompare} aria-pressed={compared} title="Add to comparison">
              <GitCompareArrows size={15} />
              <span>{compared ? "Selected" : "Compare"}</span>
            </button>
          </div>
          <Link className="card-link" href={href}>
            View listing <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
