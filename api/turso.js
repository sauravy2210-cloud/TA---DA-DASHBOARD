// Vercel serverless — all Turso DB operations + geocoding + AI extraction + receipt upload in ONE function
// (Hobby plan: max 12 serverless functions)
//
// Claims:         GET/POST/DELETE /api/turso?type=claims[&trainerId=x|&id=x]
// Line Items:     GET/POST/DELETE /api/turso?type=lineitems[&claimId=x]
// Payments:       GET/POST /api/turso?type=payments[&claimId=x] — HR/Finance "Mark Paid"
//                 records, persisted server-side so payment history for a bill is visible
//                 from any browser/device (previously localStorage-only, lost on a different
//                 session). Multiple records per claimId are kept (full history), never
//                 overwritten.
// Feedback:       GET  /api/turso?type=feedback
//                 POST /api/turso?type=feedback  → save to DB + email saurav.yadav@koenig-solutions.com
// Extract:        POST /api/turso?type=extract   → AI receipt extraction (Claude vision)
// Upload receipt: POST /api/turso?type=upload-receipt → upload base64 to Vercel Blob, return URL
// Visa Entries:   GET/POST/DELETE /api/turso?type=visa[&empCode=x|&id=x] — Trainer's Visa Fees
//                 Entry page (travel + misc expenses logged there), visible to HR Admin under
//                 "Visa Fees Submission"
// Create TA Bill: POST /api/turso?type=create-tabill → registers the submitted claim as a TA
//                 Bill header record in Koenig RMS (api_id=342), returns { TABillID }. Fire-and-
//                 forget from the trainer's Submit Claim flow — never blocks/fails the existing
//                 Turso-based submission.
// HR Approve TA Bill: POST /api/turso?type=hr-approve-tabill → marks an existing RMS TA Bill
//                 HR-approved and links flight Trip IDs to it (api_id=343). Fire-and-forget from
//                 HR Admin's Approve/Partially Approve actions — never blocks the existing action.

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const FEEDBACK_TO = 'saurav.yadav@koenig-solutions.com';

import { createClient } from '@libsql/client/http';
import { put } from '@vercel/blob';

let _client = null;
let _tablesReady = false; // only create tables once per warm instance, never on GET paths

function getDb() {
  if (_client) return _client;
  // Strip BOM (﻿) and whitespace that can corrupt env vars copied from editors
  const url = (process.env.TURSO_DATABASE_URL || '').replace(/^﻿/, '').trim();
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').replace(/^﻿/, '').trim();
  if (!url || !authToken) throw new Error('TURSO env vars not set');
  _client = createClient({ url, authToken });
  return _client;
}

async function ensureTablesOnce(db) {
  if (_tablesReady) return;
  await db.batch([
    `CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, trainer_id TEXT NOT NULL, status TEXT NOT NULL, pending_with TEXT, bill_no TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS line_items (id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, data TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, trainer_id TEXT, trainer_name TEXT, category TEXT NOT NULL, message TEXT NOT NULL, submitted_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS visa_entries (id TEXT PRIMARY KEY, trainer_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS bill_counters (year INTEGER PRIMARY KEY, seq INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, bill_no TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL)`,
  ], 'write');
  _tablesReady = true;
}

const EXTRACT_PROMPT = `You are analyzing a travel receipt, cab bill, airline ticket, or transport document.
Extract the following:
1. FROM location — departure/pickup place (city or station name only, no country suffix)
2. TO location   — destination/drop place (city or station name only, no country suffix)
3. Amount        — numeric total charged (digits only, no symbol)
4. Currency      — 3-letter code: INR, USD, GBP, AED, EUR, SGD, AUD, etc.
5. Date          — travel date in YYYY-MM-DD format if clearly visible

Return ONLY a valid JSON object — no markdown, no explanation:
{"from": "", "to": "", "amount": "", "currency": "INR", "date": ""}
If a field is not legible or absent, return empty string for it.`;

export default async function handler(req, res) {
  const { type } = req.query;

  // ── AI receipt extraction (Claude vision) — no DB needed ─────────────────────
  if (type === 'extract') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'not_configured' });
    const { imageData, mediaType } = req.body || {};
    if (!imageData) return res.status(400).json({ error: 'Missing imageData' });
    const base64 = imageData.replace(/^data:[^;]+;base64,/, '');
    const mtype = (mediaType || 'image/jpeg').toLowerCase();
    const contentBlocks = mtype === 'application/pdf'
      ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }, { type: 'text', text: EXTRACT_PROMPT }]
      : [{ type: 'image', source: { type: 'base64', media_type: ['image/png','image/gif','image/webp'].includes(mtype) ? mtype : 'image/jpeg', data: base64 } }, { type: 'text', text: EXTRACT_PROMPT }];
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, messages: [{ role: 'user', content: contentBlocks }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) return res.status(502).json({ error: 'AI error', detail: await r.text() });
      const d = await r.json();
      const text = (d.content?.[0]?.text || '{}').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(200).json({ from: '', to: '', amount: '', currency: 'INR', date: '' });
      const p = JSON.parse(match[0]);
      return res.status(200).json({
        from: String(p.from || '').trim(), to: String(p.to || '').trim(),
        amount: String(p.amount || '').trim(), currency: String(p.currency || 'INR').trim().toUpperCase().substring(0, 3),
        date: String(p.date || '').trim(),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  }

  // ── Geocode proxy (Nominatim) — no DB needed, handle before DB init ──────────
  if (type === 'geo') {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q' });
    try {
      const limit = Math.min(parseInt(req.query.limit || '6', 10), 6);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=0`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'KoenigTADAPortal/1.0 (saurav.yadav@koenig-solutions.com)',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return res.status(502).json({ error: `Nominatim ${r.status}` });
      const data = await r.json();
      if (!data.length) return res.status(200).json({ results: [] });
      return res.status(200).json({ results: data.map(d => ({ lat: parseFloat(d.lat), lon: parseFloat(d.lon), display_name: d.display_name })) });
    } catch (err) {
      return res.status(502).json({ error: String(err.message || err) });
    }
  }

  // ── Create OR Update TA Bill (Koenig RMS, api_id=354) — no local DB needed ──
  // Single upsert endpoint per Koenig's "Upsert_TABill_API_Guide" (2026-08-25): omit TABillID
  // (or pass one that doesn't exist) to CREATE a new record; pass an existing TABillID to
  // UPDATE it — only TADAAmt/Advance/ModifiedOn/ModifiedBy actually change in update mode, per
  // the guide. Replaces the old api_id=342 create-only call, which had no update path — that
  // forced every resubmission of the same assignment to either skip RMS entirely (stale amount)
  // or fabricate a second RMS record for the same journey. Kept the `create-tabill` type name
  // for backward compatibility with existing callers; behavior is now upsert.
  if (type === 'create-tabill') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const {
      TABillID, EmpID, From, To, IsSubmitted, Advance, TADAAmt, EmpRemark, scids,
      IsSelfSponsored, FreelancerID, Source,
    } = req.body || {};
    if (!EmpID || !From || !To) {
      return res.status(400).json({ error: 'EmpID, From, and To are required' });
    }
    try {
      const tokUser     = process.env.KOENIG_TABILL_USER || 'TaDaPanel';
      const tokPass     = process.env.KOENIG_TABILL_PASS || 'TaDaPanel@123';
      const tokRole     = process.env.KOENIG_TABILL_ROLE || 'TaDaPanel';
      const tokRes = await fetch('https://api.koenig-solutions.com/api/Kites/Operator/GetToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: tokUser, userPassword: tokPass, userRole: tokRole }),
      });
      if (!tokRes.ok) return res.status(502).json({ error: `Token HTTP ${tokRes.status}` });
      const tokData = await tokRes.json();
      if (tokData.statuscode !== 200) return res.status(502).json({ error: tokData.message || 'Token failed' });
      const { accessToken, deviceToken } = tokData.content;

      const body = {
        EmpID: Number(EmpID),
        From, To,
        IsSubmitted: IsSubmitted ?? 1,
        Source: Source || 'From the NEW TA DA Dashboard',
        // Always send explicit numbers for Advance/TADAAmt, never omit them. Omitting a field
        // when the caller passed `undefined` (e.g. `claim.advanceAdjusted || undefined`, which
        // evaluates to undefined for a genuine 0) left RMS with a blank/NULL value even when we
        // actually had a real 0 (or worse, a real nonzero amount that just hadn't been forwarded
        // by the caller yet). RMS flagged this directly: "Advance amount missing in API data" /
        // "TADA amount coming as 0/NULL despite an available claim" (2026-08-21).
        Advance: Number(Advance) || 0,
        TADAAmt: Number(TADAAmt) || 0,
      };
      // Presence of TABillID is what switches this call from Create to Update mode — omit the
      // key entirely (not just null) when absent, since some backends treat an explicit
      // `"TABillID": null` differently from the key being missing.
      if (TABillID != null) body.TABillID = Number(TABillID);
      if (EmpRemark)                body.EmpRemark = EmpRemark;
      if (scids)                    body.scids = scids;
      if (IsSelfSponsored != null)  body.IsSelfSponsored = IsSelfSponsored;
      if (FreelancerID != null)     body.FreelancerID = FreelancerID;

      const url = `https://api.koenig-solutions.com/api/Kites/Operator/common` +
        `?apikey=354&accessToken=${encodeURIComponent(accessToken)}&deviceToken=${encodeURIComponent(deviceToken)}`;
      const billRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!billRes.ok) return res.status(502).json({ error: `Create/Update TA Bill HTTP ${billRes.status}` });
      const billData = await billRes.json();
      if (billData.statuscode !== 200) return res.status(502).json({ error: billData.message || 'Create/Update TA Bill failed' });
      let content = billData.content;
      if (typeof content === 'string') { try { content = JSON.parse(content); } catch { content = []; } }
      const row = Array.isArray(content) ? content[0] : content;
      const returnedTABillID = row && row.TABillID != null ? row.TABillID : null;
      const message = row && row.Message != null ? row.Message : null;
      return res.status(200).json({ TABillID: returnedTABillID, Message: message, mode: message ? 'update' : 'create' });
    } catch (err) {
      return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── HR Approve TA Bill (Koenig RMS, api_id=343) — no local DB needed ─────────
  if (type === 'hr-approve-tabill') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { TABillID, TripIDs, IsHRApproved, HRRemark } = req.body || {};
    if (!TABillID) return res.status(400).json({ error: 'Please pass the TABillID for that particular journey.' });
    if (!TripIDs || !String(TripIDs).trim()) return res.status(400).json({ error: 'Please share the TripIds so we will update.' });
    try {
      const tokUser = process.env.KOENIG_TABILL_USER || 'TaDaPanel';
      const tokPass = process.env.KOENIG_TABILL_PASS || 'TaDaPanel@123';
      const tokRole = process.env.KOENIG_TABILL_ROLE || 'TaDaPanel';
      const tokRes = await fetch('https://api.koenig-solutions.com/api/Kites/Operator/GetToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: tokUser, userPassword: tokPass, userRole: tokRole }),
      });
      if (!tokRes.ok) return res.status(502).json({ error: `Token HTTP ${tokRes.status}` });
      const tokData = await tokRes.json();
      if (tokData.statuscode !== 200) return res.status(502).json({ error: tokData.message || 'Token failed' });
      const { accessToken, deviceToken } = tokData.content;

      const body = {
        TABillID: Number(TABillID),
        TripIDs: String(TripIDs),
        IsHRApproved: IsHRApproved ?? 1,
        HRRemark: HRRemark || '',
      };

      const url = `https://api.koenig-solutions.com/api/Kites/Operator/common` +
        `?apikey=343&accessToken=${encodeURIComponent(accessToken)}&deviceToken=${encodeURIComponent(deviceToken)}`;
      const approveRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!approveRes.ok) return res.status(502).json({ error: `HR Approve TA Bill HTTP ${approveRes.status}` });
      const approveData = await approveRes.json();
      if (approveData.statuscode !== 200) return res.status(502).json({ error: approveData.message || 'HR Approve TA Bill failed' });
      let content = approveData.content;
      if (typeof content === 'string') { try { content = JSON.parse(content); } catch { content = []; } }
      const row = Array.isArray(content) ? content[0] : content;
      return res.status(200).json({
        Success: row?.Success ?? 0,
        Message: row?.Message ?? '',
        TABillID: row?.TABillID ?? null,
      });
    } catch (err) {
      return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(503).json({ error: 'DB unavailable', detail: err.message });
  }

  // Only verify/create tables on writes. Tables already exist in production; running
  // CREATE TABLE IF NOT EXISTS on every cold-start GET (which, on Hobby's smaller
  // warm-instance pool, is now most requests) added a full extra Turso round-trip to
  // every dashboard load -- likely why claims fetches started timing out against the
  // Hobby plan's 10s function cap. A genuinely missing table would still surface as a
  // clear DB error on the query itself, rather than silently needing this every time.
  // The `payments` table is new (added 2026-08-20) and, unlike the others, was never created
  // by any prior production write -- so its very first GET on a fresh cold start would 500
  // with "no such table" under the write-only check below. Force creation on GET too, but only
  // for this one still-new type; every other type already exists in production.
  const isWrite = req.method === 'POST' || req.method === 'DELETE';
  if ((isWrite || type === 'payments') && !_tablesReady) {
    try {
      await ensureTablesOnce(db);
    } catch (err) {
      return res.status(503).json({ error: 'DB setup failed', detail: err.message });
    }
  }

  // ── Claims ─────────────────────────────────────────────────────────────────
  if (type === 'claims') {
    if (req.method === 'GET') {
      const { trainerId } = req.query;
      const result = trainerId
        ? await db.execute({ sql: 'SELECT data FROM claims WHERE trainer_id = ?', args: [trainerId] })
        : await db.execute('SELECT data FROM claims ORDER BY updated_at DESC');
      return res.status(200).json({ claims: result.rows.map(r => JSON.parse(r.data)) });
    }

    if (req.method === 'POST') {
      const claim = req.body;
      if (!claim?.claimId) return res.status(400).json({ error: 'Missing claimId' });
      // rmsTABillId is set once (async, fire-and-forget) shortly AFTER the initial claim save
      // completes. If some other action re-saves the claim from a stale in-memory copy fetched
      // before that update landed, a blind overwrite here would silently erase it. Preserve the
      // existing stored value whenever the incoming payload doesn't carry one itself, rather
      // than trusting every caller to always forward it forward correctly.
      if (claim.rmsTABillId == null) {
        try {
          const existing = await db.execute({ sql: 'SELECT data FROM claims WHERE id = ?', args: [claim.claimId] });
          if (existing.rows.length > 0) {
            const existingData = JSON.parse(existing.rows[0].data);
            if (existingData.rmsTABillId != null) claim.rmsTABillId = existingData.rmsTABillId;
          }
        } catch { /* best-effort — fall through and save without it if this lookup fails */ }
      }
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO claims (id, trainer_id, status, pending_with, bill_no, data, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                pending_with = excluded.pending_with,
                bill_no = excluded.bill_no,
                data = excluded.data,
                updated_at = excluded.updated_at`,
        args: [
          claim.claimId,
          claim.trainerId ?? '',
          claim.status ?? '',
          claim.pendingWith ?? null,
          claim.billNo ?? null,
          JSON.stringify(claim),
          now,
          now,
        ],
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await db.execute({ sql: 'DELETE FROM claims WHERE id = ?', args: [id] });
      return res.status(200).json({ ok: true });
    }
  }

  // ── Payments (HR/Finance "Mark Paid" history) ────────────────────────────────
  if (type === 'payments') {
    if (req.method === 'GET') {
      const { claimId } = req.query;
      const result = claimId
        ? await db.execute({ sql: 'SELECT data FROM payments WHERE claim_id = ? ORDER BY created_at DESC', args: [claimId] })
        : await db.execute('SELECT data FROM payments ORDER BY created_at DESC');
      return res.status(200).json({ payments: result.rows.map(r => JSON.parse(r.data)) });
    }
    if (req.method === 'POST') {
      const record = req.body;
      if (!record?.paymentId || !record?.claimId) return res.status(400).json({ error: 'Missing paymentId or claimId' });
      await db.execute({
        sql: `INSERT INTO payments (id, claim_id, bill_no, data, created_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        args: [record.paymentId, record.claimId, record.billNumber ?? null, JSON.stringify(record), record.processedAt || new Date().toISOString()],
      });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { paymentId } = req.query;
      if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });
      await db.execute({ sql: 'DELETE FROM payments WHERE id = ?', args: [paymentId] });
      return res.status(200).json({ ok: true });
    }
  }

  // ── Line Items ──────────────────────────────────────────────────────────────
  if (type === 'lineitems') {
    if (req.method === 'GET') {
      const { claimId } = req.query;
      if (!claimId) return res.status(400).json({ error: 'Missing claimId' });
      const result = await db.execute({
        sql: 'SELECT data FROM line_items WHERE claim_id = ?',
        args: [claimId],
      });
      return res.status(200).json({ lineItems: result.rows.map(r => JSON.parse(r.data)) });
    }

    if (req.method === 'POST') {
      const { lineItems } = req.body || {};
      if (!Array.isArray(lineItems) || lineItems.length === 0)
        return res.status(400).json({ error: 'Missing lineItems array' });
      const statements = lineItems.map(li => ({
        sql: `INSERT INTO line_items (id, claim_id, data) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        args: [li.lineItemId, li.claimId, JSON.stringify(li)],
      }));
      await db.batch(statements, 'write');
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { claimId } = req.query;
      if (!claimId) return res.status(400).json({ error: 'Missing claimId' });
      await db.execute({ sql: 'DELETE FROM line_items WHERE claim_id = ?', args: [claimId] });
      return res.status(200).json({ ok: true });
    }
  }

  // ── Line Items (all) ────────────────────────────────────────────────────────
  if (type === 'lineitems-all' && req.method === 'GET') {
    const result = await db.execute('SELECT data FROM line_items');
    return res.status(200).json({ lineItems: result.rows.map(r => JSON.parse(r.data)) });
  }

  // Lightweight variant of the above — strips receiptData (by far the largest field,
  // often a multi-MB base64 image) before sending. Used for the app-wide bulk load on
  // every login (Vercel "Fast Origin Transfer" cost driver); per-claim views still fetch
  // full data (including receiptData) via type=lineitems&claimId=X, unchanged, and the
  // receipt-backfill service still reads full data via type=lineitems-all, unchanged.
  if (type === 'lineitems-all-lite' && req.method === 'GET') {
    const result = await db.execute('SELECT data FROM line_items');
    const lineItems = result.rows.map(r => {
      const item = JSON.parse(r.data);
      const { receiptData: _r, ...lite } = item;
      return lite;
    });
    return res.status(200).json({ lineItems });
  }

  // ── Sequential bill number counter ──────────────────────────────────────────
  // Atomically reserves the next per-year sequence number for TADA-<year>-<seq> bill
  // numbers, replacing the old Date.now()-based suffix which was unique but not
  // sequential. The INSERT ... ON CONFLICT ... RETURNING is a single statement, so the
  // increment is atomic even under concurrent submissions.
  if (type === 'next-bill-no') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const year = Number(req.body?.year);
    if (!year || !Number.isInteger(year)) return res.status(400).json({ error: 'Missing or invalid year' });
    const result = await db.execute({
      sql: `INSERT INTO bill_counters (year, seq) VALUES (?, 1)
            ON CONFLICT(year) DO UPDATE SET seq = seq + 1
            RETURNING seq`,
      args: [year],
    });
    const seq = Number(result.rows?.[0]?.seq ?? 1);
    return res.status(200).json({ seq });
  }

  // ── Visa Entries (Trainer's Visa Fees Entry page → HR Admin's Visa Fees Submission) ────────
  if (type === 'visa') {
    if (req.method === 'GET') {
      const { empCode } = req.query;
      const result = empCode
        ? await db.execute({ sql: 'SELECT data FROM visa_entries WHERE trainer_id = ? ORDER BY created_at DESC', args: [empCode] })
        : await db.execute('SELECT data FROM visa_entries ORDER BY created_at DESC');
      return res.status(200).json({ entries: result.rows.map(r => JSON.parse(r.data)) });
    }

    if (req.method === 'POST') {
      const entry = req.body;
      if (!entry?.id || !entry?.trainerId) return res.status(400).json({ error: 'Missing id or trainerId' });
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO visa_entries (id, trainer_id, data, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        args: [entry.id, entry.trainerId, JSON.stringify(entry), now],
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await db.execute({ sql: 'DELETE FROM visa_entries WHERE id = ?', args: [id] });
      return res.status(200).json({ ok: true });
    }
  }

  // ── Feedback ────────────────────────────────────────────────────────────────
  if (type === 'feedback') {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM feedback ORDER BY submitted_at DESC');
      return res.status(200).json({ feedback: result.rows });
    }

    if (req.method === 'POST') {
      const { id, trainerName, trainerId, category, message, submittedAt } = req.body || {};
      if (!category || !message) return res.status(400).json({ error: 'Missing category or message' });

      // Save to DB
      try {
        await db.execute({
          sql: `INSERT INTO feedback (id, trainer_id, trainer_name, category, message, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
          args: [id || Date.now().toString(), trainerId || '', trainerName || '', category, message, submittedAt || new Date().toISOString()],
        });
      } catch (e) { console.warn('Feedback DB save failed:', e.message); }

      // Email to saurav.yadav@koenig-solutions.com
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return res.status(200).json({ skipped: true, reason: 'email_not_configured' });

      const date = new Date(submittedAt || new Date()).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#1f7cc9;padding:24px 32px;">
  <p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Koenig Solutions — TA/DA Portal</p>
  <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">New Trainer Feedback</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px;">Trainer Name</td><td style="padding:6px 0;font-weight:600;font-size:14px;color:#111827;">${trainerName || '—'}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Employee Code</td><td style="padding:6px 0;font-weight:600;font-size:14px;color:#111827;">${trainerId ? 'EMP-' + String(trainerId).replace(/^EMP-/i,'') : '—'}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Category</td><td style="padding:6px 0;"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600;">${category}</span></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Submitted At</td><td style="padding:6px 0;font-size:13px;color:#374151;">${date}</td></tr>
  </table>
  <div style="background:#f9fafb;border-left:4px solid #1f7cc9;border-radius:0 8px 8px 0;padding:16px 18px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Feedback Message</p>
    <p style="margin:0;font-size:15px;color:#111827;white-space:pre-wrap;">${message}</p>
  </div>
</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Sent automatically from the Koenig TA/DA Portal feedback form.</p>
</td></tr>
</table></td></tr></table></body></html>`;

      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'TA/DA Portal <noreply@koenig-solutions.com>',
            to: [FEEDBACK_TO],
            subject: `[TA/DA Feedback] ${category} — ${trainerName || 'Trainer'}`,
            html,
          }),
        });
        if (!r.ok) return res.status(502).json({ error: 'Email error', detail: await r.text() });
        const d = await r.json();
        return res.status(200).json({ sent: true, id: d.id });
      } catch (err) {
        return res.status(500).json({ error: 'Email send failed' });
      }
    }
  }

  // ── Upload Receipt to Vercel Blob ───────────────────────────────────────────
  if (type === 'upload-receipt' && req.method === 'POST') {
    try {
      const { base64, filename, contentType } = req.body;
      if (!base64 || !filename) return res.status(400).json({ error: 'Missing base64 or filename' });
      const raw = base64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(raw, 'base64');
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `receipts/${Date.now()}_${safeName}`;
      const blob = await put(path, buffer, {
        access: 'public',
        contentType: contentType || 'application/octet-stream',
        addRandomSuffix: false,
      });
      return res.status(200).json({ url: blob.url });
    } catch (err) {
      return res.status(500).json({ error: String(err?.message ?? err) });
    }
  }

  // ── Server-side receipt backfill ────────────────────────────────────────────
  // Scans all line_items in Turso, finds any with base64 receiptData,
  // uploads each to Vercel Blob, and updates the Turso row with the blob URL.
  if (type === 'backfill-receipts' && req.method === 'POST') {
    try {
      const db = getDb();
      await ensureTablesOnce(db);
      const result = await db.execute('SELECT id, claim_id, data FROM line_items');
      const toUpdate = [];
      for (const row of result.rows) {
        let li;
        try { li = JSON.parse(row.data); } catch { continue; }
        const rd = li.receiptData;
        if (!rd || rd.startsWith('http')) continue; // already a URL or missing
        // Has base64 — upload to Vercel Blob
        try {
          const contentType = rd.match(/^data:([^;]+);/)?.[1] ?? 'application/octet-stream';
          const raw = rd.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(raw, 'base64');
          const safeName = (li.receiptFileName || `receipt_${li.lineItemId}`).replace(/[^a-zA-Z0-9._-]/g, '_');
          const blobPath = `receipts/${Date.now()}_${safeName}`;
          const blob = await put(blobPath, buffer, { access: 'public', contentType, addRandomSuffix: false });
          const updated = { ...li, receiptData: blob.url, receiptUrl: blob.url };
          await db.execute({
            sql: 'INSERT INTO line_items (id, claim_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
            args: [li.lineItemId, li.claimId, JSON.stringify(updated)],
          });
          toUpdate.push({ lineItemId: li.lineItemId, url: blob.url });
        } catch (uploadErr) {
          toUpdate.push({ lineItemId: li.lineItemId, error: String(uploadErr?.message ?? uploadErr) });
        }
      }
      return res.status(200).json({ processed: result.rows.length, updated: toUpdate });
    } catch (err) {
      return res.status(500).json({ error: String(err?.message ?? err) });
    }
  }

  // ── One-time cleanup: strip receiptData from claims' embedded lineItems ──────
  // saveClaim/saveClaimAsync previously wrote whatever lineItems array a claim held
  // straight back to Turso on every HR action, with no stripping -- so any claim whose
  // embedded copy carried receipt base64 data kept re-writing it on every subsequent
  // action. This is a one-time server-side migration to shrink the already-bloated
  // claims table; going forward, storageService.ts's saveClaim/saveClaimAsync strip it
  // before every write, so this should never need to grow back. The full-fidelity
  // receipt data is untouched in the separate line_items table -- nothing is deleted.
  if (type === 'cleanup-claims-receipts' && req.method === 'POST') {
    try {
      const result = await db.execute('SELECT id, data FROM claims');
      const updates = [];
      let savedBytes = 0;
      for (const row of result.rows) {
        let claim;
        try { claim = JSON.parse(row.data); } catch { continue; }
        if (!Array.isArray(claim.lineItems) || claim.lineItems.length === 0) continue;
        const hasReceiptData = claim.lineItems.some(li => li && li.receiptData);
        if (!hasReceiptData) continue;
        const before = row.data.length;
        claim.lineItems = claim.lineItems.map(({ receiptData, ...rest }) => rest);
        const newData = JSON.stringify(claim);
        savedBytes += before - newData.length;
        updates.push({ sql: 'UPDATE claims SET data = ? WHERE id = ?', args: [newData, row.id] });
      }
      if (updates.length > 0) await db.batch(updates, 'write');
      return res.status(200).json({ totalClaims: result.rows.length, cleaned: updates.length, savedBytes });
    } catch (err) {
      return res.status(500).json({ error: String(err?.message ?? err) });
    }
  }

  return res.status(400).json({ error: 'Missing or unknown type param' });
}
