import type { ClaimHeader, NotificationLog } from '../types';
import { saveNotification } from './storageService';

// ── Notification Type Constants ───────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
  CLAIM_OPPORTUNITY:         'CLAIM_OPPORTUNITY',
  CLAIM_SUBMITTED:           'CLAIM_SUBMITTED',
  CLAIM_ASSIGNED:            'CLAIM_ASSIGNED',
  CLARIFICATION_REQUESTED:   'CLARIFICATION_REQUESTED',
  CLAIM_RESUBMITTED:         'CLAIM_RESUBMITTED',
  CLAIM_APPROVED:            'CLAIM_APPROVED',
  CLAIM_PARTIALLY_APPROVED:  'CLAIM_PARTIALLY_APPROVED',
  CLAIM_REJECTED:            'CLAIM_REJECTED',
  PAYMENT_PROCESSED:         'PAYMENT_PROCESSED',
  EXCEPTION_REQUIRED:        'EXCEPTION_REQUIRED',
  EXCEPTION_DECIDED:         'EXCEPTION_DECIDED',
  MISSING_DOC_DETECTED:      'MISSING_DOC_DETECTED',
  DEADLINE_APPROACHING:      'DEADLINE_APPROACHING',
  SLA_BREACHED:              'SLA_BREACHED',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// ── Core Factory ──────────────────────────────────────────────────────────────

export function createNotification(params: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  relatedClaimId?: string;
}): NotificationLog {
  const notif: NotificationLog = {
    notifId: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    recipientId: params.recipientId,
    title: params.title,
    message: params.message,
    type: resolveNotifType(params.type),
    relatedClaimId: params.relatedClaimId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  saveNotification(notif);
  return notif;
}

function resolveNotifType(
  type: string,
): 'info' | 'warning' | 'success' | 'error' {
  switch (type) {
    case NOTIFICATION_TYPES.CLAIM_APPROVED:
    case NOTIFICATION_TYPES.CLAIM_PARTIALLY_APPROVED:
    case NOTIFICATION_TYPES.PAYMENT_PROCESSED:
    case NOTIFICATION_TYPES.EXCEPTION_DECIDED:
      return 'success';
    case NOTIFICATION_TYPES.CLAIM_REJECTED:
    case NOTIFICATION_TYPES.SLA_BREACHED:
    case NOTIFICATION_TYPES.MISSING_DOC_DETECTED:
      return 'error';
    case NOTIFICATION_TYPES.CLARIFICATION_REQUESTED:
    case NOTIFICATION_TYPES.EXCEPTION_REQUIRED:
    case NOTIFICATION_TYPES.DEADLINE_APPROACHING:
      return 'warning';
    default:
      return 'info';
  }
}

// ── Workflow Notification Helpers ─────────────────────────────────────────────

export function notifyClaimSubmitted(claim: ClaimHeader, hrAdminId: string): void {
  createNotification({
    recipientId: hrAdminId,
    type: NOTIFICATION_TYPES.CLAIM_SUBMITTED,
    title: 'New Claim Submitted',
    message: `Bill ${claim.billNo} submitted by ${claim.trainerName} for ${claim.trainingLocation} — ₹${claim.totalClaimedAmount.toLocaleString('en-IN')} claimed.`,
    relatedClaimId: claim.claimId,
  });
}

export function notifyClaimApproved(claim: ClaimHeader, trainerId: string): void {
  const approved = claim.approvedAmount ?? claim.totalClaimedAmount;
  const isPartial = claim.status === 'Partially Approved';
  createNotification({
    recipientId: trainerId,
    type: isPartial
      ? NOTIFICATION_TYPES.CLAIM_PARTIALLY_APPROVED
      : NOTIFICATION_TYPES.CLAIM_APPROVED,
    title: isPartial ? 'Claim Partially Approved' : 'Claim Approved',
    message: isPartial
      ? `Bill ${claim.billNo} has been partially approved. Approved amount: ₹${approved.toLocaleString('en-IN')} (claimed ₹${claim.totalClaimedAmount.toLocaleString('en-IN')}). Deductions: ₹${claim.deductionAmount.toLocaleString('en-IN')}.`
      : `Bill ${claim.billNo} has been approved for ₹${approved.toLocaleString('en-IN')}. Payment will be processed shortly.`,
    relatedClaimId: claim.claimId,
  });
}

export function notifyClaimRejected(
  claim: ClaimHeader,
  trainerId: string,
  reason: string,
): void {
  createNotification({
    recipientId: trainerId,
    type: NOTIFICATION_TYPES.CLAIM_REJECTED,
    title: 'Claim Rejected',
    message: `Bill ${claim.billNo} has been rejected. Reason: ${reason}. Please contact HR if you have queries.`,
    relatedClaimId: claim.claimId,
  });
}

export function notifyClarificationRequired(
  claim: ClaimHeader,
  trainerId: string,
): void {
  createNotification({
    recipientId: trainerId,
    type: NOTIFICATION_TYPES.CLARIFICATION_REQUESTED,
    title: 'Clarification Required',
    message: `Bill ${claim.billNo} requires your attention. Please review the remarks and provide the requested clarification or supporting documents.`,
    relatedClaimId: claim.claimId,
  });
}

export function notifyPaymentProcessed(
  claim: ClaimHeader,
  trainerId: string,
  paymentRef: string,
): void {
  const netPayable = claim.netPayable ?? claim.approvedAmount ?? claim.totalClaimedAmount;
  createNotification({
    recipientId: trainerId,
    type: NOTIFICATION_TYPES.PAYMENT_PROCESSED,
    title: 'Payment Processed',
    message: `Payment of ₹${netPayable.toLocaleString('en-IN')} for bill ${claim.billNo} has been processed. Reference: ${paymentRef}.`,
    relatedClaimId: claim.claimId,
  });
}

// ── SLA Alert Engine ──────────────────────────────────────────────────────────

export type SLAPriority = 'Yellow' | 'Orange' | 'Red' | 'Priority';

export interface SLAAlert {
  claim: ClaimHeader;
  alertType: string;
  priority: SLAPriority;
}

export function getSLAAlerts(claims: ClaimHeader[]): SLAAlert[] {
  const alerts: SLAAlert[] = [];
  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  for (const claim of claims) {
    // Priority: high-value claim pending OR unresolved ledger mismatch
    if (
      claim.exceptionFlag &&
      (claim.status === 'Submitted' ||
        claim.status === 'Under Review' ||
        claim.status === 'Clarification Required')
    ) {
      alerts.push({
        claim,
        alertType: 'High-value claim pending review',
        priority: 'Priority',
      });
      continue; // highest severity — skip lower-tier checks for same claim
    }

    if (
      claim.ledgerMismatchFlag &&
      claim.status !== 'Paid' &&
      claim.status !== 'Rejected'
    ) {
      alerts.push({
        claim,
        alertType: 'Ledger mismatch unresolved',
        priority: 'Priority',
      });
      continue;
    }

    // Red: approved but unpaid beyond 5 days
    if (
      (claim.status === 'Approved' || claim.status === 'Partially Approved') &&
      claim.lastActionAt
    ) {
      const approvedMs = new Date(claim.lastActionAt).getTime();
      const daysSinceApproval = (now - approvedMs) / MS_PER_DAY;
      if (daysSinceApproval > 5) {
        alerts.push({
          claim,
          alertType: `Approved but unpaid for ${Math.floor(daysSinceApproval)} days`,
          priority: 'Red',
        });
        continue;
      }
    }

    // Orange: clarification pending from trainer beyond 3 days
    if (claim.status === 'Clarification Required' && claim.submittedAt) {
      // Use agingDays which already reflects time since last status change
      if (claim.agingDays > 3) {
        alerts.push({
          claim,
          alertType: `Clarification pending for ${claim.agingDays} days`,
          priority: 'Orange',
        });
        continue;
      }
    }

    // Yellow: submitted but not reviewed in 2 days
    if (claim.status === 'Submitted' && claim.submittedAt) {
      const submittedMs = new Date(claim.submittedAt).getTime();
      const daysSinceSubmission = (now - submittedMs) / MS_PER_DAY;
      if (daysSinceSubmission > 2) {
        alerts.push({
          claim,
          alertType: `Submitted ${Math.floor(daysSinceSubmission)} days ago, not yet reviewed`,
          priority: 'Yellow',
        });
      }
    }
  }

  // Sort: Priority > Red > Orange > Yellow
  const priorityOrder: Record<SLAPriority, number> = {
    Priority: 0,
    Red: 1,
    Orange: 2,
    Yellow: 3,
  };

  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return alerts;
}


