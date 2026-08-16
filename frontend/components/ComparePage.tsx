"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CarFront, GitCompareArrows, Plus, Trash2, X } from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { formatNumber, formatPrice, vehicleTitle } from "@/lib/format";
import { useVehicleCollections } from "@/lib/useVehicleCollections";

const rows: { label: string; value: (listing: Listing) => string }[] = [
  { label: "Asking price", value: (listing) => formatPrice(listing.price, listing.currency) },
  { label: "Year", value: (listing) => listing.year ? String(listing.year) : "—" },
  { label: "Mileage", value: (listing) => listing.mileage_km ? `${formatNumber(listing.mileage_km)} km` : "—" },
  { label: "Engine", value: (listing) => listing.engine_cc ? `${formatNumber(listing.engine_cc)} cc` : "—" },
  { label: "Fuel", value: (listing) => listing.fuel || "—" },
  { label: "Transmission", value: (listing) => listing.transmission || "—" },
  { label: "Drivetrain", value: (listing) => listing.drivetrain || "—" },
  { label: "Body", value: (listing) => listing.body_type || "—" },
  { label: "Location", value: (listing) => listing.location || "—" },
  { label: "Status", value: (listing) => listing.status?.replaceAll("_", " ") || "—" },
];

export default function ComparePage() {
  const { compare, toggleCompare, clearCompare } = useVehicleCollections();
  const listingsQuery = useQuery({
    queryKey: ["listings", "compare"],
    queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=200"),
    refetchInterval: 60_000,
  });

  const selected = useMemo(() => compare.map((id) => (listingsQuery.data ?? []).find((listing) => listing.id === id)).filter(Boolean) as Listing[], [compare, listingsQuery.data]);

  return (
    <main className="product-page compare-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>05</span> COMPARE MACHINES</div>
          <h1>Put the claims<br/><em>side by side.</em></h1>
          <p>Compare up to four indexed vehicles using only the structured fields already captured from the seller signal.</p>
        </div>
        <div className="page-hero-stat"><GitCompareArrows size={18}/><span><small>COMPARISON SET</small><strong>{compare.length}/4</strong></span></div>
      </section>

      {selected.length > 0 ? (
        <>
          <section className="collection-toolbar">
            <div><GitCompareArrows size={16}/><span>{selected.length} vehicles selected</span></div>
            <div><Link href="/inventory" className="collection-link"><Plus size={15}/> Add vehicle</Link><button type="button" onClick={clearCompare}><Trash2 size={15}/> Clear comparison</button></div>
          </section>

          <section className="comparison-scroll" aria-label="Vehicle comparison table">
            <div className="comparison-table" style={{ gridTemplateColumns: `minmax(150px, .65fr) repeat(${selected.length}, minmax(230px, 1fr))` }}>
              <div className="comparison-corner"><small>SPECIFICATION</small><strong>Evidence matrix</strong></div>
              {selected.map((listing) => {
                const media = listing.post?.media?.[0];
                const image = media?.url || media?.preview_image_url;
                return (
                  <article className="compare-vehicle-head" key={listing.id}>
                    <button type="button" onClick={() => toggleCompare(listing.id)} aria-label={`Remove ${vehicleTitle(listing)} from comparison`}><X size={15}/></button>
                    {image ? <img src={image} alt={vehicleTitle(listing)} /> : <div className="compare-image-placeholder"><CarFront size={25}/></div>}
                    <small>#{String(listing.id).padStart(4, "0")}</small>
                    <strong>{vehicleTitle(listing)}</strong>
                    <span>{formatPrice(listing.price, listing.currency)}</span>
                    <Link href={`/listings/${listing.id}`}>Open intelligence file <ArrowUpRight size={14}/></Link>
                  </article>
                );
              })}

              {rows.flatMap((row) => [
                <div className="compare-row-label" key={`${row.label}-label`}>{row.label}</div>,
                ...selected.map((listing) => <div className="compare-cell" key={`${row.label}-${listing.id}`}>{row.value(listing)}</div>),
              ])}
            </div>
          </section>

          <section className="comparison-note"><small>COMPARISON LIMIT</small><p>This is a structured-listing comparison, not an inspection report. Missing fields remain missing rather than being inferred.</p></section>
        </>
      ) : (
        <section className="product-state collection-empty-state">
          <div className="state-icon-orbit"><GitCompareArrows size={24}/></div>
          <small>EMPTY COMPARISON</small>
          <h2>Select two to four vehicles.</h2>
          <p>Use Compare on any inventory card. Selected vehicles will appear here in a side-by-side evidence matrix.</p>
          <Link href="/inventory" className="product-primary-button"><Plus size={16}/> Add vehicles</Link>
        </section>
      )}
    </main>
  );
}
