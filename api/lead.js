// Vercel Serverless Function — Lead capture (Mockup-Anfrage).
// Leitet optional an Pipedrive + Resend weiter (nur wenn Env-Variablen gesetzt sind).
// Hinweis: Serverless-FS ist ephemer — Leads NICHT lokal speichern, sondern weiterleiten.
const PIPEDRIVE_TOKEN  = process.env.PIPEDRIVE_TOKEN  || '';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'sokke';
const RESEND_KEY       = process.env.RESEND_KEY       || '';
const LEAD_NOTIFY      = process.env.LEAD_NOTIFY      || 'hello@cappi.ch';

async function forwardToPipedrive(lead) {
  if (!PIPEDRIVE_TOKEN) return;
  const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
  try {
    const pRes = await fetch(`${base}/persons?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name || lead.company,
        email: lead.email ? [lead.email] : undefined,
        phone: lead.phone ? [lead.phone] : undefined,
      }),
    });
    const person = await pRes.json();
    const personId = person && person.data && person.data.id;
    const title = `[CAPPI] ${lead.company || lead.name} — ${lead.cz_qty || ''} ${lead.cz_model || ''}`.trim();
    await fetch(`${base}/deals?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        person_id: personId || undefined,
        value: lead.cz_total_price || undefined,
        currency: 'EUR',
      }),
    });
  } catch (e) { console.error('Pipedrive forward failed:', e.message); }
}

async function notifyEmail(lead) {
  if (!RESEND_KEY) return;
  const rows = Object.entries(lead)
    .filter(([k]) => k !== 'logo_file')
    .map(([k, v]) => `<tr><td style="padding:4px 10px;color:#888">${k}</td><td style="padding:4px 10px"><b>${typeof v === 'object' ? JSON.stringify(v) : v}</b></td></tr>`)
    .join('');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CAPPI <noreply@cappi.ch>', to: [LEAD_NOTIFY],
        subject: `Neue CAPPI-Anfrage: ${lead.company || lead.name}`,
        html: `<h2>Neue Mockup-Anfrage</h2><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`,
      }),
    });
  } catch (e) { console.error('Resend notify failed:', e.message); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  try {
    const lead = (req.body && typeof req.body === 'object') ? req.body : JSON.parse(req.body || '{}');
    await Promise.allSettled([forwardToPipedrive(lead), notifyEmail(lead)]);
    console.log(`CAPPI Lead: ${lead.company || lead.name} <${lead.email}> (${lead.cz_qty || '?'} ${lead.cz_model || ''})`);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
