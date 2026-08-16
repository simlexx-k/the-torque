"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import VehicleCard from "./VehicleCard";

type QuickFilter = "all" | "available" | "price-drop" | "under-1m" | "suv" | "automatic";

const quickFilters: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Latest" },
  { value: "available", label: "Available" },
  { value: "price-drop", label: "Price drops" },
  { value: "under-1m", label: "Under KSh 1M" },
  { value: "suv", label: "SUVs" },
  { value: "automatic", label: "Automatic" },
];

function listingTimestamp(listing: Listing) {
  return new Date(listing.created_at || listing.post?.created_at || 0).getTime();
}

export default function HomeCatalog() {
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const listingsQuery = useQuery({
    queryKey: ["listings", "home-catalog"],
    queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=100"),
    refetchInterval: 60_000,
  });

  const listings = listingsQuery.data ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...listings]
      .filter((listing) => {
        const haystack = [
          listing.make,
          listing.model,
          listing.variant,
          listing.generation,
          listing.year,
          listing.location,
          listing.body_type,
          listing.fuel,
          listing.transmission,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (needle && !haystack.includes(needle)) return false;

        const status = (listing.status || "").toLowerCase();
        if (quickFilter === "available" && status !== "available") return false;
        if (quickFilter === "price-drop" && status !== "price_drop") return false;
        if (quickFilter === "under-1m" && (!listing.price || listing.price > 1_000_000)) return false;
        if (quickFilter === "suv" && !(listing.body_type || "").toLowerCase().includes("suv")) return false;
        if (quickFilter === "automatic" && !(listing.transmission || "").toLowerCase().includes("auto")) return false;
        return true;
      })
      .sort((a, b) => listingTimestamp(b) - listingTimestamp(a));
  }, [listings, query, quickFilter]);

  const visible = filtered.slice(0, 12);
  const availableCount = listings.filter((listing) => (listing.status || "").toLowerCase() === "available").length;
  const priceDropCount = listings.filter((listing) => (listing.status || "").toLowerCase() === "price_drop").length;
  const makeCount = new Set(listings.map((listing) => listing.make?.trim().toLowerCase()).filter(Boolean)).size;
  const filtersActive = Boolean(query.trim()) || quickFilter !== "all";

  const reset = () => {
    setQuery("");
    setQuickFilter("all");
  };

  return (
    <main className="home-catalog">
      <section className="catalog-entry">
        <div className="catalog-entry-copy">
          <span className="catalog-eyebrow"><CarFront size={15} /> VEHICLES FOR SALE</span>
          <h1>Find the car.<br/><em>Skip the dashboard.</em></h1>
          <p>Current vehicle listings, seller photos and structured specifications in one fast browse.</p>
        </div>

        <div className="catalog-search-panel">
          <label className="catalog-search-box">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Toyota, Passat, SUV, Eldoret…"
              aria-label="Search current vehicle listings"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </label>

          <div className="catalog-quick-filters" aria-label="Quick listing filters">
            {quickFilters.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={quickFilter === filter.value ? "active" : ""}
                onClick={() => setQuickFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-snapshot" aria-label="Inventory snapshot">
          <div><strong>{availableCount}</strong><span>Available now</span></div>
          <div><strong>{priceDropCount}</strong><span>Price drops</span></div>
          <div><strong>{makeCount}</strong><span>Makes listed</span></div>
        </div>
      </section>

      <section className="catalog-listings" aria-labelledby="latest-listings-heading">
        <div className="catalog-section-head">
          <div>
            <span className="catalog-section-kicker">CURRENT INVENTORY</span>
            <h2 id="latest-listings-heading">{filtersActive ? "Matching listings" : "Latest listings"}</h2>
          </div>
          <div className="catalog-head-actions">
            {filtersActive && (
              <button type="button" className="catalog-reset" onClick={reset}>
                <X size={14} /> Reset
              </button>
            )}
            <Link href="/inventory" className="catalog-all-link">
              Browse all listings <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="catalog-result-line">
          <span><SlidersHorizontal size={14} /> {filtered.length} {filtered.length === 1 ? "vehicle" : "vehicles"}</span>
          {listingsQuery.isFetching && !listingsQuery.isPending && <span className="catalog-refreshing">Updating…</span>}
        </div>

        {listingsQuery.isPending ? (
          <div className="vehicle-grid catalog-vehicle-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="vehicle-card skeleton-card" key={index}><div/><span/><span/><span/></div>
            ))}
          </div>
        ) : listingsQuery.error ? (
          <div className="catalog-state">
            <CarFront size={30} />
            <h3>Listings are temporarily unavailable.</h3>
            <p>Please try again shortly.</p>
            <button type="button" onClick={() => listingsQuery.refetch()}>Try again</button>
          </div>
        ) : visible.length ? (
          <motion.div className="vehicle-grid catalog-vehicle-grid" layout>
            <AnimatePresence mode="popLayout">
              {visible.map((listing, index) => (
                <VehicleCard key={listing.id} listing={listing} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="catalog-state">
            <Search size={30} />
            <h3>No vehicles match that search.</h3>
            <p>Clear the filters or browse the full inventory.</p>
            <button type="button" onClick={reset}>Clear filters</button>
          </div>
        )}

        {filtered.length > visible.length && (
          <div className="catalog-more-row">
            <Link href="/inventory">See all {filtered.length} listings <ChevronRight size={17} /></Link>
          </div>
        )}
      </section>

      <section className="catalog-confidence" aria-label="What you get with each listing">
        <div>
          <CheckCircle2 size={18} />
          <span><strong>Seller-source media</strong><small>Original listing photos stay attached to the vehicle record.</small></span>
        </div>
        <div>
          <Tag size={18} />
          <span><strong>Structured details</strong><small>Price, mileage, specification and location are easier to compare.</small></span>
        </div>
        <Link href="/market">Explore market view <ArrowRight size={15} /></Link>
      </section>
    </main>
  );
}
