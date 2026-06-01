# CAPPI — Custom Caps für Firmen

Landing Page & Konfigurator für CAPPI (Custom Caps, Made in Europa ab 50 Stück).
Schwestermarke von [Sokke](https://sokke.ch) — Relate Commerce GmbH.

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript** — gleicher Stack wie das Sokke-Dashboard
- API als Next.js **Route Handlers** (`app/api/`) für BrandFetch-Proxy & Lead-Capture
- Telefon-Validierung via `intl-tel-input` (libphonenumber)
- Deployment auf **Vercel**

## Lokale Entwicklung
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. BrandFetch-Key bereitstellen (Key bekommst du von Luca)
echo "BRANDFETCH_KEY=DER_KEY" > .env.local

# 3. Dev-Server starten
npm run dev
# -> http://localhost:4747
```

## Deployment
Auto-Deploy via Git-Integration auf Vercel: Push auf `main` → Production,
jeder Branch / PR → eigene Preview-URL.

## Environment-Variablen (Vercel)
| Variable | Zweck |
|----------|-------|
| `BRANDFETCH_KEY` | BrandFetch Pro API-Key (Logo/Farben) |
| `PIPEDRIVE_TOKEN` | Pipedrive API-Token (Lead → Deal) — optional |
| `PIPEDRIVE_DOMAIN` | Pipedrive-Subdomain (Default: `sokke`) |
| `RESEND_KEY` | Resend API-Key für Lead-Benachrichtigungen — optional |
| `LEAD_NOTIFY` | Empfänger-Adresse für Lead-Mails (Default: `hello@cappi.ch`) |

## Struktur
```
app/
  layout.tsx          # Root-Layout (Fonts, Metadata, Scripts)
  page.tsx            # Landing Page
  globals.css         # gesamtes Styling (Dark Theme, CSS-Variablen)
  landing-markup.ts   # Landing-Markup (Phase 1 der Migration)
  api/
    brand/route.ts        # BrandFetch Brand-Lookup (server-side key)
    brand-search/route.ts # BrandFetch Suche
    lead/route.ts         # Lead-Capture → Pipedrive / Resend
public/
  app.js              # Konfigurator-Logik, BrandFetch, Formular, Tracking
  assets/             # Cap-Bilder, Logos, Icons, SVGs
```

> Hinweis: Die Landing Page wurde von statischem HTML auf Next.js migriert.
> Phase 1 liefert das Markup serverseitig (verlustfrei). Nächster Schritt:
> schrittweise Aufteilung in typisierte React-Komponenten.
