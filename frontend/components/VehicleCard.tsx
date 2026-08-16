"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Gauge, Images, MapPin, Settings2 } from "lucide-react";
import type { Listing } from "@/lib/types";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";

export default function VehicleCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const media = listing.post?.media?.[0];
  const image = media?.url || media?.preview_image_url;
  const status = (listing.status || "available").toLowerCase();
  const reduceMotion = useReducedMotion();

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
      <Link href={`/listings/${listing.id}`} className="vehicle-image-wrap" aria-label={vehicleTitle(listing)}>
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
          <span className="media-count"><Images size={13} /> {listing.post.media.length.toString().padStart(2, "0")} frames</span>
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
          <span><Gauge size={16} />{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Mileage n/a"}</span>
          <span><MapPin size={16} />{listing.location || "Location n/a"}</span>
        </div>

        <div className="vehicle-tags">
          {[listing.fuel, listing.transmission, listing.drivetrain, listing.engine_cc ? `${(listing.engine_cc / 1000).toFixed(1)}L` : null]
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => <span key={String(tag)}><Settings2 size={12} />{tag}</span>)}
        </div>

        <Link className="card-link" href={`/listings/${listing.id}`}>
          Open intelligence file <ArrowUpRight size={17} />
        </Link>
      </div>
    </motion.article>
  );
}
