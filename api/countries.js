/**
 * Server-side country list fetch.
 * GET /api/countries
 */
export const config = { maxDuration: 30 };

const BASE = 'https://api.koenig-solutions.com';

async function getToken(userName, userPassword, userRole) {
  const res = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, userPassword, userRole }),
  });
  if (!res.ok) throw new Error(`Token HTTP ${res.status}`);
  const d = await res.json();
  if (d.statuscode !== 200) throw new Error(d.message || 'Token failed');
  return d.content;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const tok = await getToken(
      process.env.KOENIG_CTRY_USER || '',
      process.env.KOENIG_CTRY_PASS || '',
      'Get Country List'
    );
    const url =
      `${BASE}/api/Kites/Operator/common` +
      `?apikey=223` +
      `&accessToken=${encodeURIComponent(tok.accessToken)}` +
      `&deviceToken=${encodeURIComponent(tok.deviceToken)}`;
    const dataRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CountryName: '' }),
    });
    if (!dataRes.ok) throw new Error(`API 223 HTTP ${dataRes.status}`);
    const d = await dataRes.json();
    if (d.statuscode !== 200) throw new Error(d.message || 'API 223 failed');
    let raw = d.content;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
    const countries = Array.isArray(raw) ? raw.filter(c => c.CountryName) : [];
    return res.status(200).json({ countries });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
