// Vercel Serverless Function — BrandFetch search / autocomplete.
const KEY = process.env.BRANDFETCH_KEY || '';

module.exports = async (req, res) => {
  const q = ((req.query && req.query.q) || '').toString().trim();
  if (q.length < 2) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send('[]');
    return;
  }
  try {
    const r = await fetch('https://api.brandfetch.io/v2/search/' + encodeURIComponent(q), {
      headers: { Authorization: 'Bearer ' + KEY },
    });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(r.status).send(body);
  } catch {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send('[]');
  }
};
