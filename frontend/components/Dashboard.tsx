"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Tooltip } from "radix-ui";
import { toast } from "sonner";
import {
  Activity,
  Clock3,
  Database,
  Filter,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  Sparkles,
  X,
} from "lucide-react";
import type { Listing, Overview, TorqueStatus } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import VehicleCard from "./VehicleCard";

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

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("latest");
  const [clock, setClock] = useState("--:--");
  const [nairobiHour, setNairobiHour] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const listingsQuery = useQuery({
    queryKey: ["listings", "dashboard"],
    queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=100"),
    refetchInterval: 60_000,
  });
  const overviewQuery = useQuery({
    queryKey: ["overview"],
    queryFn: () => fetchJson<Overview>("/api/torque/overview"),
    refetchInterval: 60_000,
  });
  const statusQuery = useQuery({
    queryKey: ["status"],
    queryFn: () => fetchJson<TorqueStatus>("/api/torque/status"),
    refetchInterval: 60_000,
  });

  const listings = listingsQuery.data ?? [];
  const overview = overviewQuery.data ?? emptyOverview;
  const status = statusQuery.data ?? null;
  const loading = listingsQuery.isPending || overviewQuery.isPending || statusQuery.isPending;
  const isFetching = listingsQuery.isFetching || overviewQuery.isFetching || statusQuery.isFetching;
  const error = listingsQuery.error || overviewQuery.error || statusQuery.error;

  useEffect(() => {
    const timezone = status?.timezone || "Africa/Nairobi";
    const updateClock = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: timezone,
        }).format(now),
      );
      setNairobiHour(
        Number(
          new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            hourCycle: "h23",
            timeZone: timezone,
          }).format(now),
        ),
      );
    };
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, [status?.timezone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

    return [...result].sort((a, b) => {
      if (sort === "price-high") return (b.price || 0) - (a.price || 0);
      if (sort === "price-low") return (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER);
      if (sort === "year") return (b.year || 0) - (a.year || 0);
      return new Date(b.created_at || b.post?.created_at || 0).getTime() - new Date(a.created_at || a.post?.created_at || 0).getTime();
    });
  }, [listings, query, sort, statusFilter]);

  const filtersActive = Boolean(query.trim()) || statusFilter !== "all" || sort !== "latest";
  const currentPoll = (() => {
    if (nairobiHour === null) return "—";
    const daytime = nairobiHour >= 6 && nairobiHour < 22;
    const seconds = daytime ? status?.daytime_poll_seconds : status?.nighttime_poll_seconds;
    return seconds ? `${Math.round(seconds / 60)} min` : "—";
  })();

  const refreshAll = () => {
    const refresh = Promise.all([
      listingsQuery.refetch(),
      overviewQuery.refetch(),
      statusQuery.refetch(),
    ]).then((results) => {
      if (results.some((result) => result.error)) throw new Error("Some intelligence feeds did not refresh.");
      return undefined;
    });

    toast.promise(refresh, {
      loading: "Refreshing market signal…",
      success: "Vehicle intelligence refreshed.",
      error: (reason) => (reason instanceof Error ? reason.message : "Refresh failed."),
    });
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setSort("latest");
    searchRef.current?.focus();
  };

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
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="live-pill" tabIndex={0}><i /> LIVE FEED</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="torque-tooltip" sideOffset={8}>
                Source data refreshes automatically and again when you return to this tab.
                <Tooltip.Arrow className="torque-tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className="sync-button" type="button" onClick={refreshAll} disabled={isFetching}>
                <RefreshCw size={17} className={isFetching ? "spin" : ""} /> {isFetching ? "Syncing" : "Refresh"}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="torque-tooltip" sideOffset={8}>
                Refresh listings, source status and intelligence metrics now.
                <Tooltip.Arrow className="torque-tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </header>

      <motion.section
        className="hero-grid"
        initial="hidden"
        animate="visible"
        variants={reveal}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
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
              <Signal size={18} />
              <span><small>MONITORING</small><strong>{status?.target ? `@${status.target.replace(/^@/, "")}` : "Awaiting target"}</strong></span>
            </div>
          </div>
        </div>

        <motion.div
          className="hero-instrument"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 5.5, ease: "easeInOut" }}
        >
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
        </motion.div>
      </motion.section>

      <motion.section
        className="metric-strip"
        id="intelligence"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <article>
          <div className="metric-icon"><Database size={19} /></div>
          <div><small>INDEXED INVENTORY</small><strong>{overview.listings_total.toString().padStart(2, "0")}</strong><span>{overview.available_total} currently available</span></div>
        </article>
        <article>
          <div className="metric-icon"><Sparkles size={19} /></div>
          <div><small>AI ENRICHMENT</small><strong>{Math.round(overview.enrichment_rate)}%</strong><span>{overview.enriched_posts} posts interpreted</span></div>
        </article>
        <article>
          <div className="metric-icon"><Clock3 size={19} /></div>
          <div><small>LATEST SIGNAL</small><strong className="metric-time">{formatRelativeTime(overview.latest_post_at)}</strong><span>Live query cache + background refresh</span></div>
        </article>
        <article>
          <div className="metric-icon"><ShieldCheck size={19} /></div>
          <div><small>EVIDENCE MODEL</small><strong className="metric-time">PROVENANCE</strong><span>Claims separated from inference</span></div>
        </article>
      </motion.section>

      <section className="inventory-section" id="inventory">
        <div className="section-heading">
          <div>
            <div className="section-kicker"><span>02</span> LIVE INVENTORY</div>
            <h2>Machines in the signal.</h2>
          </div>
          <div className="inventory-count"><strong>{filtered.length}</strong><span>matching records</span></div>
        </div>

        <div className="filter-rail enhanced-filter-rail">
          <label className="search-field enhanced-search">
            <Search size={18} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search make, model, location…"
              aria-label="Search vehicle inventory"
            />
            {query ? (
              <button type="button" className="input-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
          <label className="select-field"><Filter size={17} />
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
          <AnimatePresence>
            {filtersActive && (
              <motion.button
                type="button"
                className="clear-filters"
                onClick={clearFilters}
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
              >
                <X size={15} /> Reset
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="inventory-meta-row">
          <span><Activity size={15} /> {isFetching ? "Refreshing intelligence…" : "Intelligence current"}</span>
          <span>{filtersActive ? `${filtered.length} of ${listings.length} records visible` : `${listings.length} records loaded`}</span>
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
            <p>{error instanceof Error ? error.message : "Unable to reach the backend."}</p>
            <button className="primary-action" onClick={refreshAll}>Retry connection</button>
          </div>
        ) : filtered.length ? (
          <motion.div className="vehicle-grid" layout>
            <AnimatePresence mode="popLayout">
              {filtered.map((listing, index) => <VehicleCard key={listing.id} listing={listing} index={index} />)}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="state-panel">
            <div className="state-radar"><span /></div>
            <small>SIGNAL QUEUE</small>
            <h3>{listings.length ? "No records match this filter." : "Awaiting the first vehicle signal."}</h3>
            <p>{listings.length ? "Change the search or status filters to widen the view." : "Once the configured X account publishes a candidate listing, The Torque will classify, enrich and surface it here."}</p>
            {filtersActive && <button className="secondary-action" onClick={clearFilters}>Reset filters</button>}
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
            <div className="telemetry-footer"><Gauge size={18} /><span>Last source cursor</span><code>{status?.last_seen_post_id || "waiting"}</code></div>
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
