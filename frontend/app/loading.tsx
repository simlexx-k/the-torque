export default function Loading() {
  return (
    <main className="product-page">
      <section className="page-hero compact-page-hero">
        <div>
          <div className="page-kicker"><span>••</span> ACQUIRING SIGNAL</div>
          <h1>Loading vehicle<br/><em>intelligence.</em></h1>
        </div>
      </section>
      <section className="inventory-results-section">
        <div className="vehicle-grid">
          {Array.from({ length: 6 }).map((_, index) => <div className="vehicle-card skeleton-card" key={index}><div/><span/><span/><span/></div>)}
        </div>
      </section>
    </main>
  );
}
