import { LANDING_HTML } from "./landing-markup";

// Die Landing Page wird (Phase 1 der Next.js-Migration) als serverseitig
// gerendertes Markup ausgeliefert. Styling: app/globals.css. Interaktivitaet:
// /public/app.js (Konfigurator, BrandFetch, Formular, Tracking).
// Naechster Schritt: schrittweise Aufteilung in typisierte React-Komponenten.
export default function Home() {
  return <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />;
}
