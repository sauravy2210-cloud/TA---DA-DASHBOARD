export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Build path from catch-all segments (more reliable than req.url on Vercel)
  const segments = req.query.path;
  const pathStr = Array.isArray(segments)
    ? segments.join('/')
    : (typeof segments === 'string' ? segments : '');

  // Rebuild query string — exclude the catch-all 'path' key
  const qp = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (Array.isArray(val)) val.forEach(v => qp.append(key, v));
    else qp.set(key, val);
  }
  const qs = qp.toString();
  const targetUrl = `https://api.koenig-solutions.com/${pathStr}${qs ? '?' + qs : ''}`;

  try {
    const opts = {
      method: req.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Host': 'api.koenig-solutions.com',
      },
    };

    if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      opts.body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, opts);
    const text = await upstream.text();

    // Always respond as JSON
    res.setHeader('Content-Type', 'application/json');
    try {
      return res.status(upstream.status).json(JSON.parse(text));
    } catch {
      // Upstream sent HTML / non-JSON — wrap it so callers get a parseable response
      return res.status(502).json({
        statuscode: 0,
        message: `API returned non-JSON (HTTP ${upstream.status})`,
        raw: text.slice(0, 300),
      });
    }
  } catch (err) {
    return res.status(502).json({
      statuscode: 0,
      message: `Proxy error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
