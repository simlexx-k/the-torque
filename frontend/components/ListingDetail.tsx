"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { confidenceToPercent, formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { ArrowIcon, ExternalIcon, PinIcon, RoadIcon, ShieldIcon, SparkIcon } from "./Icons";

export default function ListingDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch(`/api/torque/listings/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "Listing not found." : "Unable to load listing intelligence.");
        setListing(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load listing.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const images = useMemo(() => listing?.post?.media?.map((item) => item.url || item.preview_image_url).filter(Boolean) as string[] || [], [listing]);

  if (loading) return <div className="detail-loading"><div className="state-radar"><span /></div><strong>Decoding vehicle intelligence…</strong></div>;
  if (error || !listing) return <div className="detail-loading"><strong>{error || "Listing unavailable."}</strong><Link href="/">Return to inventory</Link></div>;

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
        <Link href="/" className="brand"><span className="brand-mark"><span /></span><span className="brand-copy"><strong>THE TORQUE</strong><small>VEHICLE INTELLIGENCE</small></span></Link>
        <Link href="/" className="back-link">← Back to live inventory</Link>
      </header>

      <section className="detail-hero">
        <div className="detail-gallery">
          <div className="detail-main-image">
            {images[activeImage] ? <img src={images[activeImage]} alt={vehicleTitle(listing)} /> : <div className="vehicle-placeholder large"><span>THE TORQUE</span><div className="placeholder-orbit" /></div>}
            <div className="image-vignette" />
            <span className={`status-chip status-${listing.status.toLowerCase()}`}>{listing.status.replaceAll("_", " ")}</span>
            <div className="frame-index"><span>FRAME</span><strong>{String(activeImage + 1).padStart(2, "0")}</strong><small>/ {String(Math.max(images.length, 1)).padStart(2, "0")}</small></div>
          </div>
          {images.length > 1 && <div className="thumbnail-strip">{images.map((image, index) => <button key={`${image}-${index}`} className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)}><img src={image} alt={`Vehicle frame ${index + 1}`} /></button>)}</div>}
        </div>

        <div className="detail-summary">
          <div className="section-kicker"><span>INTEL</span> LISTING #{String(listing.id).padStart(4, "0")}</div>
          <h1>{vehicleTitle(listing)}</h1>
          <p className="detail-price">{formatPrice(listing.price, listing.currency)}</p>
          <div className="detail-facts">
            <span><RoadIcon size={18}/><small>ODOMETER</small><strong>{listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "Not stated"}</strong></span>
            <span><PinIcon size={18}/><small>LOCATION</small><strong>{listing.location || "Not stated"}</strong></span>
          </div>

          <div className="detail-description">
            <small>SOURCE DESCRIPTION</small>
            <p>{listing.post?.text || "No source description was stored for this record."}</p>
          </div>

          <a className="source-button" href={listing.x_url} target="_blank" rel="noreferrer">Open original X post <ExternalIcon size={17}/></a>
          <p className="source-disclaimer"><ShieldIcon size={16}/> Seller claims, AI observations and reference specifications are deliberately kept separate.</p>
        </div>
      </section>

      <section className="detail-grid-section">
        <div className="spec-panel">
          <div className="panel-title"><div><small>01 / MACHINE</small><h2>Vehicle specification</h2></div><span>STRUCTURED DATA</span></div>
          <div className="spec-grid">
            {specs.length ? specs.map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{String(value)}</strong></div>) : <p className="muted">No structured specifications have been resolved yet.</p>}
          </div>
        </div>

        <div className="evidence-panel">
          <div className="panel-title"><div><small>02 / PROVENANCE</small><h2>Evidence map</h2></div><SparkIcon size={20}/></div>
          <div className="evidence-list">
            {evidenceEntries.length ? evidenceEntries.map(([key, raw]) => {
              const value = typeof raw === "object" && raw ? raw as Record<string, unknown> : { value: raw };
              const confidence = confidenceToPercent(value.confidence);
              return <div className="evidence-row" key={key}><span><small>{key.replaceAll("_", " ")}</small><strong>{String(value.value ?? "Observed")}</strong></span><span className="evidence-meta"><i>{String(value.source || "unspecified").replaceAll("_", " ")}</i>{confidence && <b>{confidence}</b>}</span></div>;
            }) : <p className="muted">The enrichment model has not attached field-level evidence to this listing yet.</p>}
          </div>
        </div>
      </section>

      <section className="detail-grid-section secondary">
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
      </section>

      <section className="detail-cta">
        <div><small>NEXT SIGNAL</small><h2>Return to the market feed.</h2><p>Compare this vehicle against every listing indexed by The Torque.</p></div>
        <Link className="primary-action" href="/">View live inventory <ArrowIcon size={18}/></Link>
      </section>
    </main>
  );
}
