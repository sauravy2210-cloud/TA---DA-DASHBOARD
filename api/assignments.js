/**
 * Server-side trainer assignment fetch — credentials stay out of the browser bundle.
 * GET /api/assignments?empCode=2225&from=2025-06-01&to=2025-06-30
 * Tries API 258 (emp-code based) first, falls back to API 208 (date-range based).
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
  if (!res.ok) throw new Error(`API ${apikey} data HTTP ${res.status}`);
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

  const empCode  = String(req.query.empCode || '').replace(/^EMP-/i, '').trim();
  const fromDate = String(req.query.from || '').trim();
  const toDate   = String(req.query.to || '').trim();

  if (!empCode) return res.status(400).json({ error: 'empCode is required' });

  const empCodeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;

  const asgnUser    = process.env.KOENIG_ASGN_USER    || '';
  const asgn258Pass = process.env.KOENIG_ASGN258_PASS || '';
  const asgn208Pass = process.env.KOENIG_ASGN208_PASS || '';

  let err258 = '';
  let err208 = '';

  // Try API 258 first (emp-code based — returns all assignments for this trainer)
  try {
    const tok = await getToken(asgnUser, asgn258Pass, 'Get Trainer Assignment Details');
    const data = await callCommon(258, tok, { koenig_trainer_emp_code: empCodeValue });
    return res.status(200).json({ assignments: data, source: '258' });
  } catch (e) {
    err258 = e instanceof Error ? e.message : String(e);
    console.warn('[API 258] failed:', err258);
  }

  // Fallback: API 208 (date-range based — caller must filter by emp code)
  if (!fromDate || !toDate) {
    return res.status(200).json({
      assignments: [],
      source: 'none',
      error: `API 258: ${err258}. No date range provided for API 208 fallback.`,
    });
  }

  try {
    const tok = await getToken(asgnUser, asgn208Pass, 'Get Trainer Assignment');
    const data = await callCommon(208, tok, { Startdate: fromDate, Enddate: toDate });
    return res.status(200).json({ assignments: data, source: '208' });
  } catch (e) {
    err208 = e instanceof Error ? e.message : String(e);
    console.warn('[API 208] failed:', err208);
  }

  return res.status(502).json({
    error: `API 258: ${err258} | API 208: ${err208}`,
  });
}
