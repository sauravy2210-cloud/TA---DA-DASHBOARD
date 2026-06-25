import type { AuditLog, UserRole, ReasonCode } from '../types';
import { saveAuditLog, getAuditLogs as fetchAuditLogs } from './storageService';

export const ACTION_TYPES = {
  CLAIM_DRAFTED:        'CLAIM_DRAFTED',
  CLAIM_SUBMITTED:      'CLAIM_SUBMITTED',
  CLAIM_UPDATED:        'CLAIM_UPDATED',
  ATTACHMENT_UPLOADED:  'ATTACHMENT_UPLOADED',
  ATTACHMENT_REPLACED:  'ATTACHMENT_REPLACED',
  CALC_RUN:             'CALC_RUN',
  DISCREPANCY_DETECTED: 'DISCREPANCY_DETECTED',
  AMOUNT_CHANGED:       'AMOUNT_CHANGED',
  DEDUCTION_ADDED:      'DEDUCTION_ADDED',
  APPROVED:             'APPROVED',
  PARTIALLY_APPROVED:   'PARTIALLY_APPROVED',
  REJECTED:             'REJECTED',
  CLARIFICATION_SENT:   'CLARIFICATION_SENT',
  CLAIM_HELD:           'CLAIM_HELD',
  REASSIGNED:           'REASSIGNED',
  RESUBMITTED:          'RESUBMITTED',
  EXCEPTION_RAISED:     'EXCEPTION_RAISED',
  EXCEPTION_APPROVED:   'EXCEPTION_APPROVED',
  EXCEPTION_REJECTED:   'EXCEPTION_REJECTED',
  LEDGER_VERIFIED:      'LEDGER_VERIFIED',
  PAYMENT_PROCESSED:    'PAYMENT_PROCESSED',
  POLICY_CHANGED:       'POLICY_CHANGED',
  CLAIM_CANCELLED:      'CLAIM_CANCELLED',
  CLAIM_REOPENED:       'CLAIM_REOPENED',
} as const;

interface LogActionParams {
  claimId?: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reasonCode?: string;
  remarks?: string;
  performedBy: string;
  performedByRole: UserRole;
}

function generateId(): string {
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function logAction(params: LogActionParams): AuditLog {
  const {
    claimId,
    entityType,
    entityId,
    action,
    oldValue,
    newValue,
    reasonCode,
    remarks,
    performedBy,
    performedByRole,
  } = params;

  const entry: AuditLog = {
    logId: generateId(),
    claimId: claimId ?? entityId,
    entityType,
    entityId,
    action,
    oldValue,
    newValue,
    reasonCode: reasonCode as ReasonCode,
    remarks,
    performedBy,
    performedByRole,
    performedAt: new Date().toISOString(),
  };

  saveAuditLog(entry);

  return entry;
}

export function getAuditLogs(claimId?: string): AuditLog[] {
  const logs = fetchAuditLogs(claimId);
  return logs;
}
