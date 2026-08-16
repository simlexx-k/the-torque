"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { motion, useReducedMotion } from "motion/react";
import { Tooltip } from "radix-ui";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Gauge,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { confidenceToPercent, formatNumber, formatPrice, vehicleTitle } from "@/lib/format";

export default function ListingDetail({ id }: { id: string }) {
  const reduceMotion = useReducedMotion();
  const listingQuery = useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchJson<Listing>(`/api/torque/listings/${id}`),
  });
  const listing = listingQuery.data ?? null;
  const images = useMemo(
    () => listing?.post?.media?.map((item) => item.url || item.preview_image_url).filter(Boolean) as string[] || [],
    [listing],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: images.length > 1, align: "start", skipSnaps: false });
  const [selectedImage, setSelectedImage] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedImage(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit({ loop: images.length > 1, align: "start", skipSnaps: false });
    emblaApi.scrollTo(0, true);
    setSelectedImage(0);
  }, [emblaApi, images.length]);

  const copyListingLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Listing link copied.");
    } catch {
      toast.error("Could not copy the listing link.");
    }
  };

  if (listingQuery.isPending) {
    return <div className="detail-loading"><div className="state-radar"><span /></div><strong>Decoding vehicle intelligence…</strong></div>;
  }
  if (listingQuery.error || !listing) {
    return (
      <div className="detail-loading">
        <strong>{listingQuery.error instanceof Error ? listingQuery.error.message : "Listing unavailable."}</strong>
        <Link href="/">Return to inventory</Link>
      </div>
    );
  }

  const specs = [
    ["Year", listing.year],
    ["Body", listing.body_type],
    ["Fuel", listing.fuel],
    ["Engine", listing.engine_cc ? `${(listing.engine_cc / 1000).toFixed(1)}L / ${formatNumber(listing.engine_cc)} cc` : null],
    ["Transmission", listing.transmission],
    ["Drivetrain", listing.drivetrain],
    ["Colour", listing.colour],
    ["Generation", listing.generation],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  const evidenceEntries = Object.entries(listing.evidence || {});

  return (
    <main className="detail-shell">
      <header className="topbar detail-topbar">
        <Link href="/" className="brand">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy"><strong>THE TORQUE</strong><small>VEHICLE INTELLIGENCE</small></span>
        </Link>
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to live inventory</Link>
      </header>

      <motion.section
        className="detail-hero"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="detail-gallery enhanced-gallery">
          {images.length ? (
            <div className="embla-gallery">
              <div className="embla-viewport" ref={emblaRef}>
                <div className="embla-container">
                  {images.map((image, index) => (
                    <div className="embla-slide" key={`${image}-${index}`}>
                      <div className="detail-main-image">
                        <img src={image} alt={`${vehicleTitle(listing)} — frame ${index + 1}`} />
                        <div className="image-vignette" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <span className={`status-chip status-${listing.status.toLowerCase()}`}>{listing.status.replaceAll("_", " ")}</span>
              <div className="frame-index"><span>FRAME</span><strong>{String(selectedImage + 1).padStart(2, "0")}</strong><small>/ {String(images.length).padStart(2, "0")}</small></div>

              {images.length > 1 && (
                <div className="gallery-controls">
                  <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous vehicle image"><ChevronLeft size={19} /></button>
                  <button type="button" onClick={() => emblaApi?.scrollNext()} aria-label="Next vehicle image"><ChevronRight size={19} /></button>
                </div>
              )}
            </div>
          ) : (
            <div className="detail-main-image">
              <div className="vehicle-placeholder large"><span>THE TORQUE</span><div className="placeholder-orbit" /></div>
              <span className={`status-chip status-${listing.status.toLowerCase()}`}>{listing.status.replaceAll("_", " ")}</span>
            </div>
          )}

          {images.length > 1 && (
            <div className="thumbnail-strip enhanced-thumbnails">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  className={index === selectedImage ? "active" : ""}
                  onClick={() => emblaApi?.scrollTo(index)}
                  aria-label={`Show vehicle frame ${index + 1}`}
                  aria-current={index === selectedImage ? "true" : undefined}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-summary">
          <div className="section-kicker"><span>INTEL</span> LISTING #{String(listing.id).padStart(4, "0")}</div>
          <h1>{vehicleTitle(listing)}</h1>
          <p className="detail-price">{formatPrice(listing.price, listing.currency)}</p>
          <div className="detail-facts">
            <span><Gauge size={18}/><small>ODOMETER</small><strong>{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Not stated"}</strong></span>
            <span><MapPin size={18}/><small>LOCATION</small><strong>{listing.location || "Not stated"}</strong></span>
          </div>

          <div className="detail-description">
            <small>SOURCE DESCRIPTION</small>
            <p>{listing.post?.text || "No source description was stored for this record."}</p>
          </div>

          <div className="detail-source-actions">
            <a className="source-button" href={listing.x_url} target="_blank" rel="noreferrer">Open original X post <ExternalLink size={17}/></a>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button type="button" className="copy-link-button" onClick={copyListingLink} aria-label="Copy listing link"><Copy size={17}/></button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="torque-tooltip" sideOffset={8}>Copy this intelligence file link<Tooltip.Arrow className="torque-tooltip-arrow" /></Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
          <p className="source-disclaimer"><ShieldCheck size={16}/> Seller claims, AI observations and reference specifications are deliberately kept separate.</p>
        </div>
      </motion.section>

      <motion.section
        className="detail-grid-section"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
      >
        <div className="spec-panel">
          <div className="panel-title"><div><small>01 / MACHINE</small><h2>Vehicle specification</h2></div><span>STRUCTURED DATA</span></div>
          <div className="spec-grid">
            {specs.length ? specs.map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{String(value)}</strong></div>) : <p className="muted">No structured specifications have been resolved yet.</p>}
          </div>
        </div>

        <div className="evidence-panel">
          <div className="panel-title"><div><small>02 / PROVENANCE</small><h2>Evidence map</h2></div><Sparkles size={20}/></div>
          <div className="evidence-list">
            {evidenceEntries.length ? evidenceEntries.map(([key, raw]) => {
              const value = typeof raw === "object" && raw ? raw as Record<string, unknown> : { value: raw };
              const confidence = confidenceToPercent(value.confidence);
              const source = String(value.source || "unspecified").replaceAll("_", " ");
              return (
                <div className="evidence-row" key={key}>
                  <span><small>{key.replaceAll("_", " ")}</small><strong>{String(value.value ?? "Observed")}</strong></span>
                  <span className="evidence-meta">
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild><i className="evidence-source-chip" tabIndex={0}>{source}</i></Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="torque-tooltip" sideOffset={8}>Provenance: {source}<Tooltip.Arrow className="torque-tooltip-arrow" /></Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                    {confidence && <b>{confidence}</b>}
                  </span>
                </div>
              );
            }) : <p className="muted">The enrichment model has not attached field-level evidence to this listing yet.</p>}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="detail-grid-section secondary"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
      >
        <div className="spec-panel">
          <div className="panel-title"><div><small>03 / EQUIPMENT</small><h2>Detected features</h2></div><span>{listing.features?.length || 0} SIGNALS</span></div>
          <div className="feature-cloud">
            {listing.features?.length ? listing.features.map((feature, index) => <span key={`${feature.name || "feature"}-${index}`}>{String(feature.name || feature.value || "Feature")}</span>) : <p className="muted">No equipment features confidently identified.</p>}
          </div>
        </div>
        <div className="evidence-panel">
          <div className="panel-title"><div><small>04 / VISION</small><h2>Visual observations</h2></div><span>NON-DIAGNOSTIC</span></div>
          <ol className="observation-list">
            {listing.observations?.length ? listing.observations.map((observation, index) => <li key={index}><i>{String(index + 1).padStart(2, "0")}</i><span>{observation}</span></li>) : <li><i>—</i><span>No visual observations recorded.</span></li>}
          </ol>
        </div>
      </motion.section>

      <section className="detail-cta">
        <div><small>NEXT SIGNAL</small><h2>Return to the market feed.</h2><p>Compare this vehicle against every listing indexed by The Torque.</p></div>
        <Link className="primary-action" href="/">View live inventory <ArrowUpRight size={18}/></Link>
      </section>
    </main>
  );
}
