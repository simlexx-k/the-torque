"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Popover } from "radix-ui";
import { Bell, BookmarkPlus, ChevronLeft, ChevronRight, Filter, LayoutGrid, ListFilter, Search, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { fetchAllListings } from "@/lib/catalog";
import { listingCollectionKey } from "@/lib/listingRef";
import { type SavedSearch, type SavedSearchFilters, useSavedSearches } from "@/lib/useSavedSearches";
import VehicleCard from "@/components/VehicleCard";

const statusOptions = ["all", "available", "reserved", "sold", "price_drop"] as const;
const sortOptions = ["latest", "price-high", "price-low", "year", "mileage"] as const;
const PAGE_SIZE = 48;

const inventorySearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(statusOptions).withDefault("all"),
  make: parseAsString.withDefault("all"),
  body: parseAsString.withDefault("all"),
  sort: parseAsStringLiteral(sortOptions).withDefault("latest"),
  page: parseAsInteger.withDefault(1),
};

export default function InventoryExplorer() {
  const [{ q: query, status, make, body, sort, page }, setFilters] = useQueryStates(inventorySearchParams, {
    history: "replace",
    shallow: true,
  });

  const listingsQuery = useQuery({
    queryKey: ["listings", "all-pages"],
    queryFn: () => fetchAllListings(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const listings = listingsQuery.data ?? [];
  const makes = useMemo(() => Array.from(new Set(listings.map((item) => item.make).filter(Boolean) as string[])).sort(), [listings]);
  const bodies = useMemo(() => Array.from(new Set(listings.map((item) => item.body_type).filter(Boolean) as string[])).sort(), [listings]);
  const { savedSearches, summaries, totalNewMatches, saveSearch, removeSearch, markViewed } = useSavedSearches(listings);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pageListings = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const values = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(values).filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const activeFilters = [query, status !== "all" ? status : "", make !== "all" ? make : "", body !== "all" ? body : "", sort !== "latest" ? sort : ""].filter(Boolean).length;
  const currentSavedFilters: SavedSearchFilters = { q: query, status, make, body, sort };

  const reset = () => setFilters({ q: null, status: null, make: null, body: null, sort: null, page: null });
  const setPage = (nextPage: number) => setFilters({ page: nextPage <= 1 ? null : nextPage });

  const saveCurrentSearch = () => {
    const result = saveSearch(currentSavedFilters);
    toast(result.created ? `Saved search: ${result.search.label}` : "That search is already saved.");
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setFilters({
      q: saved.filters.q || null,
      status: statusOptions.includes(saved.filters.status as (typeof statusOptions)[number]) ? saved.filters.status as (typeof statusOptions)[number] : "all",
      make: saved.filters.make === "all" ? null : saved.filters.make,
      body: saved.filters.body === "all" ? null : saved.filters.body,
      sort: sortOptions.includes(saved.filters.sort as (typeof sortOptions)[number]) ? saved.filters.sort as (typeof sortOptions)[number] : "latest",
      page: null,
    });
    markViewed(saved.id);
  };

  return (
    <main className="product-page inventory-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>02</span> ALL LISTINGS</div>
          <h1>Search the full line-up.<br/><em>Filter by what matters.</em></h1>
          <p>Narrow the current listings by make, body style and availability, then save a search to see when fresh matches arrive.</p>
        </div>
        <div className="page-hero-stat">
          <Sparkles size={18} />
          <span><small>MATCHING VEHICLES</small><strong>{filtered.length.toLocaleString("en-KE")}</strong></span>
        </div>
      </section>

      <section className="inventory-workbench">
        <div className="workbench-title-row">
          <div><SlidersHorizontal size={18} /><span>Refine listings</span></div>
          <div className="workbench-meta-actions">
            <small>{activeFilters ? `${activeFilters} active filters · saved in this URL` : "No filters applied"}</small>
            <button type="button" className="save-search-button" onClick={saveCurrentSearch}><BookmarkPlus size={15}/> Save search</button>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button type="button" className="saved-searches-button" aria-label="Open saved searches">
                  <Bell size={15}/><span>Saved</span>{savedSearches.length > 0 && <b>{savedSearches.length}</b>}{totalNewMatches > 0 && <i>{totalNewMatches} new</i>}
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="saved-searches-popover" align="end" sideOffset={9} collisionPadding={14}>
                  <div className="saved-searches-head"><div><small>WATCHED SEARCHES</small><strong>Saved searches</strong></div>{totalNewMatches > 0 && <span>{totalNewMatches} fresh matches</span>}</div>
                  {summaries.length ? (
                    <div className="saved-search-list">
                      {summaries.map(({ search, matchCount, newCount }) => (
                        <div className="saved-search-row" key={search.id}>
                          <button type="button" className="saved-search-open" onClick={() => applySavedSearch(search)}>
                            <strong>{search.label}</strong>
                            <span>{matchCount} current {matchCount === 1 ? "match" : "matches"}{newCount > 0 ? ` · ${newCount} new` : ""}</span>
                          </button>
                          <button type="button" className="saved-search-delete" onClick={() => removeSearch(search.id)} aria-label={`Delete saved search ${search.label}`}><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="saved-search-empty">Save any set of filters and The Torque will remember it on this device and flag newer matches.</p>
                  )}
                  <Popover.Arrow className="smart-spec-arrow" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>

        <div className="inventory-controls-grid">
          <label className="product-search-field">
            <Search size={18} />
            <input value={query} onChange={(event) => setFilters({ q: event.target.value || null, page: null })} placeholder="Search make, model, variant or location…" />
            {query && <button type="button" onClick={() => setFilters({ q: null, page: null })} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <label className="product-select"><Filter size={16} /><select value={status} onChange={(event) => setFilters({ status: event.target.value as (typeof statusOptions)[number], page: null })}><option value="all">Any status</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="price_drop">Price drop</option></select></label>
          <label className="product-select"><select value={make} onChange={(event) => setFilters({ make: event.target.value === "all" ? null : event.target.value, page: null })}><option value="all">Any make</option>{makes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="product-select"><select value={body} onChange={(event) => setFilters({ body: event.target.value === "all" ? null : event.target.value, page: null })}><option value="all">Any body style</option>{bodies.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="product-select"><ListFilter size={16} /><select value={sort} onChange={(event) => setFilters({ sort: event.target.value as (typeof sortOptions)[number], page: null })}><option value="latest">Recently added</option><option value="price-high">Price: high to low</option><option value="price-low">Price: low to high</option><option value="year">Newest year</option><option value="mileage">Lowest mileage</option></select></label>
          <AnimatePresence>{activeFilters > 0 && <motion.button className="filter-reset" type="button" onClick={reset} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><X size={15} /> Reset all</motion.button>}</AnimatePresence>
        </div>
      </section>

      <section className="inventory-results-section">
        <div className="results-heading-row">
          <div><LayoutGrid size={17} /><strong>{filtered.length}</strong><span>vehicles</span></div>
          <small>{listingsQuery.isFetching ? "Checking for new listings…" : `${listings.length.toLocaleString("en-KE")} listings loaded · page ${currentPage} of ${totalPages}`}</small>
        </div>

        {listingsQuery.isPending ? (
          <div className="vehicle-grid">{Array.from({ length: 8 }).map((_, index) => <div className="vehicle-card skeleton-card" key={index}><div/><span/><span/><span/></div>)}</div>
        ) : listingsQuery.error ? (
          <div className="product-state"><small>LISTINGS</small><h2>We couldn&apos;t load the vehicles.</h2><p>{listingsQuery.error instanceof Error ? listingsQuery.error.message : "Unable to load listings."}</p></div>
        ) : pageListings.length ? (
          <>
            <motion.div className="vehicle-grid smart-vehicle-grid" layout>
              <AnimatePresence mode="popLayout">
                {pageListings.map((listing, index) => <VehicleCard key={listingCollectionKey(listing)} listing={listing} index={index} />)}
              </AnimatePresence>
            </motion.div>
            {totalPages > 1 && (
              <nav className="inventory-pagination" aria-label="Inventory pages">
                <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous listings page"><ChevronLeft size={16}/> Previous</button>
                <div>
                  {pageNumbers.map((pageNumber, index) => {
                    const previous = pageNumbers[index - 1];
                    return (
                      <span key={pageNumber}>
                        {previous && pageNumber - previous > 1 && <i aria-hidden="true">…</i>}
                        <button type="button" className={pageNumber === currentPage ? "active" : ""} aria-current={pageNumber === currentPage ? "page" : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                      </span>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>Next <ChevronRight size={16}/></button>
              </nav>
            )}
          </>
        ) : (
          <div className="product-state"><small>NO MATCHES</small><h2>No vehicles match those filters.</h2><p>Reset the filters or broaden the search.</p><button type="button" className="product-primary-button" onClick={reset}>Reset filters</button></div>
        )}
      </section>
    </main>
  );
}
