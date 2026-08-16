"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, CheckCircle2, Clock3, Database, RadioTower, RefreshCw, ServerCog, ShieldCheck, XCircle } from "lucide-react";
import type { Overview, TorqueStatus } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

export default function SystemPage() {
  const statusQuery = useQuery({ queryKey: ["status"], queryFn: () => fetchJson<TorqueStatus>("/api/torque/status"), refetchInterval: 30_000 });
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => fetchJson<Overview>("/api/torque/overview"), refetchInterval: 30_000 });

  const status = statusQuery.data;
  const overview = overviewQuery.data;
  const connected = Boolean(statusQuery.data && overviewQuery.data && !statusQuery.error && !overviewQuery.error);
  const daytimeMinutes = status?.daytime_poll_seconds ? Math.round(status.daytime_poll_seconds / 60) : null;
  const nighttimeMinutes = status?.nighttime_poll_seconds ? Math.round(status.nighttime_poll_seconds / 60) : null;

  const refresh = () => Promise.all([statusQuery.refetch(), overviewQuery.refetch()]);

  return (
    <main className="product-page system-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>07</span> SYSTEM OPERATIONS</div>
          <h1>Know what is live.<br/><em>Know what is waiting.</em></h1>
          <p>A read-only operations surface for source configuration, polling cadence, enrichment provider and intelligence coverage.</p>
        </div>
        <div className={`system-health-badge ${connected ? "healthy" : "degraded"}`}>
          {connected ? <CheckCircle2 size={20}/> : <XCircle size={20}/>}<span><small>DATA PLANE</small><strong>{connected ? "CONNECTED" : "DEGRADED"}</strong></span>
        </div>
      </section>

      <section className="ops-grid">
        <article className="ops-card hero-ops-card">
          <div className="ops-card-head"><RadioTower size={18}/><span>SOURCE MONITOR</span></div>
          <strong>{status?.target ? `@${status.target.replace(/^@/, "")}` : "Target not configured"}</strong>
          <p>{status?.source_enabled === false ? "Source monitoring is disabled." : "Public seller feed configured for scheduled ingestion."}</p>
          <div className="ops-inline"><span><small>X USER ID</small><b>{status?.x_user_id || "—"}</b></span><span><small>LAST POST CURSOR</small><b>{status?.last_seen_post_id || "—"}</b></span></div>
        </article>

        <article className="ops-card"><div className="ops-card-head"><Clock3 size={18}/><span>POLL CADENCE</span></div><strong>{daytimeMinutes ? `${daytimeMinutes} min` : "—"}</strong><p>Daytime polling interval.</p><div className="ops-footer-value">Night: {nighttimeMinutes ? `${nighttimeMinutes} min` : "—"}</div></article>
        <article className="ops-card"><div className="ops-card-head"><Database size={18}/><span>INDEX</span></div><strong>{overview?.listings_total ?? "—"}</strong><p>Normalized vehicle listings currently available to the frontend.</p><div className="ops-footer-value">{overview?.posts_total ?? 0} source posts</div></article>
        <article className="ops-card"><div className="ops-card-head"><Bot size={18}/><span>AI COVERAGE</span></div><strong>{overview ? `${Math.round(overview.enrichment_rate)}%` : "—"}</strong><p>{status?.ai_provider ? `${status.ai_provider} · ${status.ai_model || "model n/a"}` : "Provider not reported"}</p><div className="ops-footer-value">{overview?.enriched_posts ?? 0} enriched · {status?.ai_failed_posts ?? 0} errors</div></article>
      </section>

      <section className="ops-status-panel">
        <div className="ops-status-head"><div><ServerCog size={18}/><span>Runtime signals</span></div><button type="button" onClick={refresh} disabled={statusQuery.isFetching || overviewQuery.isFetching}><RefreshCw size={15} className={statusQuery.isFetching || overviewQuery.isFetching ? "spin" : ""}/> Refresh</button></div>
        <div className="runtime-list">
          <div><span><Activity size={16}/> API proxy</span><strong className={connected ? "ok" : "bad"}>{connected ? "RESPONDING" : "UNAVAILABLE"}</strong></div>
          <div><span><Bot size={16}/> Enrichment provider</span><strong className={status?.ai_configured ? "ok" : "bad"}>{status?.ai_configured ? `${status.ai_provider?.toUpperCase()} READY` : "NOT CONFIGURED"}</strong></div>
          <div><span><RefreshCw size={16}/> Retry queue</span><strong>{status ? `${status.ai_failed_posts ?? 0} failed · ${status.ai_waiting_posts ?? 0} waiting` : "—"}</strong></div>
          <div><span><ShieldCheck size={16}/> Evidence mode</span><strong className="ok">PROVENANCE-AWARE</strong></div>
          <div><span><Clock3 size={16}/> Timezone</span><strong>{status?.timezone || "Africa/Nairobi"}</strong></div>
          <div><span><Database size={16}/> Latest indexed signal</span><strong>{formatRelativeTime(overview?.latest_post_at)}</strong></div>
        </div>
      </section>

      <section className="system-note"><small>SECURITY BOUNDARY</small><p>This page deliberately exposes no API keys, admin key, ingestion trigger, tunnel token or database credentials. It only reads safe operational status from the backend.</p></section>
    </main>
  );
}
