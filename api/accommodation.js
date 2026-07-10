/**
 * Server-side trainer accommodation fetch.
 * GET /api/accommodation?empCode=2225
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

  const empCode = String(req.query.empCode || '').replace(/^EMP-/i, '').trim();
  if (!empCode) return res.status(400).json({ error: 'empCode is required' });

  const empCodeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;

  try {
    const tok = await getToken(
      process.env.KOENIG_ACCOM_USER || '',
      process.env.KOENIG_ACCOM_PASS || '',
      'Get Trainer Accommodation Details'
    );
    const url =
      `${BASE}/api/Kites/Operator/common` +
      `?apikey=257` +
      `&accessToken=${encodeURIComponent(tok.accessToken)}` +
      `&deviceToken=${encodeURIComponent(tok.deviceToken)}`;
    const dataRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ koenig_trainer_emp_code: empCodeValue }),
    });
    if (!dataRes.ok) throw new Error(`API 257 HTTP ${dataRes.status}`);
    const d = await dataRes.json();
    if (d.statuscode !== 200) throw new Error(d.message || 'API 257 failed');
    let raw = d.content;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
    return res.status(200).json({ accommodation: Array.isArray(raw) ? raw : [] });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
