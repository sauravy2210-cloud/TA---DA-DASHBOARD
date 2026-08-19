import type {
  ClaimHeader,
  ClaimLineItem,
  AuditLog,
  NotificationLog,
} from '../types';

// ── Storage Keys (only for non-claim data) ────────────────────────────────────

const DRAFT_CLAIMS_KEY = 'tada_draft_claims';

// ── Draft Claims (localStorage only — never sent to Turso) ───────────────────

export function getDraftClaims(): ClaimHeader[] {
  try {
    const raw = localStorage.getItem(DRAFT_CLAIMS_KEY);
    return raw ? (JSON.parse(raw) as ClaimHeader[]) : [];
  } catch { return []; }
}

export function saveDraftClaim(claim: ClaimHeader): void {
  try {
    const existing = getDraftClaims();
    const idx = existing.findIndex(c => c.claimId === claim.claimId);
    if (idx >= 0) existing[idx] = claim; else existing.push(claim);
    localStorage.setItem(DRAFT_CLAIMS_KEY, JSON.stringify(existing));
  } catch { /* storage full — silent */ }
}

export function deleteDraftClaim(claimId: string): void {
  try {
    const existing = getDraftClaims().filter(c => c.claimId !== claimId);
    localStorage.setItem(DRAFT_CLAIMS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export const STORAGE_KEYS = {
  ATTACHMENTS: 'tada_attachments',
  STATUS_HISTORY: 'tada_status_history',
  AUDIT_LOGS: 'tada_audit_logs',
  DRAFT_WIZARD: 'tada_draft_wizard',
  CURRENT_USER: 'tada_current_user',
  NOTIFICATIONS: 'tada_notifications',
  PAYMENT_RECORDS: 'tada_payment_records',
  REMARKS: 'tada_remarks',
} as const;

// ── In-memory cache (single source of truth = Turso DB) ──────────────────────
// Populated once from Turso at app startup via initFromDb().
// All mutations update the cache synchronously and fire-and-forget to Turso.

let _claims: ClaimHeader[] = [];
let _lineItems: ClaimLineItem[] = [];

/** Call once at app startup. Fetches all data from Turso into memory.
 *  Also migrates any legacy localStorage claims into Turso so nothing is lost. */
async function fetchClaimsFromTurso(): Promise<ClaimHeader[]> {
  const r = await fetch('/api/turso?type=claims');
  if (!r.ok) throw new Error(`claims fetch failed: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data.claims) ? data.claims : [];
}

// Lite variant (no receiptData — often a multi-MB base64 image per item) for the
// app-wide bulk load on every login. Pages that need a specific claim's actual receipt
// images (ClaimDetail.tsx, ClaimReview.tsx) independently fetch full per-claim data via
// type=lineitems&claimId=X, unaffected by this change.
async function fetchLineItemsFromTurso(): Promise<ClaimLineItem[]> {
  const r = await fetch('/api/turso?type=lineitems-all-lite');
  if (!r.ok) throw new Error(`lineitems fetch failed: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data.lineItems) ? data.lineItems : [];
}

export async function initFromDb(): Promise<void> {
  // Step 1: fetch claims — this is the critical path; must succeed for any page to work
  let tursoClaimsArr: ClaimHeader[] = [];
  try {
    tursoClaimsArr = await fetchClaimsFromTurso();
  } catch {
    // Turso unreachable — fall back to localStorage so the user still sees something
    try {
      const raw = localStorage.getItem('tada_claims');
      if (raw) _claims = JSON.parse(raw) as ClaimHeader[];
    } catch { /* ignore */ }
    // Still try line items from localStorage
    try {
      const rawLI = localStorage.getItem('tada_line_items');
      if (rawLI) _lineItems = JSON.parse(rawLI) as ClaimLineItem[];
    } catch { /* ignore */ }
    return; // nothing more we can do
  }

  // Step 2: fetch line items independently — failure here must NOT block claims
  let tursoLineItemsArr: ClaimLineItem[] = [];
  try {
    tursoLineItemsArr = await fetchLineItemsFromTurso();
  } catch { /* line items are secondary — claims already loaded */ }

  // Step 3: one-time migration of legacy localStorage claims into Turso.
  // Only runs once — after that, Turso is the sole source of truth.
  // Never re-insert claims that are absent from Turso (they were intentionally deleted).
  const MIGRATED_KEY = 'tada_migrated_v2';
  const alreadyMigrated = localStorage.getItem(MIGRATED_KEY) === 'true';

  _claims = tursoClaimsArr;
  _lineItems = tursoLineItemsArr;

  if (!alreadyMigrated) {
    let legacyClaims: ClaimHeader[] = [];
    let legacyLineItems: ClaimLineItem[] = [];
    try {
      const raw = localStorage.getItem('tada_claims');
      if (raw) legacyClaims = JSON.parse(raw) as ClaimHeader[];
      const rawLI = localStorage.getItem('tada_line_items');
      if (rawLI) legacyLineItems = JSON.parse(rawLI) as ClaimLineItem[];
    } catch { /* ignore parse errors */ }

    // Only migrate claims that genuinely don't exist in Turso yet
    // AND exist in localStorage — these are pre-Turso claims, not deleted ones.
    // Guard: only migrate if Turso already has some claims (proves Turso is active).
    // If Turso is empty, skip migration to avoid re-inserting deleted claims.
    if (tursoClaimsArr.length > 0 && legacyClaims.length > 0) {
      const tursoIds = new Set(tursoClaimsArr.map(c => c.claimId));
      const missing = legacyClaims.filter(c => !tursoIds.has(c.claimId));
      if (missing.length > 0) {
        _claims = [...tursoClaimsArr, ...missing];
        for (const c of missing) {
          fetch('/api/turso?type=claims', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(c),
          }).catch(() => {});
        }
      }
      const tursoLIIds = new Set(tursoLineItemsArr.map(li => li.lineItemId));
      const missingLI = legacyLineItems.filter(li => !tursoLIIds.has(li.lineItemId));
      if (missingLI.length > 0) {
        _lineItems = [...tursoLineItemsArr, ...missingLI];
        fetch('/api/turso?type=lineitems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineItems: missingLI }),
        }).catch(() => {});
      }
    }

    // Mark migration done — never run again
    localStorage.setItem(MIGRATED_KEY, 'true');
  }
}

/** Re-fetch latest claims from Turso into memory.
 *  Claims only — fast and reliable. Line items are loaded lazily per-claim. */
export async function refreshClaims(): Promise<void> {
  try {
    const claims = await fetchClaimsFromTurso();
    _claims = claims;
  } catch {
    // silently keep existing cache on network error
  }
}

// ── Advance Recovery (claim-scan approach) ────────────────────────────────────

export function getAdvanceRemaining(
  empCode: string,
  advanceKey: string,
  originalAmount: number
): number {
  let totalRecovered = 0;
  for (const c of _claims) {
    const cEmpCode = String(c.trainerId ?? '').replace(/^EMP-/i, '').trim();
    if (cEmpCode !== empCode) continue;
    if (!c.advanceRecoveries) continue;
    for (const r of c.advanceRecoveries) {
      if (r.advanceKey === advanceKey) totalRecovered += r.claimAmountUsed;
    }
  }
  return Math.max(0, originalAmount - totalRecovered);
}

// ── Generic Primitives (for non-claim localStorage data) ─────────────────────

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage may be unavailable
  }
}

export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable
  }
}

// ── Claims — in-memory + Turso ────────────────────────────────────────────────

export function getClaims(): ClaimHeader[] {
  return _claims;
}

// The claim's embedded lineItems array is only for lightweight cross-browser/cross-device
// metadata access (amounts, dates, types) -- the real, full-fidelity copy (including
// receiptData) already lives in the separate line_items table. Every saveClaim/
// saveClaimAsync call (i.e. every single HR action -- Approve, Reject, Hold, Reopen,
// etc.) was writing whatever the claim's lineItems array currently held straight back to
// Turso with no stripping, so any claim whose in-memory lineItems still carried receipt
// base64 data kept re-embedding it on every subsequent action -- this is why the claims
// table's total payload reached ~101MB. Strip receiptData here, unconditionally, right
// before the write -- the in-memory _claims cache keeps the full object so nothing in the
// current session's UI changes, only what actually gets sent to Turso.
function stripReceiptDataForTurso(claim: ClaimHeader): ClaimHeader {
  if (!claim.lineItems || claim.lineItems.length === 0) return claim;
  return {
    ...claim,
    lineItems: claim.lineItems.map(({ receiptData: _r, ...rest }) => rest as ClaimLineItem),
  };
}

export function saveClaim(claim: ClaimHeader): void {
  const idx = _claims.findIndex(c => c.claimId === claim.claimId);
  if (idx >= 0) _claims[idx] = claim;
  else _claims.push(claim);

  fetch('/api/turso?type=claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stripReceiptDataForTurso(claim)),
  }).catch(() => {});
}

/** Awaited version — use this for HR Admin actions so the write is confirmed before navigating. */
export async function saveClaimAsync(claim: ClaimHeader): Promise<void> {
  const idx = _claims.findIndex(c => c.claimId === claim.claimId);
  if (idx >= 0) _claims[idx] = claim;
  else _claims.push(claim);

  const r = await fetch('/api/turso?type=claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stripReceiptDataForTurso(claim)),
  });
  if (!r.ok) throw new Error(`Failed to save claim: HTTP ${r.status}`);
}

export async function deleteClaim(claimId: string): Promise<void> {
  const r = await fetch(`/api/turso?type=claims&id=${encodeURIComponent(claimId)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`Delete failed: HTTP ${r.status}`);
  _claims = _claims.filter(c => c.claimId !== claimId);
  // Remove from localStorage so legacy migration never resurrects this claim
  try {
    const raw = localStorage.getItem('tada_claims');
    if (raw) {
      const stored = JSON.parse(raw) as ClaimHeader[];
      localStorage.setItem('tada_claims', JSON.stringify(stored.filter(c => c.claimId !== claimId)));
    }
  } catch { /* ignore */ }
}

// ── Line Items — in-memory + Turso ────────────────────────────────────────────

export function getLineItems(claimId?: string): ClaimLineItem[] {
  if (claimId === undefined) return _lineItems;
  return _lineItems.filter(li => li.claimId === claimId);
}

export function saveLineItems(lineItems: ClaimLineItem[]): void {
  const incomingIds = new Set(lineItems.map(li => li.lineItemId));
  _lineItems = [
    ..._lineItems.filter(li => !incomingIds.has(li.lineItemId)),
    ...lineItems,
  ];

  if (lineItems.length === 0) return;
  fetch('/api/turso?type=lineitems', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineItems }),
  }).catch(() => {});
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export function saveAuditLog(log: AuditLog): void {
  const logs = getFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  logs.push(log);
  saveToStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, logs);
}

export function getAuditLogs(claimId?: string): AuditLog[] {
  const all = getFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  if (claimId === undefined) return all;
  return all.filter(log => log.claimId === claimId);
}

// ── DA Paid Date Tracking ─────────────────────────────────────────────────────

/**
 * Returns a Map<dateISO, billNo> of DA dates already covered in approved/paid
 * claims for the given trainer, excluding the current claim being viewed.
 * Used by HR Admin to grey out duplicate DA dates across claims.
 */
export function getPaidDADates(trainerId: string, excludeClaimId: string): Map<string, string> {
  const paidStatuses = new Set(['Approved', 'Partially Approved', 'Payment Pending', 'Paid']);
  const result = new Map<string, string>();
  for (const c of _claims) {
    if (c.claimId === excludeClaimId) continue;
    if (c.trainerId !== trainerId) continue;
    if (!paidStatuses.has(c.status)) continue;

    // Prefer embedded lineItems (set at submit time), fall back to in-memory cache
    const items = (c.lineItems && c.lineItems.length > 0)
      ? c.lineItems
      : _lineItems.filter(li => li.claimId === c.claimId);
    const daItems = items.filter(li => li.expenseType === 'DA' && li.date);

    if (daItems.length > 0) {
      // Precise: use actual stored DA line items
      for (const li of daItems) {
        if (!result.has(li.date!)) result.set(li.date!, c.billNo ?? c.claimId);
      }
    } else if (c.claimStartDate && c.claimEndDate) {
      // Fallback for old claims that predate lineItems storage:
      // treat every date in the claim's date range as potentially paid DA.
      // This prevents double-payment for claims submitted before lineItems were persisted.
      const cur = new Date(c.claimStartDate);
      const end = new Date(c.claimEndDate);
      while (cur <= end) {
        const iso = cur.toISOString().slice(0, 10);
        if (!result.has(iso)) result.set(iso, c.billNo ?? c.claimId);
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  return result;
}

/**
 * Returns true if any DA date in the claim overlaps with already-paid DA
 * from another approved/paid claim for the same trainer.
 * For claims without stored DA items, checks against the claim date range.
 */
export function hasDaOverlap(claim: ClaimHeader): boolean {
  if (!claim.trainerId) return false;
  const paid = getPaidDADates(claim.trainerId, claim.claimId);
  if (paid.size === 0) return false;
  const items = (claim.lineItems && claim.lineItems.length > 0)
    ? claim.lineItems
    : _lineItems.filter(li => li.claimId === claim.claimId);
  const daItems = items.filter(li => li.expenseType === 'DA' && li.date);
  if (daItems.length > 0) {
    return daItems.some(li => paid.has(li.date!));
  }
  // Fallback: check if the claim's date range overlaps with any paid dates
  if (claim.claimStartDate && claim.claimEndDate) {
    const cur = new Date(claim.claimStartDate);
    const end = new Date(claim.claimEndDate);
    while (cur <= end) {
      if (paid.has(cur.toISOString().slice(0, 10))) return true;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return false;
}

// ── Draft Wizard ──────────────────────────────────────────────────────────────

interface DraftWizardState {
  step: number;
  data: unknown;
}

export function saveDraftWizard(step: number, data: unknown): void {
  saveToStorage<DraftWizardState>(STORAGE_KEYS.DRAFT_WIZARD, { step, data });
}

export function getDraftWizard(): DraftWizardState | null {
  return getFromStorage<DraftWizardState | null>(STORAGE_KEYS.DRAFT_WIZARD, null);
}

export function clearDraftWizard(): void {
  removeFromStorage(STORAGE_KEYS.DRAFT_WIZARD);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function saveNotification(notif: NotificationLog): void {
  const notifs = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const index = notifs.findIndex(n => n.notifId === notif.notifId);
  if (index >= 0) notifs[index] = notif;
  else notifs.push(notif);
  saveToStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

export function getNotifications(recipientId: string): NotificationLog[] {
  const all = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  return all.filter(n => n.recipientId === recipientId);
}

export function markNotificationRead(notifId: string): void {
  const notifs = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const index = notifs.findIndex(n => n.notifId === notifId);
  if (index >= 0) {
    notifs[index] = { ...notifs[index], read: true };
    saveToStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, notifs);
  }
}
