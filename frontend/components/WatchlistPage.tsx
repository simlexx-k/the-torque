"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, GitCompareArrows, Search, Trash2 } from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { useVehicleCollections } from "@/lib/useVehicleCollections";
import VehicleCard from "@/components/VehicleCard";

export default function WatchlistPage() {
  const { saved, clearSaved } = useVehicleCollections();
  const listingsQuery = useQuery({
    queryKey: ["listings", "watchlist"],
    queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=200"),
    refetchInterval: 60_000,
  });

  const watched = useMemo(() => (listingsQuery.data ?? []).filter((listing) => saved.includes(listing.id)), [listingsQuery.data, saved]);

  return (
    <main className="product-page watchlist-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>04</span> WATCHLIST</div>
          <h1>Your shortlist,<br/><em>kept in signal.</em></h1>
          <p>Save vehicles while browsing and return to a focused shortlist without creating an account.</p>
        </div>
        <div className="page-hero-stat"><Bookmark size={18}/><span><small>SAVED VEHICLES</small><strong>{saved.length.toString().padStart(2, "0")}</strong></span></div>
      </section>

      {saved.length > 0 && (
        <section className="collection-toolbar">
          <div><Bookmark size={16}/><span>{saved.length} saved locally in this browser</span></div>
          <div>
            <Link href="/compare" className="collection-link"><GitCompareArrows size={15}/> Open comparison</Link>
            <button type="button" onClick={clearSaved}><Trash2 size={15}/> Clear watchlist</button>
          </div>
        </section>
      )}

      {listingsQuery.isPending ? (
        <div className="vehicle-grid">{Array.from({ length: 4 }).map((_, index) => <div className="vehicle-card skeleton-card" key={index}><div/><span/><span/><span/></div>)}</div>
      ) : watched.length ? (
        <div className="vehicle-grid">{watched.map((listing, index) => <VehicleCard key={listing.id} listing={listing} index={index} />)}</div>
      ) : (
        <section className="product-state collection-empty-state">
          <div className="state-icon-orbit"><Bookmark size={24}/></div>
          <small>NO SAVED VEHICLES</small>
          <h2>Build a shortlist from the inventory.</h2>
          <p>Tap Save on any vehicle card. Your watchlist stays on this device and updates instantly.</p>
          <Link href="/inventory" className="product-primary-button"><Search size={16}/> Browse inventory</Link>
        </section>
      )}
    </main>
  );
}
