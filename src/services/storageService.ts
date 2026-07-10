import type {
  ClaimHeader,
  ClaimLineItem,
  AuditLog,
  NotificationLog,
} from '../types';

// ── Storage Keys ──────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  CLAIMS: 'tada_claims',
  LINE_ITEMS: 'tada_line_items',
  ATTACHMENTS: 'tada_attachments',
  STATUS_HISTORY: 'tada_status_history',
  AUDIT_LOGS: 'tada_audit_logs',
  DRAFT_WIZARD: 'tada_draft_wizard',
  CURRENT_USER: 'tada_current_user',
  NOTIFICATIONS: 'tada_notifications',
  PAYMENT_RECORDS: 'tada_payment_records',
  REMARKS: 'tada_remarks',
} as const;

// ── Generic Primitives ────────────────────────────────────────────────────────

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (SSR, private mode quota exceeded, etc.)
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

// ── Claims ────────────────────────────────────────────────────────────────────

export function saveClaim(claim: ClaimHeader): void {
  const claims = getClaims();
  const index = claims.findIndex((c) => c.claimId === claim.claimId);
  if (index >= 0) {
    claims[index] = claim;
  } else {
    claims.push(claim);
  }
  saveToStorage<ClaimHeader[]>(STORAGE_KEYS.CLAIMS, claims);
}

export function getClaims(): ClaimHeader[] {
  return getFromStorage<ClaimHeader[]>(STORAGE_KEYS.CLAIMS, []);
}

export function deleteClaim(claimId: string): void {
  const claims = getClaims().filter((c) => c.claimId !== claimId);
  saveToStorage<ClaimHeader[]>(STORAGE_KEYS.CLAIMS, claims);
}

// ── Line Items ────────────────────────────────────────────────────────────────

export function saveLineItems(lineItems: ClaimLineItem[]): void {
  const existing = getFromStorage<ClaimLineItem[]>(STORAGE_KEYS.LINE_ITEMS, []);
  const incomingIds = new Set(lineItems.map((li) => li.lineItemId));
  const retained = existing.filter((li) => !incomingIds.has(li.lineItemId));
  saveToStorage<ClaimLineItem[]>(STORAGE_KEYS.LINE_ITEMS, [...retained, ...lineItems]);
}

export function getLineItems(claimId?: string): ClaimLineItem[] {
  const all = getFromStorage<ClaimLineItem[]>(STORAGE_KEYS.LINE_ITEMS, []);
  if (claimId === undefined) return all;
  return all.filter((li) => li.claimId === claimId);
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
  return all.filter((log) => log.claimId === claimId);
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
  const raw = getFromStorage<DraftWizardState | null>(STORAGE_KEYS.DRAFT_WIZARD, null);
  return raw;
}

export function clearDraftWizard(): void {
  removeFromStorage(STORAGE_KEYS.DRAFT_WIZARD);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function saveNotification(notif: NotificationLog): void {
  const notifs = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const index = notifs.findIndex((n) => n.notifId === notif.notifId);
  if (index >= 0) {
    notifs[index] = notif;
  } else {
    notifs.push(notif);
  }
  saveToStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

export function getNotifications(recipientId: string): NotificationLog[] {
  const all = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  return all.filter((n) => n.recipientId === recipientId);
}

export function markNotificationRead(notifId: string): void {
  const notifs = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const index = notifs.findIndex((n) => n.notifId === notifId);
  if (index >= 0) {
    notifs[index] = { ...notifs[index], read: true };
    saveToStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, notifs);
  }
}


