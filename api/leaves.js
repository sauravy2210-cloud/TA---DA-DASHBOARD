/**
 * Server-side employee leave fetch — credentials stay out of the browser bundle.
 * GET /api/leaves?empCode=2225
 * Returns all leave records for the given employee code.
 * Date-range filtering is handled client-side.
 */
export const config = { maxDuration: 10 }; // Vercel Hobby plan hard cap

const BASE = 'https://api.koenig-solutions.com';

// Cache Koenig access tokens per (userName, role) for the lifetime of this warm serverless
// instance — avoids a redundant GetToken round-trip on every request.
const TOKEN_TTL_MS = 10 * 60 * 1000;
const tokenCache = new Map();

async function getToken(userName, userPassword, userRole) {
  const cacheKey = `${userName}::${userRole}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ok: true, content: cached.token };

  const tokenRes = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, userPassword, userRole }),
  });
  if (!tokenRes.ok) return { ok: false, error: `Token endpoint HTTP ${tokenRes.status}` };
  const tokenData = await tokenRes.json();
  if (tokenData.statuscode !== 200) return { ok: false, error: tokenData.message || 'Token failed' };
  tokenCache.set(cacheKey, { token: tokenData.content, expiresAt: Date.now() + TOKEN_TTL_MS });
  return { ok: true, content: tokenData.content };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const raw     = String(req.query.empCode || '').trim();
  const empCode = raw.replace(/^EMP-/i, '').trim();

  if (!empCode) {
    return res.status(400).json({ error: 'empCode is required' });
  }

  try {
    // Step 1 — get token (cached across warm invocations)
    const tokenResult = await getToken(
      process.env.KOENIG_LEAVE_USER || '',
      process.env.KOENIG_LEAVE_PASS || '',
      'Get Employee Leave Details'
    );
    if (!tokenResult.ok) {
      return res.status(502).json({ error: tokenResult.error });
    }
    const { accessToken, deviceToken } = tokenResult.content;

    // Step 2 — fetch leave records (send emp_code; API returns all leaves for employee)
    const dataUrl =
      `${BASE}/api/Kites/Operator/common` +
      `?apikey=237` +
      `&accessToken=${encodeURIComponent(accessToken)}` +
      `&deviceToken=${encodeURIComponent(deviceToken)}`;

    // Try numeric emp_code first (most APIs expect integer)
    const codeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;

    const dataRes = await fetch(dataUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emp_code: codeValue }),
    });

    if (!dataRes.ok) {
      return res.status(502).json({ error: `Leave API HTTP ${dataRes.status}` });
    }

    const data = await dataRes.json();

    if (data.statuscode !== 200) {
      return res.status(200).json({ leaves: [] }); // no leaves — not an error
    }

    let content = data.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch { content = []; }
    }
    if (!Array.isArray(content)) content = [];

    return res.status(200).json({ leaves: content });

  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
