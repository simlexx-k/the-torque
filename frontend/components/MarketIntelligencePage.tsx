"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeDollarSign, CarFront, Clock3, Database, Gauge, Sparkles, TrendingUp } from "lucide-react";
import type { Listing, Overview, TorqueStatus } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { formatNumber, formatPrice, formatRelativeTime } from "@/lib/format";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export default function MarketIntelligencePage() {
  const listingsQuery = useQuery({ queryKey: ["listings", "market"], queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=200"), refetchInterval: 60_000 });
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => fetchJson<Overview>("/api/torque/overview"), refetchInterval: 60_000 });
  const statusQuery = useQuery({ queryKey: ["status"], queryFn: () => fetchJson<TorqueStatus>("/api/torque/status"), refetchInterval: 60_000 });

  const listings = listingsQuery.data ?? [];
  const overview = overviewQuery.data;
  const status = statusQuery.data;

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
    return {
      medianPrice: median(priced),
      medianMileage: median(mileages),
      priceCoverage: listings.length ? Math.round((priced.length / listings.length) * 100) : 0,
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
          <div className="page-kicker"><span>03</span> MARKET INTELLIGENCE</div>
          <h1>Read the market<br/><em>without guessing.</em></h1>
          <p>A live snapshot derived only from indexed seller listings. No fabricated trend line, no synthetic history—just what the current evidence supports.</p>
        </div>
        <div className="page-hero-stat market-pulse-stat"><TrendingUp size={19}/><span><small>MARKET PULSE</small><strong>{overview?.listings_total ?? listings.length}</strong></span></div>
      </section>

      <section className="market-stat-grid">
        <article><BadgeDollarSign size={18}/><small>MEDIAN ASKING PRICE</small><strong>{formatPrice(snapshot.medianPrice, "KES")}</strong><span>{snapshot.priceCoverage}% price coverage</span></article>
        <article><Gauge size={18}/><small>MEDIAN MILEAGE</small><strong>{snapshot.medianMileage ? `${formatNumber(snapshot.medianMileage)} km` : "—"}</strong><span>Across mileage-bearing records</span></article>
        <article><Sparkles size={18}/><small>AI ENRICHMENT</small><strong>{Math.round(overview?.enrichment_rate ?? 0)}%</strong><span>{overview?.enriched_posts ?? 0} interpreted posts</span></article>
        <article><Clock3 size={18}/><small>LATEST SIGNAL</small><strong>{formatRelativeTime(overview?.latest_post_at)}</strong><span>{status?.timezone || "Africa/Nairobi"}</span></article>
      </section>

      <section className="market-analysis-grid">
        <article className="analysis-panel">
          <div className="analysis-panel-head"><div><CarFront size={18}/><span>Make concentration</span></div><small>CURRENT INDEX</small></div>
          <div className="signal-bars">
            {snapshot.makes.length ? snapshot.makes.map(([label, count]) => (
              <div className="signal-bar-row" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(8, (count / snapshot.maxMakeCount) * 100)}%` }}/></div><strong>{count}</strong></div>
            )) : <div className="analysis-empty">No make distribution yet.</div>}
          </div>
        </article>

        <article className="analysis-panel">
          <div className="analysis-panel-head"><div><Database size={18}/><span>Body-type mix</span></div><small>STRUCTURED DATA</small></div>
          <div className="signal-bars">
            {snapshot.bodies.length ? snapshot.bodies.map(([label, count]) => (
              <div className="signal-bar-row" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(8, (count / snapshot.maxBodyCount) * 100)}%` }}/></div><strong>{count}</strong></div>
            )) : <div className="analysis-empty">No body-type distribution yet.</div>}
          </div>
        </article>
      </section>

      <section className="market-method-panel">
        <div className="market-method-copy"><div className="page-kicker"><span>04</span> EVIDENCE DISCIPLINE</div><h2>What this page will—and will not—claim.</h2><p>These metrics are descriptive summaries of the currently indexed seller feed. They are not market-wide valuations, depreciation models, or price forecasts. Historical trend charts will only appear once the backend stores an actual time series.</p></div>
        <div className="method-grid">
          <div><Activity size={17}/><strong>Observed</strong><span>Current seller listings and source metadata.</span></div>
          <div><Sparkles size={17}/><strong>Enriched</strong><span>AI-assisted structured fields with provenance.</span></div>
          <div><Database size={17}/><strong>Bounded</strong><span>No inference beyond the indexed evidence set.</span></div>
          <div><TrendingUp size={17}/><strong>Ready to evolve</strong><span>Price history can slot in when persisted server-side.</span></div>
        </div>
      </section>
    </main>
  );
}
