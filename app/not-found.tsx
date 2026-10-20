export default function NotFound() {
  return (
    <main className="bands">
      <section className="band band-club board-head" style={{ flex: 1 }}>
        <div className="wrap" style={{ gap: 18 }}>
          <h1 className="display">Offside</h1>
          <p className="text-2" style={{ margin: 0, fontSize: 18, maxWidth: "60ch" }}>
            That page, player or match isn&apos;t here. Matches only exist once the site has saved them.
          </p>
          <a href="/" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2 4 7l5 5" /></svg>
            Back to the club
          </a>
        </div>
      </section>
    </main>
  );
}
