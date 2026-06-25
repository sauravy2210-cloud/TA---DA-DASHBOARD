import type { ClaimStatus, ClaimHeader, UserRole } from '../types';

// Re-export alias so callers can use ClaimStatus name
export type { ClaimStatus };

// PendingWith mirrors the ClaimHeader field type
export type PendingWith = 'Trainer' | 'HR/Admin' | 'Finance' | 'Approver' | 'None';

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

export const VALID_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': [
    'Approved',
    'Partially Approved',
    'Rejected',
    'Clarification Required',
    'Payment Pending',
  ],
  'Clarification Required': ['Submitted'],
  Resubmitted: ['Under Review', 'Rejected'],
  Approved: ['Payment Pending'],
  'Partially Approved': ['Payment Pending'],
  Rejected: ['Submitted'],       // SuperAdmin reopen
  'Payment Pending': ['Paid'],
  Paid: ['Submitted'],           // SuperAdmin reopen
  Cancelled: ['Submitted'],
  'On Hold': ['Under Review'],
  Reopened: ['Submitted'],
};

// ---------------------------------------------------------------------------
// Transition guard
// ---------------------------------------------------------------------------

export function canTransition(
  from: ClaimStatus,
  to: ClaimStatus,
  userRole: UserRole,
): boolean {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) return false;

  switch (userRole) {
    case 'Trainer':
      // Trainer may only submit or resubmit
      return (
        (from === 'Draft' && to === 'Submitted') ||
        (from === 'Clarification Required' && to === 'Submitted')
      );

    case 'HRAdmin':
      return (
        (from === 'Submitted' && (['Under Review', 'Rejected'] as ClaimStatus[]).includes(to)) ||
        (from === 'Under Review' &&
          (
            [
              'Approved',
              'Partially Approved',
              'Rejected',
              'Clarification Required',
              'Payment Pending',
            ] as ClaimStatus[]
          ).includes(to))
      );

    case 'Finance':
      return from === 'Payment Pending' && to === 'Paid';

    case 'SuperAdmin':
      // SuperAdmin can do anything a normal role can, plus reopen finals and cancel any
      return true;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Next actions
// ---------------------------------------------------------------------------

interface ClaimAction {
  action: string;
  targetStatus: ClaimStatus;
  label: string;
  requiresReason: boolean;
}

export function getNextActions(
  claim: ClaimHeader,
  userRole: UserRole,
): ClaimAction[] {
  const { status } = claim;
  const actions: ClaimAction[] = [];

  if (userRole === 'Trainer') {
    if (status === 'Draft') {
      actions.push({
        action: 'submit',
        targetStatus: 'Submitted',
        label: 'Submit Claim',
        requiresReason: false,
      });
    }
    if (status === 'Clarification Required') {
      actions.push({
        action: 'resubmit',
        targetStatus: 'Submitted',
        label: 'Resubmit with Clarification',
        requiresReason: true,
      });
    }
    return actions;
  }

  if (userRole === 'HRAdmin') {
    if (status === 'Submitted') {
      actions.push(
        {
          action: 'start_review',
          targetStatus: 'Under Review',
          label: 'Start Review',
          requiresReason: false,
        },
        {
          action: 'reject',
          targetStatus: 'Rejected',
          label: 'Reject',
          requiresReason: true,
        },
      );
    }
    if (status === 'Under Review') {
      actions.push(
        {
          action: 'approve',
          targetStatus: 'Approved',
          label: 'Approve',
          requiresReason: false,
        },
        {
          action: 'partially_approve',
          targetStatus: 'Partially Approved',
          label: 'Partially Approve',
          requiresReason: true,
        },
        {
          action: 'reject',
          targetStatus: 'Rejected',
          label: 'Reject',
          requiresReason: true,
        },
        {
          action: 'clarify',
          targetStatus: 'Clarification Required',
          label: 'Request Clarification',
          requiresReason: true,
        },
        {
          action: 'hold',
          targetStatus: 'Payment Pending',
          label: 'Hold for Payment',
          requiresReason: false,
        },
      );
    }
    return actions;
  }

  if (userRole === 'Finance') {
    if (status === 'Payment Pending') {
      actions.push({
        action: 'mark_paid',
        targetStatus: 'Paid',
        label: 'Mark as Paid',
        requiresReason: false,
      });
    }
    return actions;
  }

  if (userRole === 'SuperAdmin') {
    // Reopen final statuses
    if ((['Paid', 'Cancelled', 'Rejected'] as ClaimStatus[]).includes(status)) {
      actions.push({
        action: 'reopen',
        targetStatus: 'Submitted',
        label: 'Reopen Claim',
        requiresReason: true,
      });
    }
    // Cancel any non-final, non-draft status
    if (!isFinalStatus(status) && status !== 'Draft') {
      actions.push({
        action: 'cancel',
        targetStatus: 'Rejected',
        label: 'Cancel Claim',
        requiresReason: true,
      });
    }
    return actions;
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Pending-with derivation
// ---------------------------------------------------------------------------

export function getPendingWith(status: ClaimStatus): PendingWith {
  switch (status) {
    case 'Draft':
    case 'Clarification Required':
      return 'Trainer';

    case 'Submitted':
    case 'Under Review':
    case 'Resubmitted':
      return 'HR/Admin';

    case 'Approved':
    case 'Partially Approved':
    case 'Payment Pending':
      return 'Finance';

    case 'Paid':
    case 'Rejected':
      return 'None';

    default:
      return 'HR/Admin';
  }
}

// ---------------------------------------------------------------------------
// Final status check
// ---------------------------------------------------------------------------

export function isFinalStatus(status: ClaimStatus): boolean {
  return status === 'Paid' || status === 'Rejected';
}

// ---------------------------------------------------------------------------
// Status colour helpers (Tailwind classes)
// ---------------------------------------------------------------------------

export function getStatusColor(status: ClaimStatus): string {
  switch (status) {
    case 'Draft':
      return 'text-gray-500';
    case 'Submitted':
      return 'text-blue-600';
    case 'Under Review':
      return 'text-indigo-600';
    case 'Clarification Required':
      return 'text-amber-600';
    case 'Resubmitted':
      return 'text-blue-500';
    case 'Approved':
      return 'text-green-600';
    case 'Partially Approved':
      return 'text-teal-600';
    case 'Rejected':
      return 'text-red-600';
    case 'Payment Pending':
      return 'text-orange-600';
    case 'Paid':
      return 'text-emerald-600';
    case 'Cancelled':
      return 'text-gray-600';
    case 'On Hold':
      return 'text-yellow-600';
    case 'Reopened':
      return 'text-purple-600';
    default:
      return 'text-gray-400';
  }
}

export function getStatusBgColor(status: ClaimStatus): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100';
    case 'Submitted':
      return 'bg-blue-100';
    case 'Under Review':
      return 'bg-indigo-100';
    case 'Clarification Required':
      return 'bg-amber-100';
    case 'Resubmitted':
      return 'bg-blue-50';
    case 'Approved':
      return 'bg-green-100';
    case 'Partially Approved':
      return 'bg-teal-100';
    case 'Rejected':
      return 'bg-red-100';
    case 'Payment Pending':
      return 'bg-orange-100';
    case 'Paid':
      return 'bg-emerald-100';
    case 'Cancelled':
      return 'bg-gray-200';
    case 'On Hold':
      return 'bg-yellow-100';
    case 'Reopened':
      return 'bg-purple-100';
    default:
      return 'bg-gray-50';
  }
}


