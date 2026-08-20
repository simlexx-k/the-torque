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
  TrendingUp,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchAllListings } from "@/lib/catalog";
import { vehicleTitle } from "@/lib/format";
import { listingCollectionKey, listingHref, listingShortReference } from "@/lib/listingRef";
import { useVehicleCollections } from "@/lib/useVehicleCollections";

const primaryNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inventory", label: "Listings", icon: LayoutGrid },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

const mobileNav = primaryNav;

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
  const year = new Date().getFullYear();

  const listingsQuery = useQuery({
    queryKey: ["listings", "all-pages"],
    queryFn: () => fetchAllListings(),
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
          <span><strong>THE TORQUE</strong><small>VEHICLE LISTINGS</small></span>
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
          <span className="app-live-state"><Activity size={14} /><i /> CURRENT LISTINGS</span>
          <ThemeToggle />
          <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}>
            <Search size={16} /><span>Search vehicles</span><kbd>⌘K</kbd>
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

      <footer className="torque-footer">
        <div className="torque-footer-main">
          <div className="torque-footer-brand">
            <Link href="/" aria-label="The Torque home">
              <span className="app-brand-mark"><span /></span>
              <span><strong>THE TORQUE</strong><small>Vehicle listings made easier to browse and compare.</small></span>
            </Link>
            <p>Seller-posted vehicles, photos and key details organised into a cleaner buying view.</p>
          </div>

          <nav className="torque-footer-nav" aria-label="Footer navigation">
            <div><small>BROWSE</small><Link href="/inventory">All listings</Link><Link href="/market">Market snapshot</Link></div>
            <div><small>YOUR PICKS</small><Link href="/watchlist">Watchlist</Link><Link href="/compare">Compare vehicles</Link></div>
          </nav>
        </div>

        <div className="torque-footer-bottom">
          <span>The Torque is a product of <strong>A3S Labs</strong>.</span>
          <span>© {year} A3S Labs</span>
          <p>Confirm price, availability, ownership and vehicle condition independently with the seller before making a purchase decision.</p>
        </div>
      </footer>

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
              <div><Command size={18} /><Dialog.Title>Search The Torque</Dialog.Title></div>
              <Dialog.Close asChild><button type="button" aria-label="Close search"><X size={17} /></button></Dialog.Close>
            </div>
            <label className="command-search">
              <Search size={18} />
              <input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search pages or vehicles…" />
              <kbd>ESC</kbd>
            </label>

            <div className="command-results">
              {commandRoutes.length > 0 && (
                <section>
                  <small className="command-section-label">PAGES</small>
                  {commandRoutes.map(({ href, label, icon: Icon }) => (
                    <button type="button" key={href} onClick={() => navigate(href)}>
                      <span><Icon size={17} />{label}</span><small>Open</small>
                    </button>
                  ))}
                </section>
              )}

              <section>
                <small className="command-section-label">VEHICLES</small>
                {commandVehicles.length ? commandVehicles.map((listing) => (
                  <button type="button" key={listingCollectionKey(listing)} onClick={() => navigate(listingHref(listing))}>
                    <span><CarFront size={17} />{vehicleTitle(listing)}</span>
                    <small>{listing.location || `Ref ${listingShortReference(listing)}`}</small>
                  </button>
                )) : (
                  <div className="command-empty"><Gauge size={18} /> No matching vehicle.</div>
                )}
              </section>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
