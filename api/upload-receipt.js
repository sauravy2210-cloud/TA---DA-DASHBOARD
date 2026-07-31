import { put } from '@vercel/blob';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { base64, filename, contentType } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'Missing base64 or filename' });

    // Strip data URI prefix if present
    const raw = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');

    // Use a timestamped path to avoid collisions
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `receipts/${Date.now()}_${safeName}`;

    const blob = await put(path, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
      addRandomSuffix: false,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('upload-receipt error:', err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
