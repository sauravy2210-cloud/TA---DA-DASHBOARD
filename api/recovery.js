// Vercel serverless function — Insert Recovery via Koenig KITES API (apikey=274)
// Credentials live ONLY in Vercel env vars; never exposed to the browser.
//
// Required env vars (set in Vercel project settings):
//   RECOVERY_USERNAME  — e.g. Saurav_InsertRecovery
//   RECOVERY_PASSWORD  — the API password
//   RECOVERY_ROLE      — e.g. Insert Recovery

const BASE = 'https://api.koenig-solutions.com';
const API_KEY = '274';

async function getAuthTokens() {
  const username = process.env.RECOVERY_USERNAME;
  const password = process.env.RECOVERY_PASSWORD;
  const role     = process.env.RECOVERY_ROLE;

  if (!username || !password || !role) {
    throw new Error('RECOVERY_USERNAME / RECOVERY_PASSWORD / RECOVERY_ROLE env vars not set');
  }

  const res = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: username, userPassword: password, userRole: role }),
  });

  if (!res.ok) {
    throw new Error(`GetToken HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data.statuscode !== 200 || !data.content?.accessToken) {
    throw new Error(`GetToken failed: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.content.accessToken,
    deviceToken: data.content.deviceToken,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { EmpCode, Date: date, Currency, Amount, Remarks, CreatedBy } = req.body || {};

  if (!EmpCode || !date || !Amount) {
    return res.status(400).json({ error: 'Missing required fields: EmpCode, Date, Amount' });
  }

  let accessToken, deviceToken;
  try {
    ({ accessToken, deviceToken } = await getAuthTokens());
  } catch (err) {
    console.error('Recovery auth failed:', err.message);
    return res.status(502).json({ error: 'Authentication failed', detail: err.message });
  }

  const url = `${BASE}/api/Kites/Operator/common?apikey=${API_KEY}&accessToken=${encodeURIComponent(accessToken)}&deviceToken=${encodeURIComponent(deviceToken)}`;

  const payload = {
    EmpCode: String(EmpCode),
    Date: String(date),
    Currency: String(Currency || 'INR'),
    Amount: String(Amount),
    Remarks: String(Remarks || ''),
    CreatedBy: String(CreatedBy || ''),
  };

  try {
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      console.error('Insert Recovery API error:', text);
      return res.status(502).json({ error: `API error ${apiRes.status}`, detail: text });
    }

    const data = await apiRes.json();

    if (data.statuscode !== 200) {
      return res.status(502).json({ error: 'Recovery API returned non-200', detail: data });
    }

    return res.status(200).json({ success: true, content: data.content });
  } catch (err) {
    console.error('Insert Recovery failed:', err.message);
    return res.status(500).json({ error: 'Internal error calling recovery API', detail: err.message });
  }
}
