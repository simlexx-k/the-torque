"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog } from "radix-ui";
import {
  Activity,
  Bookmark,
  CarFront,
  Command,
  Gauge,
  GitCompareArrows,
  Home,
  LayoutGrid,
  Search,
  ServerCog,
  TrendingUp,
  X,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import { fetchJson } from "@/lib/api";
import { vehicleTitle } from "@/lib/format";
import { useVehicleCollections } from "@/lib/useVehicleCollections";

const primaryNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inventory", label: "Inventory", icon: LayoutGrid },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/system", label: "System", icon: ServerCog },
];

const mobileNav = primaryNav.filter((item) => ["/", "/inventory", "/watchlist", "/compare", "/system"].includes(item.href));

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { saved, compare } = useVehicleCollections();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const listingsQuery = useQuery({
    queryKey: ["listings", "command-palette"],
    queryFn: () => fetchJson<Listing[]>("/api/torque/listings?limit=100"),
    staleTime: 60_000,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setCommandOpen(false);
    setCommandQuery("");
  }, [pathname]);

  const commandVehicles = useMemo(() => {
    const needle = commandQuery.trim().toLowerCase();
    if (!needle) return (listingsQuery.data ?? []).slice(0, 5);
    return (listingsQuery.data ?? [])
      .filter((listing) => {
        const haystack = [vehicleTitle(listing), listing.location, listing.body_type, listing.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 6);
  }, [commandQuery, listingsQuery.data]);

  const commandRoutes = useMemo(() => {
    const needle = commandQuery.trim().toLowerCase();
    return primaryNav.filter((item) => !needle || item.label.toLowerCase().includes(needle));
  }, [commandQuery]);

  const navigate = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <div className="app-frame">
      <header className="app-topbar">
        <Link href="/" className="app-brand" aria-label="The Torque home">
          <span className="app-brand-mark"><span /></span>
          <span><strong>THE TORQUE</strong><small>VEHICLE INTELLIGENCE</small></span>
        </Link>

        <nav className="app-nav" aria-label="Primary navigation">
          {primaryNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={isActive(pathname, href) ? "active" : ""}>
              <Icon size={15} />
              <span>{label}</span>
              {href === "/watchlist" && saved.length > 0 && <i>{saved.length}</i>}
              {href === "/compare" && compare.length > 0 && <i>{compare.length}</i>}
            </Link>
          ))}
        </nav>

        <div className="app-topbar-actions">
          <span className="app-live-state"><Activity size={14} /><i /> LIVE</span>
          <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}>
            <Search size={16} /><span>Jump anywhere</span><kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          className="app-content"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <nav className="mobile-dock" aria-label="Mobile navigation">
        {mobileNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(pathname, href) ? "active" : ""}>
            <span className="mobile-dock-icon">
              <Icon size={19} />
              {href === "/watchlist" && saved.length > 0 && <i>{saved.length}</i>}
              {href === "/compare" && compare.length > 0 && <i>{compare.length}</i>}
            </span>
            <small>{label}</small>
          </Link>
        ))}
      </nav>

      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="command-overlay" />
          <Dialog.Content className="command-dialog" aria-describedby={undefined}>
            <div className="command-dialog-head">
              <div><Command size={18} /><Dialog.Title>Torque command</Dialog.Title></div>
              <Dialog.Close asChild><button type="button" aria-label="Close command palette"><X size={17} /></button></Dialog.Close>
            </div>
            <label className="command-search">
              <Search size={18} />
              <input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search pages or indexed vehicles…" />
              <kbd>ESC</kbd>
            </label>

            <div className="command-results">
              {commandRoutes.length > 0 && (
                <section>
                  <small className="command-section-label">NAVIGATION</small>
                  {commandRoutes.map(({ href, label, icon: Icon }) => (
                    <button type="button" key={href} onClick={() => navigate(href)}>
                      <span><Icon size={17} />{label}</span><small>Open page</small>
                    </button>
                  ))}
                </section>
              )}

              <section>
                <small className="command-section-label">VEHICLE INTELLIGENCE</small>
                {commandVehicles.length ? commandVehicles.map((listing) => (
                  <button type="button" key={listing.id} onClick={() => navigate(`/listings/${listing.id}`)}>
                    <span><CarFront size={17} />{vehicleTitle(listing)}</span>
                    <small>{listing.location || listing.status || `#${listing.id}`}</small>
                  </button>
                )) : (
                  <div className="command-empty"><Gauge size={18} /> No matching indexed vehicle.</div>
                )}
              </section>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
