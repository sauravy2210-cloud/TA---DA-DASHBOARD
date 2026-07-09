export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // req.url = /api/proxy/api/Kites/Operator/GetToken?accessToken=...
  // Strip the /api/proxy prefix to get the real path
  const rawUrl = req.url || '';
  const stripped = rawUrl.replace(/^\/api\/proxy/, '') || '/';
  const targetUrl = `https://api.koenig-solutions.com${stripped}`;

  try {
    const fetchOpts = {
      method: req.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Host': 'api.koenig-solutions.com',
      },
    };

    if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOpts);
    const text = await upstream.text();

    res.setHeader('Content-Type', 'application/json');
    try {
      const json = JSON.parse(text);
      res.status(upstream.status).json(json);
    } catch {
      // Upstream returned non-JSON (e.g. HTML error page)
      res.status(502).json({
        statuscode: 0,
        message: `Upstream returned non-JSON response (HTTP ${upstream.status})`,
      });
    }
  } catch (err) {
    res.status(502).json({
      statuscode: 0,
      message: `Proxy error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
