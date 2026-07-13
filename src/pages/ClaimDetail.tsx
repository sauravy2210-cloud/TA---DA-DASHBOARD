import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { User, ClaimStatus, UserRole, PendingWith, PaymentStatus, AttachmentCategory } from '../types';
import { mockClaims, mockAttachments, mockStatusHistory } from '../data/mockClaims';
import { getClaims } from '../services/storageService';
import ClaimTimeline from '../components/ClaimTimeline';
import AmountSummary from '../components/AmountSummary';
import { AttachmentPreview } from '../components/AttachmentPreview';
import AuditTimeline from '../components/AuditTimeline';
import { LedgerPanel } from '../components/LedgerPanel';
import RemarksPanel from '../components/RemarksPanel';
import { TravelTimeline } from '../components/TravelTimeline';
import DADayBreakdown from '../components/DADayBreakdown';
import { ResourceLeavePanel } from '../components/ResourceLeavePanel';
import LodgingStaybackPanel from '../components/LodgingStaybackPanel';
import CabConveyancePanel from '../components/CabConveyancePanel';

// ─── Props ─────────────────────────────────────────────────────────────────

interface ClaimDetailProps {
  currentUser: User;
}

// ─── Tab definitions ───────────────────────────────────────────────────────

type TabId =
  | 'overview'
  | 'travel'
  | 'da'
  | 'lodging'
  | 'cab'
  | 'other'
  | 'documents'
  | 'timeline'
  | 'audit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'travel', label: 'Travel' },
  { id: 'da', label: 'DA' },
  { id: 'lodging', label: 'Lodging' },
  { id: 'cab', label: 'Cab' },
  { id: 'other', label: 'Other' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'audit', label: 'Audit Log' },
];

// ─── Status badge ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  'UNDER REVIEW': 'bg-yellow-100 text-yellow-700',
  'CLARIFICATION REQUIRED': 'bg-orange-100 text-orange-700',
  RESUBMITTED: 'bg-indigo-100 text-indigo-700',
  APPROVED: 'bg-green-100 text-green-700',
  'PARTIALLY APPROVED': 'bg-teal-100 text-teal-700',
  REJECTED: 'bg-red-100 text-red-700',
  'ON HOLD': 'bg-pink-100 text-pink-700',
  'PAYMENT PENDING': 'bg-purple-100 text-purple-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
  REOPENED: 'bg-cyan-100 text-cyan-700',
};

const PENDING_COLORS: Record<string, string> = {
  Trainer: 'bg-amber-100 text-amber-700',
  'HR/Admin': 'bg-blue-100 text-blue-700',
  Finance: 'bg-violet-100 text-violet-700',
  Approver: 'bg-orange-100 text-orange-700',
  Reviewer: 'bg-indigo-100 text-indigo-700',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status.toUpperCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}

function PendingBadge({ pendingWith }: { pendingWith: string | null }) {
  if (!pendingWith) return null;
  const cls = PENDING_COLORS[pendingWith] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      Pending with: {pendingWith}
    </span>
  );
}

// ─── Risk flags row ────────────────────────────────────────────────────────

function RiskFlags({ claim }: { claim: (typeof mockClaims)[number] }) {
  const flags: { label: string; color: string }[] = [];
  if (claim.exceptionFlag) flags.push({ label: 'Exception', color: 'bg-orange-100 text-orange-700' });
  if (claim.missingDocumentFlag) flags.push({ label: 'Missing Docs', color: 'bg-red-100 text-red-700' });
  if (claim.slaBreached) flags.push({ label: 'SLA Breached', color: 'bg-red-200 text-red-800' });
  if (claim.ledgerMismatchFlag) flags.push({ label: 'Ledger Mismatch', color: 'bg-yellow-100 text-yellow-700' });
  if (claim.highValue) flags.push({ label: 'High Value', color: 'bg-purple-100 text-purple-700' });
  if ((claim.recoverableAmount ?? 0) > 0) flags.push({ label: 'Recoverable', color: 'bg-pink-100 text-pink-700' });
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {flags.map((f) => (
        <span key={f.label} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${f.color}`}>
          {f.label}
        </span>
      ))}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────

interface ActionModalProps {
  title: string;
  label: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function ActionModal({
  title,
  label,
  confirmLabel = 'Confirm',
  confirmColor = 'bg-blue-600 hover:bg-blue-700',
  onConfirm,
  onClose,
}: ActionModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason / remarks..."
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (reason.trim()) { onConfirm(reason.trim()); onClose(); } }}
            disabled={!reason.trim()}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action types ──────────────────────────────────────────────────────────

type ActionKey =
  | 'edit'
  | 'respond'
  | 'start-review'
  | 'send-clarification'
  | 'approve'
  | 'partial-approve'
  | 'reject'
  | 'hold'
  | 'mark-paid'
  | 'reopen'
  | 'cancel';

interface ActionConfig {
  key: ActionKey;
  label: string;
  variant: 'primary' | 'danger' | 'warning' | 'secondary' | 'success';
  needsModal?: boolean;
  modalTitle?: string;
  modalLabel?: string;
  modalConfirmLabel?: string;
}

function getAvailableActions(
  role: UserRole,
  status: string
): ActionConfig[] {
  const s = status.toUpperCase();
  const actions: ActionConfig[] = [];

  if (role === 'Trainer') {
    if (s === 'DRAFT') {
      actions.push({ key: 'edit', label: 'Edit Draft', variant: 'primary' });
    }
    if (s === 'CLARIFICATION REQUIRED') {
      actions.push({
        key: 'respond',
        label: 'Respond to Clarification',
        variant: 'primary',
        needsModal: true,
        modalTitle: 'Respond to Clarification',
        modalLabel: 'Your response',
        modalConfirmLabel: 'Submit Response',
      });
    }
  }

  if (role === 'HRAdmin') {
    if (s === 'SUBMITTED' || s === 'RESUBMITTED') {
      actions.push({ key: 'start-review', label: 'Start Review', variant: 'primary' });
    }
    if (s === 'UNDER REVIEW') {
      actions.push({
        key: 'send-clarification',
        label: 'Send Clarification',
        variant: 'warning',
        needsModal: true,
        modalTitle: 'Send Clarification Request',
        modalLabel: 'Clarification required (visible to trainer)',
        modalConfirmLabel: 'Send',
      });
      actions.push({
        key: 'approve',
        label: 'Approve',
        variant: 'success',
        needsModal: true,
        modalTitle: 'Approve Claim',
        modalLabel: 'Approval remarks',
        modalConfirmLabel: 'Approve',
      });
      actions.push({
        key: 'partial-approve',
        label: 'Partially Approve',
        variant: 'warning',
        needsModal: true,
        modalTitle: 'Partially Approve Claim',
        modalLabel: 'Reason for partial approval and deduction details',
        modalConfirmLabel: 'Partially Approve',
      });
      actions.push({
        key: 'reject',
        label: 'Reject',
        variant: 'danger',
        needsModal: true,
        modalTitle: 'Reject Claim',
        modalLabel: 'Reason for rejection',
        modalConfirmLabel: 'Reject',
      });
      actions.push({
        key: 'hold',
        label: 'Hold',
        variant: 'secondary',
        needsModal: true,
        modalTitle: 'Place Claim On Hold',
        modalLabel: 'Reason for hold',
        modalConfirmLabel: 'Place On Hold',
      });
    }
  }

  if (role === 'Finance') {
    if (s === 'PAYMENT PENDING') {
      actions.push({
        key: 'mark-paid',
        label: 'Mark as Paid',
        variant: 'success',
        needsModal: true,
        modalTitle: 'Mark Claim as Paid',
        modalLabel: 'Payment reference / UTR',
        modalConfirmLabel: 'Mark Paid',
      });
    }
  }

  if (role === 'SuperAdmin') {
    // SuperAdmin gets all HR actions + Reopen + Cancel
    if (s === 'SUBMITTED' || s === 'RESUBMITTED') {
      actions.push({ key: 'start-review', label: 'Start Review', variant: 'primary' });
    }
    if (s === 'UNDER REVIEW') {
      actions.push({
        key: 'send-clarification',
        label: 'Send Clarification',
        variant: 'warning',
        needsModal: true,
        modalTitle: 'Send Clarification Request',
        modalLabel: 'Clarification required',
        modalConfirmLabel: 'Send',
      });
      actions.push({
        key: 'approve',
        label: 'Approve',
        variant: 'success',
        needsModal: true,
        modalTitle: 'Approve Claim',
        modalLabel: 'Approval remarks',
        modalConfirmLabel: 'Approve',
      });
      actions.push({
        key: 'partial-approve',
        label: 'Partially Approve',
        variant: 'warning',
        needsModal: true,
        modalTitle: 'Partially Approve Claim',
        modalLabel: 'Reason for partial approval',
        modalConfirmLabel: 'Partially Approve',
      });
      actions.push({
        key: 'reject',
        label: 'Reject',
        variant: 'danger',
        needsModal: true,
        modalTitle: 'Reject Claim',
        modalLabel: 'Reason for rejection',
        modalConfirmLabel: 'Reject',
      });
      actions.push({
        key: 'hold',
        label: 'Hold',
        variant: 'secondary',
        needsModal: true,
        modalTitle: 'Place On Hold',
        modalLabel: 'Reason for hold',
        modalConfirmLabel: 'Place On Hold',
      });
    }
    if (s === 'PAYMENT PENDING') {
      actions.push({
        key: 'mark-paid',
        label: 'Mark as Paid',
        variant: 'success',
        needsModal: true,
        modalTitle: 'Mark Claim as Paid',
        modalLabel: 'Payment reference / UTR',
        modalConfirmLabel: 'Mark Paid',
      });
    }
    if (
      s === 'REJECTED' ||
      s === 'APPROVED' ||
      s === 'PARTIALLY APPROVED' ||
      s === 'PAID' ||
      s === 'ON HOLD' ||
      s === 'CANCELLED'
    ) {
      actions.push({
        key: 'reopen',
        label: 'Reopen',
        variant: 'warning',
        needsModal: true,
        modalTitle: 'Reopen Claim',
        modalLabel: 'Reason for reopening',
        modalConfirmLabel: 'Reopen',
      });
    }
    if (s !== 'CANCELLED' && s !== 'PAID') {
      actions.push({
        key: 'cancel',
        label: 'Cancel Claim',
        variant: 'danger',
        needsModal: true,
        modalTitle: 'Cancel Claim',
        modalLabel: 'Reason for cancellation',
        modalConfirmLabel: 'Cancel Claim',
      });
    }
  }

  return actions;
}

const VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
  success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus:ring-gray-400',
};

// ─── Info row ──────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800">{value ?? '—'}</dd>
    </div>
  );
}

// ─── Not found ─────────────────────────────────────────────────────────────

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
      <div className="text-gray-300">
        <svg className="w-16 h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M9 7a4 4 0 118 0A4 4 0 019 7z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-gray-600">Claim not found</p>
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go Back
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

const ClaimDetail: React.FC<ClaimDetailProps> = ({ currentUser }) => {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activeModal, setActiveModal] = useState<ActionConfig | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const claim = useMemo(() => {
    const realClaim = getClaims().find((c) => c.claimId === claimId);
    if (realClaim) return realClaim as unknown as (typeof mockClaims)[number];
    return mockClaims.find((c) => c.claimId === claimId);
  }, [claimId]);

  const claimAttachments = useMemo(
    () => mockAttachments.filter((a) => a.claimId === claimId),
    [claimId]
  );

  const claimHistory = useMemo(
    () => mockStatusHistory.filter((h) => h.claimId === claimId),
    [claimId]
  );

  const availableActions = useMemo(
    () => (claim ? getAvailableActions(currentUser.role, claim.status) : []),
    [claim, currentUser.role]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleActionConfirm = (action: ActionConfig, reason: string) => {
    console.log(`Action: ${action.key}`, { reason, claimId });
    showToast(`Action "${action.label}" recorded. (Mock — no persistence)`);
  };

  const handleActionClick = (action: ActionConfig) => {
    if (action.needsModal) {
      setActiveModal(action);
    } else {
      // Immediate actions (edit / start-review)
      if (action.key === 'edit') {
        navigate(`/claims/${claimId}/edit`);
      } else if (action.key === 'start-review') {
        showToast('Claim picked up for review.');
      }
    }
  };

  if (!claim) return <NotFound onBack={() => navigate(-1)} />;

  // Adapt status history to ClaimTimeline expected format
  const adaptedHistory = claimHistory.map((h) => ({
    historyId: h.historyId,
    claimId: h.claimId,
    fromStatus: (h.fromStatus ?? null) as ClaimStatus | null,
    toStatus: h.toStatus as ClaimStatus,
    changedBy: h.changedBy,
    changedByRole: (h.changedByRole ?? 'Trainer') as UserRole,
    changedAt: h.changedAt,
    remarks: h.remarks,
  }));

  const isHROrAdmin = currentUser.role === 'HRAdmin' || currentUser.role === 'SuperAdmin';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Back button ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors focus:outline-none"
        >
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Bills
        </button>
      </div>

      {/* ── Header summary card ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900">{claim.billNo}</h2>
              <StatusBadge status={claim.status} />
              {claim.pendingWith && <PendingBadge pendingWith={claim.pendingWith} />}
            </div>

            <p className="text-sm text-gray-500">
              {claim.clientName}
              {claim.baseCity ? ` — ${claim.baseCity}` : ''}
              {(claim.destinationCities[0] ?? "") && (claim.destinationCities[0] ?? "") !== 'India' ? `, ${(claim.destinationCities[0] ?? "")}` : ''}
            </p>

            <RiskFlags claim={claim} />
          </div>

          {/* Amount summary strip */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Claimed</div>
              <div className="font-semibold text-gray-800">
                ₹{(claim.totalClaimedAmount ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
            {claim.approvedAmount !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Approved</div>
                <div className="font-semibold text-green-700">
                  ₹{(claim.approvedAmount ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
            )}
            {(claim.deductionAmount ?? 0) > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Deduction</div>
                <div className="font-semibold text-red-600">
                  -₹{(claim.deductionAmount ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
            )}
            {claim.netPayable !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Net Payable</div>
                <div className="font-bold text-blue-700">
                  ₹{(claim.netPayable ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-0 overflow-x-auto -mb-px" aria-label="Claim detail tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                focus:outline-none
                ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 px-6 py-6 pb-32">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Two-column info grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trainer info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Trainer Info</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoRow label="Trainer Name" value={claim.trainerName} />
                  <InfoRow label="Currency" value={claim.currency ?? 'INR'} />
                  <InfoRow label="Submitted" value={claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not submitted'} />
                  <InfoRow label="Aging" value={`${claim.agingDays ?? 0} day(s)`} />
                  <InfoRow label="Base City" value={claim.baseCity} />
                  <InfoRow label="Country" value={(claim.destinationCities[0] ?? "")} />
                </dl>
              </div>

              {/* Assignment info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Assignment Info</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoRow label="Client" value={claim.clientName} />
                  <InfoRow label="Location" value={claim.trainingLocation} />
                  <InfoRow label="Assignment(s)" value={(claim.assignmentIds ?? []).join(', ')} />
                  <InfoRow
                    label="International"
                    value={
                      (claim.destinationCities.some(c => c !== "India")) ? (
                        <span className="text-blue-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )
                    }
                  />
                </dl>
                {claim.adminRemark && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-700 mb-1">Admin Remark</p>
                    <p className="text-sm text-amber-900">{claim.adminRemark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status timeline */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Status History</h3>
              <ClaimTimeline
                statusHistory={adaptedHistory}
                currentStatus={claim.status as ClaimStatus}
              />
            </div>

            {/* Amount summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Amount Summary</h3>
              <AmountSummary
                claimedAmount={claim.totalClaimedAmount ?? 0}
                eligibleAmount={claim.approvedAmount ?? claim.totalClaimedAmount ?? 0}
                approvedAmount={claim.approvedAmount ?? 0}
                deductionAmount={claim.deductionAmount ?? 0}
                advanceAdjusted={0}
                miscAdjustments={0}
                recoverableAmount={claim.recoverableAmount ?? 0}
                netPayable={claim.netPayable ?? 0}
                currency={claim.currency ?? 'INR'}
              />
            </div>

            {/* Remarks */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Remarks</h3>
              <RemarksPanel
                remarks={[]}
                currentUserRole={currentUser.role}
                currentUserId={currentUser.id}
              />
            </div>

            {/* Ledger — HR/Admin only */}
            {isHROrAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Ledger</h3>
                <LedgerPanel
                  claim={{
                    claimId: claim.claimId,
                    billNo: claim.billNo,
                    trainerName: claim.trainerName,
                    trainerId: '',
                    assignmentIds: claim.assignmentIds ?? [],
                    batchIds: [],
                    clientName: claim.clientName,
                    courseName: '',
                    trainingLocation: claim.trainingLocation ?? '',
                    claimStartDate: claim.submittedAt ?? '',
                    claimEndDate: claim.lastActionAt ?? '',
                    baseCity: claim.baseCity ?? '',
                    destinationCities: [],
                    status: claim.status as ClaimStatus,
                    pendingWith: (claim.pendingWith ?? 'None') as PendingWith,
                    submittedAt: claim.submittedAt,
                    lastActionAt: claim.lastActionAt ?? '',
                    totalClaimedAmount: claim.totalClaimedAmount ?? 0,
                    eligibleAmount: claim.approvedAmount ?? 0,
                    approvedAmount: claim.approvedAmount ?? 0,
                    deductionAmount: claim.deductionAmount ?? 0,
                    advanceAdjusted: 0,
                    miscAdjustments: 0,
                    recoverableAmount: claim.recoverableAmount ?? 0,
                    netPayable: claim.netPayable ?? 0,
                    currency: claim.currency ?? 'INR',
                    exceptionFlag: claim.exceptionFlag ?? false,
                    missingDocumentFlag: claim.missingDocumentFlag ?? false,
                    duplicateFlag: false,
                    ledgerMismatchFlag: claim.ledgerMismatchFlag ?? false,
                    slaBreached: claim.slaBreached ?? false,
                    paymentStatus: 'Unpaid' as PaymentStatus,
                    agingDays: claim.agingDays ?? 0,
                  }}
                  advanceRecords={[]}
                />
              </div>
            )}
          </div>
        )}

        {/* Travel */}
        {activeTab === 'travel' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Travel Legs</h3>
            <TravelTimeline travelLegs={[]} showContinuityCheck />
          </div>
        )}

        {/* DA */}
        {activeTab === 'da' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">DA Day Breakdown</h3>
              <DADayBreakdown daRecords={[]} totalDA={0} showPolicyColumn />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Leave &amp; Resource Calendar</h3>
              <ResourceLeavePanel
                trainerId={claim.trainerName}
                startDate={claim.submittedAt ?? ''}
                endDate={claim.lastActionAt ?? ''}
                leaveRecords={[]}
                assignments={[]}
              />
            </div>
          </div>
        )}

        {/* Lodging */}
        {activeTab === 'lodging' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Hotel Stays</h3>
            <LodgingStaybackPanel hotelStays={[]} policyLimit={3500} />
          </div>
        )}

        {/* Cab */}
        {activeTab === 'cab' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Cab / Conveyance</h3>
            <CabConveyancePanel cabRecords={[]} policyLimit={1500} assignmentDates={[]} />
          </div>
        )}

        {/* Other */}
        {activeTab === 'other' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Other Expenses</h3>
            <p className="text-sm text-gray-400">No other expenses recorded for this claim.</p>
          </div>
        )}

        {/* Documents */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Attachments</h3>
            <AttachmentPreview
              attachments={claimAttachments.map((a) => ({
                attachmentId: a.attachmentId,
                claimId: a.claimId,
                fileName: a.fileName,
                fileType: a.fileType,
                fileSize: a.fileSize,
                uploadedAt: a.uploadedAt,
                uploadedBy: a.uploadedBy,
                category: a.category as AttachmentCategory,
                verified: a.verified,
              }))}
              userRole={currentUser.role}
              isEditable={false}
            />
          </div>
        )}

        {/* Timeline (expanded) */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Full Status Timeline</h3>
            <ClaimTimeline
              statusHistory={adaptedHistory}
              currentStatus={claim.status as ClaimStatus}
            />
          </div>
        )}

        {/* Audit Log */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Audit Log</h3>
            <AuditTimeline
              auditLogs={claimHistory.map((h, _idx) => ({
                logId: `audit-${h.claimId}`,
                claimId: h.claimId,
                entityType: 'ClaimStatus',
                entityId: h.claimId,
                action: `Status changed: ${h.fromStatus ?? 'Created'} → ${h.toStatus}`,
                newValue: h.toStatus,
                oldValue: h.fromStatus,
                remarks: h.remarks,
                performedBy: h.changedBy,
                performedByRole: (h.changedByRole ?? 'Trainer') as UserRole,
                performedAt: h.changedAt,
              }))}
            />
          </div>
        )}
      </div>

      {/* ── Sticky action bar ── */}
      {availableActions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 hidden sm:block">
              {claim.billNo} — actions available for your role ({currentUser.role})
            </p>
            <div className="flex flex-wrap gap-2 ml-auto">
              {availableActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleActionClick(action)}
                  className={`
                    inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
                    transition-colors focus:outline-none focus:ring-2
                    ${VARIANT_STYLES[action.variant]}
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Action modal ── */}
      {activeModal && (
        <ActionModal
          title={activeModal.modalTitle ?? activeModal.label}
          label={activeModal.modalLabel ?? 'Remarks'}
          confirmLabel={activeModal.modalConfirmLabel}
          confirmColor={
            activeModal.variant === 'danger'
              ? 'bg-red-600 hover:bg-red-700'
              : activeModal.variant === 'success'
              ? 'bg-green-600 hover:bg-green-700'
              : activeModal.variant === 'warning'
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-blue-600 hover:bg-blue-700'
          }
          onConfirm={(reason) => handleActionConfirm(activeModal, reason)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl max-w-sm animate-fade-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default ClaimDetail;



