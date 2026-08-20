"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, CarFront, Clock3, Database, Gauge, TrendingUp } from "lucide-react";
import { fetchAllListings } from "@/lib/catalog";
import { formatNumber, formatPrice, formatRelativeTime } from "@/lib/format";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export default function MarketIntelligencePage() {
  // The public market page intentionally derives its summary from the public
  // listing payload instead of requesting the backend operations overview.
  const listingsQuery = useQuery({
    queryKey: ["listings", "all-pages"],
    queryFn: () => fetchAllListings(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const listings = listingsQuery.data ?? [];

  const snapshot = useMemo(() => {
    const priced = listings.map((listing) => listing.price).filter((value): value is number => typeof value === "number" && value > 0);
    const mileages = listings.map((listing) => listing.mileage_km).filter((value): value is number => typeof value === "number" && value > 0);
    const makeCounts = new Map<string, number>();
    const bodyCounts = new Map<string, number>();
    listings.forEach((listing) => {
      if (listing.make) makeCounts.set(listing.make, (makeCounts.get(listing.make) || 0) + 1);
      if (listing.body_type) bodyCounts.set(listing.body_type, (bodyCounts.get(listing.body_type) || 0) + 1);
    });
    const makes = [...makeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const bodies = [...bodyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const latestListingAt = listings
      .map((listing) => listing.created_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return {
      medianPrice: median(priced),
      medianMileage: median(mileages),
      priceCoverage: listings.length ? Math.round((priced.length / listings.length) * 100) : 0,
      available: listings.filter((item) => item.status?.toLowerCase() === "available").length,
      latestListingAt,
      makes,
      bodies,
      maxMakeCount: Math.max(...makes.map(([, count]) => count), 1),
      maxBodyCount: Math.max(...bodies.map(([, count]) => count), 1),
    };
  }, [listings]);

  return (
    <main className="product-page market-page">
      <section className="page-hero">
        <div>
          <div className="page-kicker"><span>03</span> MARKET SNAPSHOT</div>
          <h1>See where current<br/><em>asking prices sit.</em></h1>
          <p>A simple view of the vehicles currently listed in The Torque: asking prices, mileage and the makes and body styles appearing most often.</p>
        </div>
        <div className="page-hero-stat market-pulse-stat"><TrendingUp size={19}/><span><small>VEHICLES IN VIEW</small><strong>{listings.length}</strong></span></div>
      </section>

      <section className="market-stat-grid">
        <article><BadgeDollarSign size={18}/><small>MEDIAN ASKING PRICE</small><strong>{formatPrice(snapshot.medianPrice, "KES")}</strong><span>Price shown on {snapshot.priceCoverage}% of listings</span></article>
        <article><Gauge size={18}/><small>MEDIAN MILEAGE</small><strong>{snapshot.medianMileage ? `${formatNumber(snapshot.medianMileage)} km` : "—"}</strong><span>For vehicles with mileage stated</span></article>
        <article><CarFront size={18}/><small>AVAILABLE NOW</small><strong>{snapshot.available}</strong><span>Marked available in the current listings</span></article>
        <article><Clock3 size={18}/><small>MOST RECENT ADDITION</small><strong>{formatRelativeTime(snapshot.latestListingAt)}</strong><span>Based on the latest public listing</span></article>
      </section>

      <section className="market-analysis-grid">
        <article className="analysis-panel">
          <div className="analysis-panel-head"><div><CarFront size={18}/><span>Most-listed makes</span></div><small>CURRENT LISTINGS</small></div>
          <div className="signal-bars">
            {snapshot.makes.length ? snapshot.makes.map(([label, count]) => (
              <div className="signal-bar-row" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(8, (count / snapshot.maxMakeCount) * 100)}%` }}/></div><strong>{count}</strong></div>
            )) : <div className="analysis-empty">Not enough make data yet.</div>}
          </div>
        </article>

        <article className="analysis-panel">
          <div className="analysis-panel-head"><div><Database size={18}/><span>Body styles listed</span></div><small>CURRENT LISTINGS</small></div>
          <div className="signal-bars">
            {snapshot.bodies.length ? snapshot.bodies.map(([label, count]) => (
              <div className="signal-bar-row" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(8, (count / snapshot.maxBodyCount) * 100)}%` }}/></div><strong>{count}</strong></div>
            )) : <div className="analysis-empty">Not enough body-style data yet.</div>}
          </div>
        </article>
      </section>

      <section className="market-method-panel">
        <div className="market-method-copy"><div className="page-kicker"><span>NOTE</span> HOW TO READ THIS PAGE</div><h2>A snapshot of these listings—not the whole market.</h2><p>The figures here summarise vehicles currently captured by The Torque. They should not be read as a Kenya-wide valuation, formal appraisal, depreciation forecast or guarantee of a fair price.</p></div>
        <div className="method-grid">
          <div><BadgeDollarSign size={17}/><strong>Asking prices</strong><span>Prices stated on the seller listings currently available.</span></div>
          <div><Gauge size={17}/><strong>Stated mileage</strong><span>Mileage is included only where a listing provides it.</span></div>
          <div><CarFront size={17}/><strong>Current mix</strong><span>Make and body-style counts reflect this listing set only.</span></div>
          <div><TrendingUp size={17}/><strong>No invented history</strong><span>Trend charts will appear only when genuine historical data exists.</span></div>
        </div>
      </section>
    </main>
  );
}
