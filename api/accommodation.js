/**
 * Server-side trainer accommodation fetch.
 * GET /api/accommodation?empCode=2225        → API 257 (empCode-based, CreateTADABill)
 * GET /api/accommodation?email=x@koenig.com  → API 120 (email-based, CreateClaim)
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

async function callCommon(apikey, tok, body) {
  const url =
    `${BASE}/api/Kites/Operator/common` +
    `?apikey=${apikey}` +
    `&accessToken=${encodeURIComponent(tok.accessToken)}` +
    `&deviceToken=${encodeURIComponent(tok.deviceToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${apikey} HTTP ${res.status}`);
  const d = await res.json();
  if (d.statuscode !== 200) throw new Error(d.message || `API ${apikey} failed`);
  let raw = d.content;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
  return Array.isArray(raw) ? raw : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const empCode = String(req.query.empCode || '').replace(/^EMP-/i, '').trim();
  const email   = String(req.query.email   || '').trim();

  if (!empCode && !email) return res.status(400).json({ error: 'empCode or email is required' });

  try {
    if (email) {
      // API 120 — email-based (used by CreateClaim)
      const tok = await getToken(
        process.env.KOENIG_ACCOM120_USER || '',
        process.env.KOENIG_ACCOM120_PASS || '',
        'Trainer Accomodation Details'
      );
      const data = await callCommon(120, tok, { Email: email });
      return res.status(200).json({ accommodation: data });
    } else {
      // API 257 — empCode-based (used by CreateTADABill)
      const empCodeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;
      const tok = await getToken(
        process.env.KOENIG_ACCOM_USER || '',
        process.env.KOENIG_ACCOM_PASS || '',
        'Get Trainer Accommodation Details'
      );
      const data = await callCommon(257, tok, { koenig_trainer_emp_code: empCodeValue });
      return res.status(200).json({ accommodation: data });
    }
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
