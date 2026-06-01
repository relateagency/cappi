import { NextRequest, NextResponse } from "next/server";

// Lead-Capture (Mockup-Anfrage). Leitet optional an Pipedrive + Resend weiter
// (nur wenn Env-Variablen gesetzt sind). Serverless-FS ist ephemer — Leads
// werden NICHT lokal gespeichert, sondern weitergeleitet.
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN || "";
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || "sokke";
// Resend: nutzt die bestehende Sokke-Integration (RESEND_API_KEY). Absender muss
// eine in Resend verifizierte Domain sein — Default sokke.ch (cappi.ch ggf. spaeter verifizieren).
const RESEND_KEY = process.env.RESEND_API_KEY || process.env.RESEND_KEY || "";
const LEAD_FROM = process.env.LEAD_FROM || "CAPPI <info@sokke.ch>";
const LEAD_NOTIFY = process.env.LEAD_NOTIFY || "hello@cappi.ch";

type Lead = Record<string, unknown>;

async function forwardToPipedrive(lead: Lead) {
  if (!PIPEDRIVE_TOKEN) return;
  const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
  try {
    const pRes = await fetch(`${base}/persons?api_token=${PIPEDRIVE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: lead.name || lead.company,
        email: lead.email ? [lead.email] : undefined,
        phone: lead.phone ? [lead.phone] : undefined,
      }),
    });
    const person = await pRes.json();
    const personId = person?.data?.id;
    const title = `[CAPPI] ${lead.company || lead.name} — ${lead.cz_qty || ""} ${
      lead.cz_model || ""
    }`.trim();
    await fetch(`${base}/deals?api_token=${PIPEDRIVE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        person_id: personId || undefined,
        value: lead.cz_total_price || undefined,
        currency: "EUR",
      }),
    });
  } catch (e) {
    console.error("Pipedrive forward failed:", (e as Error).message);
  }
}

async function notifyEmail(lead: Lead) {
  if (!RESEND_KEY) return;
  const rows = Object.entries(lead)
    .filter(([k]) => k !== "logo_file")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 10px;color:#888">${k}</td><td style="padding:4px 10px"><b>${
          typeof v === "object" ? JSON.stringify(v) : v
        }</b></td></tr>`
    )
    .join("");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: LEAD_FROM,
        to: [LEAD_NOTIFY],
        reply_to: typeof lead.email === "string" ? lead.email : undefined,
        subject: `Neue CAPPI-Anfrage: ${lead.company || lead.name}`,
        html: `<h2>Neue Mockup-Anfrage</h2><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`,
      }),
    });
    if (!r.ok) {
      console.error("Resend notify rejected:", r.status, await r.text());
    }
  } catch (e) {
    console.error("Resend notify failed:", (e as Error).message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const lead = (await req.json()) as Lead;
    await Promise.allSettled([forwardToPipedrive(lead), notifyEmail(lead)]);
    console.log(
      `CAPPI Lead: ${lead.company || lead.name} <${lead.email}> (${lead.cz_qty || "?"} ${
        lead.cz_model || ""
      })`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
