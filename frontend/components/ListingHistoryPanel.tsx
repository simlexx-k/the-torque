"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "radix-ui";
import { CalendarClock, History, Repeat2, TrendingDown, TrendingUp, X } from "lucide-react";
import type { ListingHistory } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { formatNumber, formatPrice } from "@/lib/format";

function chartPoints(history: ListingHistory) {
  const priced = history.observations.filter((item) => typeof item.price === "number" && item.price! > 0);
  if (!priced.length) return { priced, points: "" };
  const prices = priced.map((item) => item.price as number);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = Math.max(1, max - min);
  const width = 520;
  const height = 150;
  const points = priced.map((item, index) => {
    const x = priced.length === 1 ? width / 2 : (index / (priced.length - 1)) * width;
    const y = height - (((item.price as number) - min) / spread) * 112 - 19;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return { priced, points };
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function ListingHistoryPanel({ id, inline = false }: { id: string; inline?: boolean }) {
  const historyQuery = useQuery({
    queryKey: ["listing-history", id],
    queryFn: () => fetchJson<ListingHistory>(`/api/torque/listings/${encodeURIComponent(id)}/history`),
    staleTime: 60_000,
  });
  const history = historyQuery.data;
  const chart = useMemo(() => history ? chartPoints(history) : { priced: [], points: "" }, [history]);

  if (historyQuery.isPending || historyQuery.error || !history) return null;

  const movement = history.price_change ?? 0;
  const movementDown = movement < 0;
  const movementUp = movement > 0;
  const currency = chart.priced.at(-1)?.currency || "KES";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className={`listing-history-trigger${inline ? " inline" : ""}${movementDown ? " price-down" : ""}`}>
          <History size={16}/>
          <span><small>PRICE HISTORY</small><strong>{history.observations.length} {history.observations.length === 1 ? "observation" : "observations"}</strong></span>
          {movementDown && <b>{formatPrice(Math.abs(movement), currency)} lower</b>}
          {movementUp && <b className="price-up">{formatPrice(Math.abs(movement), currency)} higher</b>}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="history-sheet-overlay" />
        <Dialog.Content className="history-sheet" aria-describedby={undefined}>
          <Dialog.Title className="history-sheet-title">Listing history</Dialog.Title>
          <Dialog.Close className="history-sheet-close" aria-label="Close listing history"><X size={18}/></Dialog.Close>

          <div className="history-sheet-heading">
            <div><small>MARKET MEMORY</small><h2>What changed since we first saw it.</h2></div>
            {movementDown ? <TrendingDown size={28}/> : movementUp ? <TrendingUp size={28}/> : <History size={28}/>}
          </div>

          <div className="history-metrics">
            <article><CalendarClock size={16}/><small>FIRST SEEN</small><strong>{shortDate(history.first_seen_at)}</strong></article>
            <article><History size={16}/><small>OBSERVED SPAN</small><strong>{history.days_listed} days</strong></article>
            <article><Repeat2 size={16}/><small>REPOSTS</small><strong>{history.repost_count}</strong></article>
            <article className={movementDown ? "down" : movementUp ? "up" : ""}><small>PRICE MOVEMENT</small><strong>{movement === 0 ? "No change" : `${movementDown ? "−" : "+"}${formatPrice(Math.abs(movement), currency)}`}</strong><span>{history.price_change_percent ? `${history.price_change_percent > 0 ? "+" : ""}${history.price_change_percent}%` : "From first observation"}</span></article>
          </div>

          <div className="history-chart-card">
            <div className="history-chart-head">
              <span><small>FIRST OBSERVED</small><strong>{formatPrice(history.first_price, currency)}</strong></span>
              <span><small>LATEST OBSERVED</small><strong>{formatPrice(history.latest_price, currency)}</strong></span>
            </div>
            {chart.points ? (
              <svg className="history-chart" viewBox="0 0 520 150" role="img" aria-label="Observed asking price history">
                <line x1="0" y1="130" x2="520" y2="130" className="history-chart-axis" />
                <polyline points={chart.points} fill="none" className="history-chart-line" vectorEffect="non-scaling-stroke" />
                {chart.points.split(" ").map((point, index) => {
                  const [cx, cy] = point.split(",");
                  return <circle key={`${cx}-${cy}-${index}`} cx={cx} cy={cy} r="4" className="history-chart-dot" />;
                })}
              </svg>
            ) : <p className="history-no-price">No asking price was available for these observations.</p>}
          </div>

          <div className="history-timeline">
            {history.observations.map((item, index) => (
              <div key={`${item.observed_at}-${index}`}>
                <i />
                <span><strong>{shortDate(item.observed_at)}</strong><small>{item.status.replaceAll("_", " ")}</small></span>
                <span><strong>{formatPrice(item.price, item.currency)}</strong><small>{item.mileage_km ? `${formatNumber(item.mileage_km)} km` : "Mileage not stated"}</small></span>
              </div>
            ))}
          </div>

          <p className="history-note">History reflects observations captured by The Torque from seller posts. A repost match is deliberately conservative and should not be treated as proof of vehicle identity.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
