import Link from "next/link";
import { ArrowLeft, Gauge } from "lucide-react";

export default function NotFound() {
  return (
    <main className="product-page">
      <section className="product-state" style={{ minHeight: "calc(100vh - 170px)" }}>
        <div className="state-icon-orbit"><Gauge size={25}/></div>
        <small>404 / SIGNAL NOT FOUND</small>
        <h2>This intelligence file is off the map.</h2>
        <p>The route may have changed, or the indexed vehicle may no longer exist.</p>
        <Link href="/inventory" className="product-primary-button"><ArrowLeft size={16}/> Return to inventory</Link>
      </section>
    </main>
  );
}
