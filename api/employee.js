/**
 * Server-side employee lookup — credentials stay out of the browser bundle.
 * GET /api/employee?empCode=1234
 *
 * Strategy: fire API 236 with every known body-param variant in parallel,
 * merge ALL returned records into one object (last non-null wins per field),
 * so the profile gets the richest possible data regardless of which variant
 * the PMS happens to respond to.
 */
export const config = { maxDuration: 10 }; // Vercel Hobby plan hard cap

const BASE = 'https://api.koenig-solutions.com';

async function getToken() {
  const res = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName:     process.env.KOENIG_EMP_USER || 'Saurav_GetEmployeeDeta',
      userPassword: process.env.KOENIG_EMP_PASS || '',
      userRole:     'Get Employee Details (PMS)',
    }),
  });
  if (!res.ok) throw new Error(`Token HTTP ${res.status}`);
  const d = await res.json();
  if (d.statuscode !== 200) throw new Error(d.message || 'Token failed');
  return d.content; // { accessToken, deviceToken }
}

async function callApi(apikey, accessToken, deviceToken, body) {
  const url = `${BASE}/api/Kites/Operator/common` +
    `?apikey=${apikey}` +
    `&accessToken=${encodeURIComponent(accessToken)}` +
    `&deviceToken=${encodeURIComponent(deviceToken)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return [];
    const d = await r.json();
    if (d.statuscode !== 200) return [];
    let raw = d.content;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return []; } }
    return Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
  } catch {
    return [];
  }
}

/** Deep-merge: for each key, take the last non-null, non-empty value across all objects */
function mergeRecords(records) {
  const merged = {};
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;
    for (const [k, v] of Object.entries(rec)) {
      if (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null') {
        merged[k] = v;
      }
    }
  }
  return merged;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const raw = String(req.query.empCode || '').trim();
  const empCode = raw.replace(/^EMP-/i, '').trim();
  const email = String(req.query.email || '').trim();
  if (!empCode && !email) return res.status(400).json({ error: 'empCode or email is required' });

  const numCode  = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : null;
  const strCode  = empCode;

  try {
    const { accessToken, deviceToken } = await getToken();

    // Fire all body-param variants in parallel — PMS responds to different keys
    // depending on the API version; we collect every result and merge.
    const bodyVariants = empCode ? [
      { emp_code:   numCode ?? strCode },
      { emp_code:   strCode },
      { EmpCode:    numCode ?? strCode },
      { EmpCode:    strCode },
      { EmpID:      numCode ?? strCode },
      { emp_id:     numCode ?? strCode },
      { employee_code: numCode ?? strCode },
      { employee_code: strCode },
      { EmployeeCode:  numCode ?? strCode },
      { EmployeeCode:  strCode },
      { empCode:    numCode ?? strCode },
      { empCode:    strCode },
    ] : [
      // Email-based lookup — used when the caller only has the trainer's email (e.g.
      // an SSO/integration link that doesn't carry the real Koenig employee code).
      { email: email },
      { Email: email },
      { EmailAddress: email },
      { email_address: email },
      { EmailId: email },
      { email_id: email },
      { OfficialEmail: email },
      { official_email: email },
      { WorkEmail: email },
    ];

    // De-duplicate body variants (JSON-stringify comparison)
    const seen = new Set();
    const uniqueBodies = bodyVariants.filter(b => {
      const key = JSON.stringify(b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const allResults = await Promise.all(
      uniqueBodies.map(body => callApi(236, accessToken, deviceToken, body))
    );

    // Flatten all returned records
    const allRecords = allResults.flat();

    if (allRecords.length === 0) {
      return res.status(404).json({ error: 'No employee record found for this code' });
    }

    // Merge: first record is the base; subsequent records fill in missing fields
    const employee = mergeRecords(allRecords);

    // Ensure empCode is always present in the response when we already knew it
    // (empCode-based lookup). For an email-based lookup, the real emp code must come
    // from the PMS record itself — an empty fallback would fabricate a wrong code.
    if (strCode && !employee.emp_code && !employee.EmpCode && !employee.empCode) {
      employee.emp_code = strCode;
    }

    return res.status(200).json({
      employee,
      _debug: {
        recordsFound: allRecords.length,
        variantsTried: uniqueBodies.length,
      },
    });

  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
