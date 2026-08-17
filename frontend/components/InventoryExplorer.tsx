"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Filter, LayoutGrid, ListFilter, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { listingCollectionKey } from "@/lib/listingRef";
import VehicleCard from "@/components/VehicleCard";

const statusOptions = ["all", "available", "reserved", "sold", "price_drop"] as const;
const sortOptions = ["latest", "price-high", "price-low", "year", "mileage"] as const;

const inventorySearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(statusOptions).withDefault("all"),
  make: parseAsString.withDefault("all"),
  body: parseAsString.withDefault("all"),
  sort: parseAsStringLiteral(sortOptions).withDefault("latest"),
};

export default function InventoryExplorer() {
  const [{ q: query, status, make, body, sort }, setFilters] = useQueryStates(inventorySearchParams, {
    history: "replace",
    shallow: true,
  });

  const listingsQuery = useQuery({
    queryKey: ["listings", "inventory"],
    queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=200"),
    refetchInterval: 60_000,
  });

  const listings = listingsQuery.data ?? [];
  const makes = useMemo(() => Array.from(new Set(listings.map((item) => item.make).filter(Boolean) as string[])).sort(), [listings]);
  const bodies = useMemo(() => Array.from(new Set(listings.map((item) => item.body_type).filter(Boolean) as string[])).sort(), [listings]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = listings.filter((listing) => {
      const haystack = [listing.year, listing.make, listing.model, listing.variant, listing.generation, listing.location, listing.body_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (status === "all" || listing.status.toLowerCase() === status) &&
        (make === "all" || listing.make === make) &&
        (body === "all" || listing.body_type === body)
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "price-high") return (b.price || 0) - (a.price || 0);
      if (sort === "price-low") return (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER);
      if (sort === "year") return (b.year || 0) - (a.year || 0);
      if (sort === "mileage") return (a.mileage_km || Number.MAX_SAFE_INTEGER) - (b.mileage_km || Number.MAX_SAFE_INTEGER);
      return new Date(b.created_at || b.post?.created_at || 0).getTime() - new Date(a.created_at || a.post?.created_at || 0).getTime();
    });
  }, [listings, query, status, make, body, sort]);

  const activeFilters = [query, status !== "all" ? status : "", make !== "all" ? make : "", body !== "all" ? body : "", sort !== "latest" ? sort : ""].filter(Boolean).length;

  const reset = () => setFilters({ q: null, status: null, make: null, body: null, sort: null });

  return (
    <main className="product-page inventory-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>02</span> ALL LISTINGS</div>
          <h1>Search the full line-up.<br/><em>Filter by what matters.</em></h1>
          <p>Narrow the current listings by make, body style and availability, then open any vehicle for its photos, seller post and recorded details.</p>
        </div>
        <div className="page-hero-stat">
          <Sparkles size={18} />
          <span><small>MATCHING VEHICLES</small><strong>{filtered.length.toString().padStart(2, "0")}</strong></span>
        </div>
      </section>

      <section className="inventory-workbench">
        <div className="workbench-title-row">
          <div><SlidersHorizontal size={18} /><span>Refine listings</span></div>
          <small>{activeFilters ? `${activeFilters} active filters · saved in this URL` : "No filters applied"}</small>
        </div>

        <div className="inventory-controls-grid">
          <label className="product-search-field">
            <Search size={18} />
            <input value={query} onChange={(event) => setFilters({ q: event.target.value || null })} placeholder="Search make, model, variant or location…" />
            {query && <button type="button" onClick={() => setFilters({ q: null })} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <label className="product-select"><Filter size={16} /><select value={status} onChange={(event) => setFilters({ status: event.target.value as (typeof statusOptions)[number] })}><option value="all">Any status</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="price_drop">Price drop</option></select></label>
          <label className="product-select"><select value={make} onChange={(event) => setFilters({ make: event.target.value === "all" ? null : event.target.value })}><option value="all">Any make</option>{makes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="product-select"><select value={body} onChange={(event) => setFilters({ body: event.target.value === "all" ? null : event.target.value })}><option value="all">Any body style</option>{bodies.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="product-select"><ListFilter size={16} /><select value={sort} onChange={(event) => setFilters({ sort: event.target.value as (typeof sortOptions)[number] })}><option value="latest">Recently added</option><option value="price-high">Price: high to low</option><option value="price-low">Price: low to high</option><option value="year">Newest year</option><option value="mileage">Lowest mileage</option></select></label>
          <AnimatePresence>{activeFilters > 0 && <motion.button className="filter-reset" type="button" onClick={reset} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><X size={15} /> Reset all</motion.button>}</AnimatePresence>
        </div>
      </section>

      <section className="inventory-results-section">
        <div className="results-heading-row">
          <div><LayoutGrid size={17} /><strong>{filtered.length}</strong><span>vehicles</span></div>
          <small>{listingsQuery.isFetching ? "Checking for new listings…" : `${listings.length} listings loaded`}</small>
        </div>

        {listingsQuery.isPending ? (
          <div className="vehicle-grid">{Array.from({ length: 8 }).map((_, index) => <div className="vehicle-card skeleton-card" key={index}><div/><span/><span/><span/></div>)}</div>
        ) : listingsQuery.error ? (
          <div className="product-state"><small>LISTINGS</small><h2>We couldn&apos;t load the vehicles.</h2><p>{listingsQuery.error instanceof Error ? listingsQuery.error.message : "Unable to load listings."}</p></div>
        ) : filtered.length ? (
          <motion.div className="vehicle-grid smart-vehicle-grid" layout>
            <AnimatePresence mode="popLayout">
              {filtered.map((listing, index) => <VehicleCard key={listingCollectionKey(listing)} listing={listing} index={index} />)}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="product-state"><small>NO MATCHES</small><h2>No vehicles match those filters.</h2><p>Reset the filters or broaden the search.</p><button type="button" className="product-primary-button" onClick={reset}>Reset filters</button></div>
        )}
      </section>
    </main>
  );
}
