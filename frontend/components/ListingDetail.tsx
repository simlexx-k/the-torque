"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { motion, useReducedMotion } from "motion/react";
import { Dialog, Tooltip } from "radix-ui";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Gauge,
  GitCompareArrows,
  MapPin,
  Maximize2,
  ShieldCheck,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { confidenceToPercent, formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { useVehicleCollections } from "@/lib/useVehicleCollections";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);
  const { isSaved, isCompared, toggleSaved, toggleCompare } = useVehicleCollections();

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

  const showImage = useCallback((index: number) => {
    if (!images.length) return;
    const next = (index + images.length) % images.length;
    setSelectedImage(next);
    emblaApi?.scrollTo(next);
    setLightboxZoomed(false);
  }, [emblaApi, images.length]);

  useEffect(() => {
    if (!lightboxOpen || images.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showImage(selectedImage - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showImage(selectedImage + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length, lightboxOpen, selectedImage, showImage]);

  const copyListingLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Listing link copied.");
    } catch {
      toast.error("Could not copy the listing link.");
    }
  };

  if (listingQuery.isPending) {
    return <div className="detail-loading"><div className="state-radar"><span /></div><strong>Loading vehicle details…</strong></div>;
  }
  if (listingQuery.error || !listing) {
    return (
      <div className="detail-loading">
        <strong>{listingQuery.error instanceof Error ? listingQuery.error.message : "This listing is unavailable."}</strong>
        <Link href="/inventory">Return to listings</Link>
      </div>
    );
  }

  const specs = [
    ["Year", listing.year],
    ["Body style", listing.body_type],
    ["Fuel", listing.fuel],
    ["Engine", listing.engine_cc ? `${(listing.engine_cc / 1000).toFixed(1)}L / ${formatNumber(listing.engine_cc)} cc` : null],
    ["Transmission", listing.transmission],
    ["Drivetrain", listing.drivetrain],
    ["Colour", listing.colour],
    ["Generation", listing.generation],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  const evidenceEntries = Object.entries(listing.evidence || {});
  const saved = isSaved(listing.id);
  const compared = isCompared(listing.id);

  const onSave = () => {
    const selected = toggleSaved(listing.id);
    toast(selected ? "Saved to your watchlist." : "Removed from your watchlist.");
  };

  const onCompare = () => {
    const result = toggleCompare(listing.id);
    if (result.full) {
      toast.error("You can compare up to four vehicles at a time.");
      return;
    }
    toast(result.selected ? "Added to comparison." : "Removed from comparison.");
  };

  return (
    <main className="detail-shell">
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
                        <img src={image} alt={`${vehicleTitle(listing)} — photo ${index + 1}`} />
                        <div className="image-vignette" />
                        <button type="button" className="gallery-expand" onClick={() => setLightboxOpen(true)} aria-label="Open photo gallery full screen">
                          <Maximize2 size={17}/><span>Full screen</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <span className={`status-chip status-${listing.status.toLowerCase()}`}>{listing.status.replaceAll("_", " ")}</span>
              <div className="frame-index"><span>PHOTO</span><strong>{String(selectedImage + 1).padStart(2, "0")}</strong><small>/ {String(images.length).padStart(2, "0")}</small></div>

              {images.length > 1 && (
                <div className="gallery-controls">
                  <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous vehicle photo"><ChevronLeft size={19} /></button>
                  <button type="button" onClick={() => emblaApi?.scrollNext()} aria-label="Next vehicle photo"><ChevronRight size={19} /></button>
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
                  onClick={() => showImage(index)}
                  aria-label={`Show vehicle photo ${index + 1}`}
                  aria-current={index === selectedImage ? "true" : undefined}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-summary">
          <Link href="/inventory" className="detail-back-link"><ArrowLeft size={15}/> Back to listings</Link>
          <div className="section-kicker"><span>LISTING</span> #{String(listing.id).padStart(4, "0")}</div>
          <h1>{vehicleTitle(listing)}</h1>
          <p className="detail-price">{formatPrice(listing.price, listing.currency)}</p>
          <div className="detail-facts">
            <span><Gauge size={18}/><small>MILEAGE</small><strong>{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Not stated"}</strong></span>
            <span><MapPin size={18}/><small>LOCATION</small><strong>{listing.location || "Not stated"}</strong></span>
          </div>

          <div className="detail-description">
            <small>SELLER POST</small>
            <p>{listing.post?.text || "No seller description was stored for this listing."}</p>
          </div>

          <div className="detail-collection-actions">
            <button type="button" className={saved ? "active" : ""} onClick={onSave} aria-pressed={saved}><Bookmark size={16} fill={saved ? "currentColor" : "none"}/>{saved ? "Saved" : "Save to watchlist"}</button>
            <button type="button" className={compared ? "active" : ""} onClick={onCompare} aria-pressed={compared}><GitCompareArrows size={16}/>{compared ? "Selected to compare" : "Add to comparison"}</button>
          </div>

          <div className="detail-source-actions">
            <a className="source-button" href={listing.x_url} target="_blank" rel="noreferrer">View original seller post <ExternalLink size={17}/></a>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button type="button" className="copy-link-button" onClick={copyListingLink} aria-label="Copy listing link"><Copy size={17}/></button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="torque-tooltip" sideOffset={8}>Copy listing link<Tooltip.Arrow className="torque-tooltip-arrow" /></Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
          <p className="source-disclaimer"><ShieldCheck size={16}/> Listing details may be incomplete or change after publication. Confirm price, availability, ownership and condition directly with the seller.</p>
        </div>
      </motion.section>

      <motion.section className="detail-grid-section" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduceMotion ? 0 : 0.45 }}>
        <div className="spec-panel">
          <div className="panel-title"><div><small>01 / SPECIFICATIONS</small><h2>Vehicle details</h2></div><span>FROM THIS LISTING</span></div>
          <div className="spec-grid">
            {specs.length ? specs.map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{String(value)}</strong></div>) : <p className="muted">No additional specifications are available yet.</p>}
          </div>
        </div>

        <div className="evidence-panel">
          <div className="panel-title"><div><small>02 / SOURCES</small><h2>Where the details came from</h2></div><Sparkles size={20}/></div>
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
                      <Tooltip.Portal><Tooltip.Content className="torque-tooltip" sideOffset={8}>Source: {source}<Tooltip.Arrow className="torque-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
                    </Tooltip.Root>
                    {confidence && <b>{confidence}</b>}
                  </span>
                </div>
              );
            }) : <p className="muted">No field-level source information is available for this listing yet.</p>}
          </div>
        </div>
      </motion.section>

      <motion.section className="detail-grid-section secondary" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduceMotion ? 0 : 0.45 }}>
        <div className="spec-panel">
          <div className="panel-title"><div><small>03 / FEATURES</small><h2>Listed or observed features</h2></div><span>{listing.features?.length || 0} ITEMS</span></div>
          <div className="feature-cloud">
            {listing.features?.length ? listing.features.map((feature, index) => <span key={`${feature.name || "feature"}-${index}`}>{String(feature.name || feature.value || "Feature")}</span>) : <p className="muted">No additional features were identified.</p>}
          </div>
        </div>
        <div className="evidence-panel">
          <div className="panel-title"><div><small>04 / PHOTOS</small><h2>Photo observations</h2></div><span>NOT AN INSPECTION</span></div>
          <ol className="observation-list">
            {listing.observations?.length ? listing.observations.map((observation, index) => <li key={index}><i>{String(index + 1).padStart(2, "0")}</i><span>{observation}</span></li>) : <li><i>—</i><span>No photo observations recorded.</span></li>}
          </ol>
        </div>
      </motion.section>

      <section className="detail-cta">
        <div><small>KEEP BROWSING</small><h2>See the rest of the current listings.</h2><p>Shortlist another vehicle or add a few cars to Compare.</p></div>
        <Link className="primary-action" href="/inventory">Browse listings <ArrowUpRight size={18}/></Link>
      </section>

      {images.length > 0 && (
        <Dialog.Root open={lightboxOpen} onOpenChange={(open) => { setLightboxOpen(open); if (!open) setLightboxZoomed(false); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="gallery-lightbox-overlay" />
            <Dialog.Content className="gallery-lightbox" aria-describedby={undefined}>
              <Dialog.Title className="sr-only">{vehicleTitle(listing)} photo gallery</Dialog.Title>
              <div className="gallery-lightbox-topbar">
                <div><strong>{vehicleTitle(listing)}</strong><span>{selectedImage + 1} of {images.length}</span></div>
                <div>
                  <button type="button" onClick={() => setLightboxZoomed((value) => !value)} aria-label={lightboxZoomed ? "Zoom out" : "Zoom in"}>{lightboxZoomed ? <ZoomOut size={18}/> : <ZoomIn size={18}/>}</button>
                  <Dialog.Close asChild><button type="button" aria-label="Close full-screen gallery"><X size={19}/></button></Dialog.Close>
                </div>
              </div>

              <button type="button" className={`gallery-lightbox-stage ${lightboxZoomed ? "zoomed" : ""}`} onClick={() => setLightboxZoomed((value) => !value)} aria-label={lightboxZoomed ? "Zoom photo out" : "Zoom photo in"}>
                <img src={images[selectedImage]} alt={`${vehicleTitle(listing)} — photo ${selectedImage + 1}`} />
              </button>

              {images.length > 1 && (
                <>
                  <button type="button" className="gallery-lightbox-nav prev" onClick={() => showImage(selectedImage - 1)} aria-label="Previous photo"><ChevronLeft size={25}/></button>
                  <button type="button" className="gallery-lightbox-nav next" onClick={() => showImage(selectedImage + 1)} aria-label="Next photo"><ChevronRight size={25}/></button>
                  <div className="gallery-lightbox-thumbs">
                    {images.map((image, index) => <button type="button" key={`${image}-lightbox-${index}`} className={selectedImage === index ? "active" : ""} onClick={() => showImage(index)} aria-label={`Show photo ${index + 1}`}><img src={image} alt=""/></button>)}
                  </div>
                </>
              )}
              <div className="gallery-lightbox-hint">Use ← → to change photos · click the image to zoom</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </main>
  );
}
