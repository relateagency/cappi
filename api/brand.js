// Vercel Serverless Function — BrandFetch brand lookup (logos, colors, name).
// Hält den BrandFetch-Key server-side. Key via Env BRANDFETCH_KEY (Fallback: Pro-Key).
const KEY = process.env.BRANDFETCH_KEY || '';

module.exports = async (req, res) => {
  const domain = ((req.query && req.query.domain) || '').toString().trim();
  if (!domain) {
    res.status(400).json({ error: 'missing domain' });
    return;
  }
  try {
    const r = await fetch('https://api.brandfetch.io/v2/brands/' + encodeURIComponent(domain), {
      headers: { Authorization: 'Bearer ' + KEY },
    });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(r.status).send(body);
  } catch {
    res.status(502).json({ error: 'upstream failed' });
  }
};
