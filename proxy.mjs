// CAPPI local dev server + BrandFetch proxy
// Hält den BrandFetch-Key server-side (genau wie die spätere Next.js /api/brand Route).
// Start: node proxy.mjs   →   http://localhost:4747
import { createServer } from 'http';
import { readFile, appendFile, mkdir, writeFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const KEY = process.env.BRANDFETCH_KEY || ''; // lokal via .env.local / `vercel env pull` setzen
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN || '';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'sokke'; // {domain}.pipedrive.com
const RESEND_KEY = process.env.RESEND_KEY || '';
const LEAD_NOTIFY = process.env.LEAD_NOTIFY || 'hello@cappi.ch';
const PORT = 4747;
const ROOT = process.cwd();

function readBody(req, limit = 28 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Persist lead locally (leads.jsonl) + save uploaded logo to leads/ folder
async function storeLead(lead) {
  await mkdir(join(ROOT, 'leads'), { recursive: true });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (lead.logo_file && lead.logo_file.data) {
    try {
      const m = /^data:(.+?);base64,(.*)$/.exec(lead.logo_file.data);
      if (m) {
        const ext = (lead.logo_file.name || '').split('.').pop() || 'png';
        const fname = `${id}-${(lead.company || 'logo').replace(/[^a-z0-9]/gi, '_')}.${ext}`;
        await writeFile(join(ROOT, 'leads', fname), Buffer.from(m[2], 'base64'));
        lead.logo_saved = 'leads/' + fname;
      }
    } catch { /* ignore */ }
  }
  const record = { id, ...lead };
  delete record.logo_file; // don't bloat the jsonl with base64
  await appendFile(join(ROOT, 'leads.jsonl'), JSON.stringify(record) + '\n');
  return record;
}

// Optional: create a Pipedrive deal (only if token configured)
async function forwardToPipedrive(lead) {
  if (!PIPEDRIVE_TOKEN) return;
  const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
  try {
    // 1) person
    const pRes = await fetch(`${base}/persons?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: lead.name || lead.company, email: [lead.email], phone: lead.phone ? [lead.phone] : undefined }),
    });
    const person = await pRes.json();
    const personId = person && person.data && person.data.id;
    // 2) deal
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

// Optional: notification email via Resend (only if key configured)
async function notifyEmail(lead) {
  if (!RESEND_KEY) return;
  const rows = Object.entries(lead)
    .filter(([k]) => !['logo_file'].includes(k))
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/babel; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
};

async function proxyBrandfetch(res, target) {
  try {
    const r = await fetch(target, { headers: { Authorization: 'Bearer ' + KEY } });
    const body = await r.text();
    res.writeHead(r.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end('{"error":"upstream failed"}');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // --- BrandFetch: full brand object (logos, colors, name) ---
  if (url.pathname === '/api/brand') {
    const domain = (url.searchParams.get('domain') || '').trim();
    if (!domain) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end('{"error":"missing domain"}');
      return;
    }
    await proxyBrandfetch(res, 'https://api.brandfetch.io/v2/brands/' + encodeURIComponent(domain));
    return;
  }

  // --- Lead capture (form submit) ---
  if (url.pathname === '/api/lead' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const lead = JSON.parse(raw || '{}');
      const record = await storeLead(lead);
      // Forward in background — don't block the response
      forwardToPipedrive(record);
      notifyEmail(record);
      console.log(`Lead gespeichert: ${record.company || record.name} <${record.email}> (${record.cz_qty || '?'} ${record.cz_model || ''})`);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, id: record.id }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // --- BrandFetch: search / autocomplete ---
  if (url.pathname === '/api/brand-search') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end('[]');
      return;
    }
    await proxyBrandfetch(res, 'https://api.brandfetch.io/v2/search/' + encodeURIComponent(q));
    return;
  }

  // --- Static files ---
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`CAPPI on http://localhost:${PORT}`));
