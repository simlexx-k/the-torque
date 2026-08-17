"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Listing } from "@/lib/types";

export type SavedSearchFilters = {
  q: string;
  status: string;
  make: string;
  body: string;
  sort: string;
};

export type SavedSearch = {
  id: string;
  label: string;
  filters: SavedSearchFilters;
  createdAt: string;
  lastViewedAt: string;
};

const STORAGE_KEY = "torque-saved-searches-v1";

function listingTime(listing: Listing) {
  const value = listing.created_at || listing.post?.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function listingMatchesSavedSearch(listing: Listing, filters: SavedSearchFilters) {
  const needle = filters.q.trim().toLowerCase();
  const haystack = [
    listing.year,
    listing.make,
    listing.model,
    listing.variant,
    listing.generation,
    listing.location,
    listing.body_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    (!needle || haystack.includes(needle)) &&
    (filters.status === "all" || listing.status.toLowerCase() === filters.status) &&
    (filters.make === "all" || listing.make === filters.make) &&
    (filters.body === "all" || listing.body_type === filters.body)
  );
}

export function savedSearchLabel(filters: SavedSearchFilters) {
  const parts = [
    filters.q.trim() || null,
    filters.make !== "all" ? filters.make : null,
    filters.body !== "all" ? filters.body : null,
    filters.status !== "all" ? filters.status.replaceAll("_", " ") : null,
  ].filter(Boolean) as string[];
  return parts.length ? parts.slice(0, 3).join(" · ") : "All new listings";
}

function readSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as SavedSearch[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.filters) : [];
  } catch {
    return [];
  }
}

export function useSavedSearches(listings: Listing[]) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSavedSearches(readSavedSearches());
  }, []);

  const persist = useCallback((next: SavedSearch[]) => {
    setSavedSearches(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const saveSearch = useCallback((filters: SavedSearchFilters) => {
    const key = JSON.stringify(filters);
    const existing = savedSearches.find((item) => JSON.stringify(item.filters) === key);
    if (existing) return { search: existing, created: false };

    const now = new Date().toISOString();
    const search: SavedSearch = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `search-${Date.now()}`,
      label: savedSearchLabel(filters),
      filters,
      createdAt: now,
      lastViewedAt: now,
    };
    persist([search, ...savedSearches].slice(0, 12));
    return { search, created: true };
  }, [persist, savedSearches]);

  const removeSearch = useCallback((id: string) => {
    persist(savedSearches.filter((item) => item.id !== id));
  }, [persist, savedSearches]);

  const markViewed = useCallback((id: string) => {
    const now = new Date().toISOString();
    persist(savedSearches.map((item) => item.id === id ? { ...item, lastViewedAt: now } : item));
  }, [persist, savedSearches]);

  const summaries = useMemo(() => savedSearches.map((search) => {
    const matches = listings.filter((listing) => listingMatchesSavedSearch(listing, search.filters));
    const since = new Date(search.lastViewedAt || search.createdAt).getTime();
    const newMatches = matches.filter((listing) => listingTime(listing) > since);
    return { search, matchCount: matches.length, newCount: newMatches.length };
  }), [listings, savedSearches]);

  const totalNewMatches = summaries.reduce((total, item) => total + item.newCount, 0);

  return {
    savedSearches,
    summaries,
    totalNewMatches,
    saveSearch,
    removeSearch,
    markViewed,
  };
}
