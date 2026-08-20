"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ImageIcon,
  LoaderCircle,
  MessagesSquare,
  RadioTower,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { fetchJson } from "@/lib/api";
import { fetchAllPosts } from "@/lib/catalog";
import { formatRelativeTime } from "@/lib/format";
import type { TorqueStatus } from "@/lib/types";

const filters = [
  ["all", "All signals"],
  ["complete", "Enriched"],
  ["thread_merged", "Thread replies"],
  ["error", "AI errors"],
  ["waiting_for_ai_key", "Waiting"],
  ["skipped", "Skipped"],
] as const;

function StatusIcon({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle2 size={15} />;
  if (status === "thread_merged") return <MessagesSquare size={15} />;
  if (status === "error") return <AlertTriangle size={15} />;
  if (status === "waiting_for_ai_key") return <Clock3 size={15} />;
  if (status === "pending") return <LoaderCircle size={15} className="spin" />;
  return <RadioTower size={15} />;
}

export default function SignalFeedPage() {
  const [filter, setFilter] = useState("all");
  const postsQuery = useQuery({
    queryKey: ["posts", "all-pages"],
    queryFn: () => fetchAllPosts(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const statusQuery = useQuery({
    queryKey: ["status"],
    queryFn: () => fetchJson<TorqueStatus>("/api/torque/status"),
    refetchInterval: 60_000,
  });

  const posts = postsQuery.data ?? [];
  const visible = useMemo(
    () => posts.filter((post) => filter === "all" || post.ai_status === filter),
    [filter, posts],
  );
  const status = statusQuery.data;

  return (
    <main className="product-page signal-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>02</span> SOURCE SIGNALS</div>
          <h1>Every post.<br/><em>Nothing disappears.</em></h1>
          <p>
            Raw X signals are visible here before, during and after multimodal enrichment. Same-dealer thread replies are retained as source records while their details are merged into the root vehicle signal.
          </p>
        </div>
        <div className="signal-provider-card">
          <Sparkles size={21} />
          <span><small>ENRICHMENT PROVIDER</small><strong>{status?.ai_provider || "—"}</strong><em>{status?.ai_model || "Not configured"}</em></span>
        </div>
      </section>

      <section className="signal-summary-strip">
        <article><small>CAPTURED</small><strong>{posts.length}</strong><span>loaded source signals</span></article>
        <article><small>ENRICHED</small><strong>{posts.filter((p) => p.ai_status === "complete").length}</strong><span>normalized successfully</span></article>
        <article className={(status?.ai_failed_posts || 0) > 0 ? "attention" : ""}><small>AI ERRORS</small><strong>{status?.ai_failed_posts ?? 0}</strong><span>automatic retry eligible</span></article>
        <article><small>SOURCES</small><strong>{status?.source_count ?? status?.sources?.length ?? 0}</strong><span>tracked X accounts</span></article>
      </section>

      <section className="signal-workbench">
        <div className="signal-filter-row">
          <div className="signal-filter-tabs">
            {filters.map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="signal-refresh" onClick={() => postsQuery.refetch()} disabled={postsQuery.isFetching}>
            <RotateCcw size={14} className={postsQuery.isFetching ? "spin" : ""} /> Refresh feed
          </button>
        </div>

        {postsQuery.isPending ? (
          <div className="signal-empty"><LoaderCircle className="spin" /> Loading seller signals…</div>
        ) : postsQuery.error ? (
          <div className="signal-empty error"><AlertTriangle /> Unable to load the captured-post feed.</div>
        ) : visible.length === 0 ? (
          <div className="signal-empty"><RadioTower /> No posts match this signal state.</div>
        ) : (
          <div className="signal-feed-list">
            {visible.map((post, index) => (
              <motion.article
                className={`signal-record signal-${post.ai_status}`}
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.025, 0.2) }}
              >
                <div className="signal-record-meta">
                  <span className={`signal-state signal-state-${post.ai_status}`}><StatusIcon status={post.ai_status} />{post.ai_status.replaceAll("_", " ")}</span>
                  <span>@{post.source?.username || "unknown"}</span>
                  <span>#{String(post.id).padStart(4, "0")}</span>
                  <span>{formatRelativeTime(post.created_at)}</span>
                  <span>{post.classification.replaceAll("_", " ")}</span>
                </div>

                <div className="signal-record-grid">
                  <div className="signal-copy">
                    <p>{post.text}</p>
                    <div className="signal-record-stats">
                      <span><ImageIcon size={13} /> {post.media.length} media</span>
                      <span><Sparkles size={13} /> {post.listing_count} listings</span>
                      {post.thread_root_x_post_id && post.thread_root_x_post_id !== post.x_post_id && <span><MessagesSquare size={13}/> thread {post.thread_root_x_post_id.slice(-6)}</span>}
                      {post.ai_attempts !== undefined && <span><RotateCcw size={13} /> {post.ai_attempts} attempts</span>}
                    </div>
                    {post.ai_error && (
                      <div className="signal-error-box">
                        <AlertTriangle size={15} />
                        <span><strong>Last enrichment error</strong>{post.ai_error}</span>
                      </div>
                    )}
                    <div className="signal-record-footer">
                      <span>{post.ai_provider ? `${post.ai_provider} · ${post.ai_model || "model n/a"}` : post.ai_status === "thread_merged" ? "Merged into root thread context" : "No completed AI attempt"}</span>
                      <Link href={post.x_url} target="_blank" rel="noreferrer">Open source post <ArrowUpRight size={14} /></Link>
                    </div>
                  </div>

                  {post.media.length > 0 && (
                    <div className={`signal-media-grid count-${Math.min(post.media.length, 4)}`}>
                      {post.media.slice(0, 4).map((media, mediaIndex) => {
                        const src = media.url || media.preview_image_url;
                        return src ? <img key={`${post.id}-${mediaIndex}`} src={src} alt={`Source media ${mediaIndex + 1}`} loading="lazy" /> : null;
                      })}
                    </div>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
