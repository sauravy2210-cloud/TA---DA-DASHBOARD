/**
 * Server-side employee lookup — credentials stay out of the browser bundle.
 * GET /api/employee?empCode=1234
 * Returns the full PmsEmployeeDetails object for the given employee code.
 */
export const config = { maxDuration: 30 };

const BASE = 'https://api.koenig-solutions.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Strip EMP- prefix and clean up the code
  const raw = String(req.query.empCode || '').trim();
  const empCode = raw.replace(/^EMP-/i, '').trim();

  if (!empCode) {
    return res.status(400).json({ error: 'empCode is required' });
  }

  try {
    // Step 1 — get token
    const tokenRes = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName:  process.env.KOENIG_EMP_USER || 'Saurav_GetEmployeeDeta',
        userPassword: process.env.KOENIG_EMP_PASS || '',
        userRole:  'Get Employee Details (PMS)',
      }),
    });

    if (!tokenRes.ok) {
      return res.status(502).json({ error: `Token endpoint HTTP ${tokenRes.status}` });
    }

    const tokenData = await tokenRes.json();
    if (tokenData.statuscode !== 200) {
      return res.status(502).json({ error: tokenData.message || 'Token failed' });
    }

    const { accessToken, deviceToken } = tokenData.content;

    // Step 2 — fetch employee details
    const dataUrl = `${BASE}/api/Kites/Operator/common` +
      `?apikey=236` +
      `&accessToken=${encodeURIComponent(accessToken)}` +
      `&deviceToken=${encodeURIComponent(deviceToken)}`;

    // Try numeric code first, then string
    const codeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;

    const dataRes = await fetch(dataUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emp_code: codeValue }),
    });

    if (!dataRes.ok) {
      return res.status(502).json({ error: `Data endpoint HTTP ${dataRes.status}` });
    }

    const data = await dataRes.json();
    if (data.statuscode !== 200) {
      return res.status(404).json({ error: data.message || 'Employee not found' });
    }

    const content = typeof data.content === 'string'
      ? JSON.parse(data.content)
      : data.content;

    const list = Array.isArray(content) ? content : [];
    if (list.length === 0) {
      return res.status(404).json({ error: 'No employee record found for this code' });
    }

    return res.status(200).json({ employee: list[0] });

  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
