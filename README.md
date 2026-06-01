# CAPPI — Custom Caps für Firmen

Landing Page & Konfigurator für CAPPI (Custom Caps, Made in Europa ab 50 Stück).
Schwestermarke von [Sokke](https://sokke.ch) — Relate Commerce GmbH.

## Stack
- Statisches Frontend: HTML / CSS / Vanilla JS
- Vercel Serverless Functions (`api/`) für BrandFetch-Proxy & Lead-Capture
- Telefon-Validierung via `intl-tel-input` (libphonenumber)

## Lokale Entwicklung
```bash
# BrandFetch-Key bereitstellen (z. B. via Vercel)
vercel env pull .env.local

# Lokaler Dev-Server + API-Proxy
node proxy.mjs
# -> http://localhost:4747
```

## Deployment
Deployt auf Vercel (`cappi-psi.vercel.app`).
```bash
vercel --prod
```

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
index.html        # Landing Page + Konfigurator
app.js            # Konfigurator-Logik, BrandFetch, Form, Tracking
styles.css        # Styling (dark theme)
api/              # Vercel Serverless Functions
  brand.js        # BrandFetch Brand-Lookup (server-side key)
  brand-search.js # BrandFetch Suche
  lead.js         # Lead-Capture → Pipedrive / Resend
proxy.mjs         # Lokaler Dev-Server + API-Proxy
assets/           # Logos, Bilder
```
