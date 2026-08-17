"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Popover, Tooltip } from "radix-ui";
import {
  ArrowUpRight,
  Bookmark,
  Clock3,
  Gauge,
  GitCompareArrows,
  Images,
  MapPin,
  MoreHorizontal,
  Repeat2,
} from "lucide-react";
import { toast } from "sonner";
import type { Listing } from "@/lib/types";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { listingCollectionKey, listingHref, listingShortReference } from "@/lib/listingRef";
import { useVehicleCollections } from "@/lib/useVehicleCollections";

function clean(value?: string | null) {
  return value?.trim() || null;
}

function isFreshListing(listing: Listing) {
  const value = listing.created_at || listing.post?.created_at;
  if (!value) return false;
  const age = Date.now() - new Date(value).getTime();
  return Number.isFinite(age) && age >= 0 && age <= 24 * 60 * 60 * 1000;
}

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
  const fresh = isFreshListing(listing);
  const repost = Boolean(listing.market?.is_repost);

  const smartTags = [
    clean(listing.transmission),
    clean(listing.fuel),
    listing.engine_cc ? `${(listing.engine_cc / 1000).toFixed(1)}L` : null,
  ].filter(Boolean).slice(0, 2) as string[];

  const detailRows = [
    ["Year", listing.year ? String(listing.year) : null],
    ["Engine", listing.engine_cc ? `${formatNumber(listing.engine_cc)} cc` : null],
    ["Transmission", clean(listing.transmission)],
    ["Fuel", clean(listing.fuel)],
    ["Drivetrain", clean(listing.drivetrain)],
    ["Colour", clean(listing.colour)],
    ["Body style", clean(listing.body_type)],
    ["Generation", clean(listing.generation)],
  ].filter(([, value]) => Boolean(value)) as [string, string][];

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
      className="vehicle-card enhanced-vehicle-card smart-vehicle-card"
      layout
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.99 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : Math.min(index * 0.018, 0.15), ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
    >
      <div className="smart-card-media">
        <Link href={href} className="vehicle-image-wrap" aria-label={`Open ${vehicleTitle(listing)}`}>
          {image ? (
            <Image
              className="vehicle-image"
              src={image}
              alt={vehicleTitle(listing)}
              fill
              sizes="(max-width: 620px) 42vw, (max-width: 900px) 50vw, (max-width: 1280px) 33vw, 25vw"
              quality={72}
            />
          ) : (
            <div className="vehicle-placeholder" aria-hidden="true">
              <span>THE TORQUE</span>
              <div className="placeholder-orbit" />
            </div>
          )}
          <div className="image-vignette" />
        </Link>

        <span className={`status-chip status-${status}`}>{status.replaceAll("_", " ")}</span>
        {(fresh || repost) && (
          <div className="market-card-badges" aria-label="Listing intelligence">
            {fresh && <span><Clock3 size={11}/> New today</span>}
            {repost && <span><Repeat2 size={11}/> Reposted</span>}
          </div>
        )}

        {listing.post?.media && listing.post.media.length > 1 && (
          <span className="media-count"><Images size={12} /> {listing.post.media.length}</span>
        )}

        <div className="smart-card-actions" aria-label="Listing actions">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button type="button" className={saved ? "active" : ""} onClick={onSave} aria-pressed={saved} aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}>
                <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className="torque-tooltip" side="left" sideOffset={8}>{saved ? "Remove from watchlist" : "Save to watchlist"}<Tooltip.Arrow className="torque-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button type="button" className={compared ? "active" : ""} onClick={onCompare} aria-pressed={compared} aria-label={compared ? "Remove from comparison" : "Add to comparison"}>
                <GitCompareArrows size={15} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className="torque-tooltip" side="left" sideOffset={8}>{compared ? "Remove from comparison" : "Add to comparison"}<Tooltip.Arrow className="torque-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>

      <div className="vehicle-card-body">
        <div className="vehicle-eyebrow smart-card-eyebrow">
          <span>{listing.body_type || listing.generation || "Vehicle"}</span>
          <span className="mono">REF {listingShortReference(listing)}</span>
        </div>

        <div className="smart-card-title-row">
          <Link href={href} className="vehicle-name">{vehicleTitle(listing)}</Link>
          <Link href={href} className="smart-card-open" aria-label={`View ${vehicleTitle(listing)}`}><ArrowUpRight size={16} /></Link>
        </div>

        <div className="vehicle-price">{formatPrice(listing.price, listing.currency)}</div>

        <div className="smart-card-facts">
          <span title="Mileage"><Gauge size={14} />{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Mileage —"}</span>
          <span title="Location"><MapPin size={14} />{listing.location || "Location —"}</span>
        </div>

        <div className="smart-card-lower">
          <div className="smart-card-tags" aria-label="Key specifications">
            {smartTags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>

          <Popover.Root>
            <Popover.Trigger asChild>
              <button type="button" className="smart-spec-trigger" aria-label="Show more vehicle specifications">
                <MoreHorizontal size={16} />
                <span>{detailRows.length ? "Specs" : "Details"}</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="smart-spec-popover" side="top" align="end" sideOffset={8} collisionPadding={12}>
                <div className="smart-spec-heading">
                  <div><small>QUICK SPECS</small><strong>{vehicleTitle(listing)}</strong></div>
                  <span>REF {listingShortReference(listing)}</span>
                </div>
                {detailRows.length ? (
                  <dl className="smart-spec-grid">
                    {detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                  </dl>
                ) : (
                  <p className="smart-spec-empty">No additional specifications were stated for this listing.</p>
                )}
                <Link href={href} className="smart-spec-link">Open full listing <ArrowUpRight size={14} /></Link>
                <Popover.Arrow className="smart-spec-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </motion.article>
  );
}
