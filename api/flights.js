/**
 * Server-side flight fetch — credentials never reach the browser bundle.
 * GET /api/flights?email=...&empCode=...
 * Tries API 108 (email-based) first, falls back to API 256 (empCode-based).
 */
export const config = { maxDuration: 30 };

const BASE = 'https://api.koenig-solutions.com';

async function getTokens(userName, userPassword, userRole) {
  const r = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, userPassword, userRole }),
  });
  if (!r.ok) throw new Error(`Token endpoint HTTP ${r.status}`);
  const d = await r.json();
  if (d.statuscode !== 200) throw new Error(d.message || 'Token failed');
  return d.content;
}

async function apiCall(apikey, userName, userPassword, userRole, body) {
  const { accessToken, deviceToken } = await getTokens(userName, userPassword, userRole);
  const url = `${BASE}/api/Kites/Operator/common` +
    `?apikey=${apikey}` +
    `&accessToken=${encodeURIComponent(accessToken)}` +
    `&deviceToken=${encodeURIComponent(deviceToken)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${apikey} HTTP ${r.status}`);
  const d = await r.json();
  if (d.statuscode !== 200) throw new Error(d.message || `API ${apikey} failed`);
  const raw = typeof d.content === 'string' ? JSON.parse(d.content) : d.content;
  return Array.isArray(raw) ? raw : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const email   = String(req.query.email   || '').trim();
  // Strip EMP- prefix, ensure clean numeric or string code
  const rawCode = String(req.query.empCode || '').trim();
  const empCode = rawCode.replace(/^EMP-/i, '').trim();

  if (!email && !empCode) {
    return res.status(400).json({ flights: [], error: 'email or empCode required' });
  }

  let flights = [];

  // 1. Try email-based API 108
  if (email) {
    try {
      flights = await apiCall(
        108,
        process.env.KOENIG_U1 || 'Saurav_TrainerFlightDe',
        process.env.KOENIG_P1 || '',
        'Trainer Flight Details',
        { email_Address: email }
      );
    } catch { flights = []; }
  }

  // 2. Fallback: emp-code-based API 256
  if (flights.length === 0 && empCode) {
    const code = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;
    try {
      flights = await apiCall(
        256,
        process.env.KOENIG_U2 || 'Saurav_GetTrainerFligh',
        process.env.KOENIG_P2 || '',
        'Get Trainer Flight Details',
        { koenig_trainer_emp_code: code }
      );
    } catch { flights = []; }
  }

  return res.status(200).json({ flights });
}
