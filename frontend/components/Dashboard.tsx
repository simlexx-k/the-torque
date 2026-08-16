"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Listing, Overview, TorqueStatus } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import VehicleCard from "./VehicleCard";
import {
  ClockIcon,
  DatabaseIcon,
  FilterIcon,
  GaugeIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SignalIcon,
  SparkIcon,
} from "./Icons";

const emptyOverview: Overview = {
  listings_total: 0,
  posts_total: 0,
  available_total: 0,
  sold_total: 0,
  enriched_posts: 0,
  enrichment_rate: 0,
  latest_post_at: null,
  latest_listing_at: null,
};

export default function Dashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [status, setStatus] = useState<TorqueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("latest");
  const [clock, setClock] = useState("--:--");
  const [nairobiHour, setNairobiHour] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [listingRes, overviewRes, statusRes] = await Promise.all([
        fetch("/api/torque/listings?limit=100", { cache: "no-store" }),
        fetch("/api/torque/overview", { cache: "no-store" }),
        fetch("/api/torque/status", { cache: "no-store" }),
      ]);
      if (!listingRes.ok || !overviewRes.ok || !statusRes.ok) throw new Error("The intelligence API is not ready yet.");
      const [listingData, overviewData, statusData] = await Promise.all([
        listingRes.json(),
        overviewRes.json(),
        statusRes.json(),
      ]);
      setListings(listingData);
      setOverview(overviewData);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timezone = status?.timezone || "Africa/Nairobi";
    const updateClock = () => {
      const now = new Date();
      setClock(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(now));
      setNairobiHour(Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: timezone }).format(now)));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, [status?.timezone]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = listings.filter((listing) => {
      const haystack = [listing.make, listing.model, listing.variant, listing.generation, listing.location, listing.year]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesStatus = statusFilter === "all" || listing.status.toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });

    return result.sort((a, b) => {
      if (sort === "price-high") return (b.price || 0) - (a.price || 0);
      if (sort === "price-low") return (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER);
      if (sort === "year") return (b.year || 0) - (a.year || 0);
      return new Date(b.created_at || b.post?.created_at || 0).getTime() - new Date(a.created_at || a.post?.created_at || 0).getTime();
    });
  }, [listings, query, sort, statusFilter]);

  const currentPoll = (() => {
    if (nairobiHour === null) return "—";
    const daytime = nairobiHour >= 6 && nairobiHour < 22;
    const seconds = daytime ? status?.daytime_poll_seconds : status?.nighttime_poll_seconds;
    return seconds ? `${Math.round(seconds / 60)} min` : "—";
  })();

  return (
    <main className="site-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="The Torque home">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy"><strong>THE TORQUE</strong><small>VEHICLE INTELLIGENCE</small></span>
        </Link>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#inventory">Inventory</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#system">System</a>
        </nav>
        <div className="topbar-actions">
          <span className="live-pill"><i /> LIVE FEED</span>
          <span className="sync-button passive"><RefreshIcon size={17} /> Auto scan</span>
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="section-kicker"><span>01</span> MARKET SIGNAL ENGINE</div>
          <h1>See the listing.<br/><em>Understand the machine.</em></h1>
          <p>
            Live vehicle-sale signals transformed into structured, evidence-aware intelligence—price, specification,
            visual observations and source provenance in one operational view.
          </p>
          <div className="hero-actions">
            <a href="#inventory" className="primary-action">Explore inventory <span>↘</span></a>
            <div className="source-readout">
              <SignalIcon size={18} />
              <span><small>MONITORING</small><strong>{status?.target ? `@${status.target.replace(/^@/, "")}` : "Awaiting target"}</strong></span>
            </div>
          </div>
        </div>

        <div className="hero-instrument" aria-hidden="true">
          <div className="instrument-grid" />
          <div className="instrument-orbit orbit-one" />
          <div className="instrument-orbit orbit-two" />
          <div className="instrument-needle" />
          <div className="instrument-center">
            <span className="pulse-dot" />
            <small>MARKET PULSE</small>
            <strong>{overview.listings_total.toString().padStart(2, "0")}</strong>
            <span>LISTINGS INDEXED</span>
          </div>
          <div className="instrument-label label-a">AI / VISION</div>
          <div className="instrument-label label-b">EAT {clock}</div>
          <div className="instrument-label label-c">SYNC {currentPoll}</div>
        </div>
      </section>

      <section className="metric-strip" id="intelligence">
        <article>
          <div className="metric-icon"><DatabaseIcon size={19} /></div>
          <div><small>INDEXED INVENTORY</small><strong>{overview.listings_total.toString().padStart(2, "0")}</strong><span>{overview.available_total} currently available</span></div>
        </article>
        <article>
          <div className="metric-icon"><SparkIcon size={19} /></div>
          <div><small>AI ENRICHMENT</small><strong>{Math.round(overview.enrichment_rate)}%</strong><span>{overview.enriched_posts} posts interpreted</span></div>
        </article>
        <article>
          <div className="metric-icon"><ClockIcon size={19} /></div>
          <div><small>LATEST SIGNAL</small><strong className="metric-time">{formatRelativeTime(overview.latest_post_at)}</strong><span>Auto-refresh every 60 seconds</span></div>
        </article>
        <article>
          <div className="metric-icon"><ShieldIcon size={19} /></div>
          <div><small>EVIDENCE MODEL</small><strong className="metric-time">PROVENANCE</strong><span>Claims separated from inference</span></div>
        </article>
      </section>

      <section className="inventory-section" id="inventory">
        <div className="section-heading">
          <div>
            <div className="section-kicker"><span>02</span> LIVE INVENTORY</div>
            <h2>Machines in the signal.</h2>
          </div>
          <div className="inventory-count"><strong>{filtered.length}</strong><span>matching records</span></div>
        </div>

        <div className="filter-rail">
          <label className="search-field">
            <SearchIcon size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search make, model, location…" />
          </label>
          <label className="select-field"><FilterIcon size={17} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All status</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
              <option value="price_drop">Price drop</option>
            </select>
          </label>
          <label className="select-field">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort listings">
              <option value="latest">Latest first</option>
              <option value="price-high">Price: high to low</option>
              <option value="price-low">Price: low to high</option>
              <option value="year">Newest year</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="vehicle-grid">
            {Array.from({ length: 6 }).map((_, i) => <div className="vehicle-card skeleton-card" key={i}><div/><span/><span/><span/></div>)}
          </div>
        ) : error ? (
          <div className="state-panel error-state">
            <div className="state-radar"><span /></div>
            <small>CONNECTION STATE</small>
            <h3>Backend signal unavailable.</h3>
            <p>{error}</p>
            <button className="primary-action" onClick={() => void load()}>Retry connection</button>
          </div>
        ) : filtered.length ? (
          <div className="vehicle-grid">
            {filtered.map((listing, index) => <VehicleCard key={listing.id} listing={listing} index={index} />)}
          </div>
        ) : (
          <div className="state-panel">
            <div className="state-radar"><span /></div>
            <small>SIGNAL QUEUE</small>
            <h3>{listings.length ? "No records match this filter." : "Awaiting the first vehicle signal."}</h3>
            <p>{listings.length ? "Change the search or status filters to widen the view." : "Once the configured X account publishes a candidate listing, The Torque will classify, enrich and surface it here."}</p>
          </div>
        )}
      </section>

      <section className="system-section" id="system">
        <div className="section-kicker"><span>03</span> SYSTEM TELEMETRY</div>
        <div className="system-grid">
          <div className="system-copy">
            <h2>Built for traceable intelligence.</h2>
            <p>The interface never treats an AI guess like a seller claim. Every enriched attribute can carry source and confidence so uncertain data stays visibly uncertain.</p>
            <div className="principle-list">
              <span><i>01</i><strong>Seller evidence</strong><small>Post text and attached media remain the source layer.</small></span>
              <span><i>02</i><strong>Visual inference</strong><small>AI observations are exposed as observations—not mechanical inspection.</small></span>
              <span><i>03</i><strong>Reference data</strong><small>Manufacturer specifications can be layered in without rewriting source facts.</small></span>
            </div>
          </div>
          <div className="telemetry-panel">
            <div className="telemetry-header"><span>SYSTEM / LIVE</span><span className="live-dot">CONNECTED</span></div>
            <div className="telemetry-row"><span>Target source</span><strong>{status?.target ? `@${status.target.replace(/^@/, "")}` : "Not configured"}</strong></div>
            <div className="telemetry-row"><span>Source state</span><strong>{status?.source_enabled === false ? "Disabled" : status?.source_enabled ? "Enabled" : "Pending"}</strong></div>
            <div className="telemetry-row"><span>Day cycle</span><strong>{status ? `${status.daytime_poll_seconds / 60} min` : "—"}</strong></div>
            <div className="telemetry-row"><span>Night cycle</span><strong>{status ? `${status.nighttime_poll_seconds / 60} min` : "—"}</strong></div>
            <div className="telemetry-row"><span>Timezone</span><strong>{status?.timezone || "Africa/Nairobi"}</strong></div>
            <div className="telemetry-row"><span>Posts captured</span><strong>{overview.posts_total}</strong></div>
            <div className="telemetry-footer"><GaugeIcon size={18} /><span>Last source cursor</span><code>{status?.last_seen_post_id || "waiting"}</code></div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="brand compact"><span className="brand-mark"><span /></span><span className="brand-copy"><strong>THE TORQUE</strong><small>VEHICLE INTELLIGENCE</small></span></div>
        <p>Source-aware automotive intelligence. AI-derived details should be independently verified before purchase.</p>
        <span className="mono">© {new Date().getFullYear()} / EAT</span>
      </footer>
    </main>
  );
}
