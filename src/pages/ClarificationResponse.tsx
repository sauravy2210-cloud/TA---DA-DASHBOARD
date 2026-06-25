import React, { useCallback, useRef, useState } from 'react';
import type { User, ClaimLineItem, ClaimAttachment } from '../types';
import {
  mockClaims,
  mockLineItems,
  mockAttachments,
  mockRemarks,
} from '../data/mockClaims';
import { logAction, ACTION_TYPES } from '../services/auditEngine';
import {
  createNotification,
  NOTIFICATION_TYPES,
} from '../services/notificationEngine';
import { saveClaim, saveAuditLog } from '../services/storageService';
import DocumentChecklist from '../components/DocumentChecklist';

// ── Types ────────────────────────────────────────────────────────────────────

interface ClarificationResponseProps {
  currentUser: User;
}

interface TrainerLineResponse {
  lineItemId: string;
  text: string;
  replacementFile: File | null;
}

// ── Reason code labels ───────────────────────────────────────────────────────

const REASON_CODE_LABELS: Record<string, string> = {
  RC001_OVER_POLICY_LIMIT: 'Over Policy Limit',
  RC002_NO_RECEIPT: 'No Receipt',
  RC003_DUPLICATE_CLAIM: 'Duplicate Claim',
  RC004_LEAVE_DAY_DA: 'Leave Day DA',
  RC005_PERSONAL_STAYBACK: 'Personal Stayback',
  RC006_NON_ELIGIBLE_EXPENSE: 'Non-Eligible Expense',
  RC007_CITY_TIER_MISMATCH: 'City Tier Mismatch',
  RC008_DATE_OUT_OF_RANGE: 'Date Out of Range',
  RC009_ADVANCE_ADJUSTED: 'Advance Adjusted',
  RC010_EXCEPTION_APPROVED: 'Exception Approved',
  RC011_EXCEPTION_REJECTED: 'Exception Rejected',
  RC012_PARTIAL_DAY_DEPART: 'Partial Day — Departure',
  RC013_PARTIAL_DAY_ARRIVE: 'Partial Day — Arrival',
  RC014_COMPANY_BOOKING_USED: 'Company Booking Used',
  RC015_CAB_NOT_ELIGIBLE: 'Cab Not Eligible',
  RC016_INVOICE_MISMATCH: 'Invoice Mismatch',
  RC017_AMOUNT_REDUCED: 'Amount Reduced',
  RC018_BOARDING_PASS_MISSING: 'Boarding Pass Missing',
  RC019_PNR_MISMATCH: 'PNR Mismatch',
  RC020_HOTEL_RATE_EXCEEDED: 'Hotel Rate Exceeded',
  RC021_MULTIPLE_TRAINER_SPLIT: 'Multiple Trainer Split',
  RC022_LEDGER_MISMATCH: 'Ledger Mismatch',
  RC023_POLICY_NOT_APPLICABLE: 'Policy Not Applicable',
  RC024_SLA_BREACH: 'SLA Breach',
  RC025_CLAIM_REOPENED: 'Claim Reopened',
  RC026_PAYMENT_ON_HOLD: 'Payment On Hold',
  RC027_TAX_COMPONENT_EXCLUDED: 'Tax Component Excluded',
  RC028_CURRENCY_CONVERSION_APPLIED: 'Currency Conversion Applied',
  RC029_MISSING_SUPPORTING_DOC: 'Missing Supporting Doc',
  RC030_ADMIN_DISCRETIONARY_ADJUSTMENT: 'Admin Discretionary Adjustment',
};

// ── Helper: doc category badge ───────────────────────────────────────────────

function isDocumentRelatedReason(reasonCode?: string): boolean {
  if (!reasonCode) return false;
  const docCodes = [
    'RC002_NO_RECEIPT',
    'RC016_INVOICE_MISMATCH',
    'RC018_BOARDING_PASS_MISSING',
    'RC019_PNR_MISMATCH',
    'RC022_LEDGER_MISMATCH',
    'RC029_MISSING_SUPPORTING_DOC',
  ];
  return docCodes.includes(reasonCode);
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    TA: 'Travel Allowance',
    DA: 'Daily Allowance',
    Lodging: 'Lodging',
    Cab: 'Cab / Conveyance',
    Other: 'Other Expense',
  };
  return map[cat] ?? cat;
}

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Mock: clarification deadline (5 days from status change) ─────────────────

const CLARIFICATION_DEADLINE = '2026-06-28';

// ── Flagged document checklist for TA-2026-0039 ──────────────────────────────

const FLAGGED_DOC_REQUIREMENTS = ['Cab Receipt (All 4)', 'Bank Statement Extract'];

// ── HR admin ID for notification routing ─────────────────────────────────────

const HR_ADMIN_RECIPIENT_ID = 'usr-hradmin-001';

// ── Main Component ───────────────────────────────────────────────────────────

const ClarificationResponse: React.FC<ClarificationResponseProps> = ({ currentUser }) => {
  // Resolve claim — in a real app this comes from useParams() / router
  const claimId = 'clm-0039';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claim = ((mockClaims as any[]).find((c) => c.claimId === claimId) ?? mockClaims[2]) as any;
  const allLineItems = (mockLineItems as unknown as Array<ClaimLineItem & Record<string, unknown>>).filter((li) => li.claimId === claimId);
  const allAttachments = mockAttachments.filter((a) => a.claimId === claimId);
  const claimRemarks = mockRemarks.filter((r) => r.claimId === claimId);

  // Clarification-flagged line items (cab receipts flagged in mock data)
  const flaggedLineItems = allLineItems.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (li) => (li as any).category === 'Cab' || (li as any).id === 'li-0039-04',
  );
  const nonFlaggedLineItems = allLineItems.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (li) => !flaggedLineItems.find((f) => (f as any).id === (li as any).id),
  );

  // Uploaded document state
  const [uploadedDocs, setUploadedDocs] = useState<ClaimAttachment[]>(allAttachments);

  // Per-line-item trainer responses
  const [lineResponses, setLineResponses] = useState<Record<string, TrainerLineResponse>>(() => {
    const init: Record<string, TrainerLineResponse> = {};
    flaggedLineItems.forEach((li) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (li as any).id as string;
      init[id] = { lineItemId: id, text: '', replacementFile: null };
    });
    return init;
  });

  // Overall declaration
  const [declarationText, setDeclarationText] = useState('');
  const [declarationChecked, setDeclarationChecked] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // File input refs for document replacements
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Validation ─────────────────────────────────────────────────────────────

  const allLineResponsesFilled = flaggedLineItems.every(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (li) => (lineResponses[(li as any).id as string]?.text ?? '').trim().length >= 10,
  );
  const canSubmit =
    allLineResponsesFilled &&
    declarationText.trim().length >= 10 &&
    declarationChecked &&
    !isSubmitting;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLineResponseChange = useCallback(
    (lineItemId: string, text: string) => {
      setLineResponses((prev) => ({
        ...prev,
        [lineItemId]: { ...prev[lineItemId], text },
      }));
    },
    [],
  );

  const handleReplacementFile = useCallback(
    (lineItemId: string, file: File | null) => {
      setLineResponses((prev) => ({
        ...prev,
        [lineItemId]: { ...prev[lineItemId], replacementFile: file },
      }));
    },
    [],
  );

  const handleDocUpload = useCallback((file: File, category: string) => {
    const newAttachment: ClaimAttachment = {
      attachmentId: `att-new-${Date.now()}`,
      claimId,
      fileName: file.name,
      fileType: file.type.split('/')[1] ?? 'pdf',
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser.name,
      category: category as ClaimAttachment['category'],
      verified: false,
    };
    setUploadedDocs((prev) => [...prev, newAttachment]);
  }, [currentUser.name, claimId]);

  const handleResubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Update claim status to Submitted (Resubmitted semantics)
      const updatedClaim = {
        ...claim,
        status: 'Submitted' as const,
        pendingWith: 'HR/Admin' as const,
        updatedAt: new Date().toISOString(),
        adminRemark: null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveClaim(updatedClaim as any);

      // 2. Write audit log
      const auditEntry = logAction({
        claimId,
        entityType: 'Claim',
        entityId: claimId,
        action: ACTION_TYPES.RESUBMITTED,
        oldValue: 'Clarification Required',
        newValue: 'Submitted',
        remarks: `Trainer resubmitted with clarification. Declaration: ${declarationText.slice(0, 120)}`,
        performedBy: currentUser.name,
        performedByRole: currentUser.role,
      });
      saveAuditLog(auditEntry);

      // 3. Notify HR/Admin
      createNotification({
        recipientId: HR_ADMIN_RECIPIENT_ID,
        type: NOTIFICATION_TYPES.CLAIM_RESUBMITTED,
        title: 'Clarification Responded — Resubmitted',
        message: `Bill ${claim.billNo as string} has been resubmitted by ${currentUser.name} with clarification responses. Please review and continue processing.`,
        relatedClaimId: claimId,
      });

      setSubmitted(true);
    } catch (err) {
      setSubmitError('An error occurred while resubmitting. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, claim, claimId, currentUser, declarationText]);

  // ── Success screen ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Clarification Submitted</h2>
          <p className="text-sm text-gray-600 mb-1">
            Bill <span className="font-semibold">{claim.billNo as string}</span> has been resubmitted to HR/Admin for review.
          </p>
          <p className="text-xs text-gray-400 mb-6">Your responses and documents have been recorded in the audit trail.</p>
          <a
            href="/my-bills"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
          >
            Back to My Bills
          </a>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Respond to Clarification &mdash; Bill No:{' '}
              <span className="text-blue-700 font-mono">{claim.billNo as string}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {claim.trainerName as string} &bull; {claim.trainingLocation as string} &bull; {claim.clientName as string}
            </p>
          </div>
          <a
            href="/my-bills"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            My Bills
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ── Alert Banner ── */}
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3.5 shadow-sm">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Clarification required by HR / Admin.
            </p>
            <p className="text-sm text-amber-700">
              Please respond to all flagged items and provide the requested documents by{' '}
              <span className="font-semibold">{formatDate(CLARIFICATION_DEADLINE)}</span>.
              Failure to respond may result in rejection of the affected line items.
            </p>
          </div>
        </div>

        {/* ── Section 1: Original Claim Summary ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section 1</span>
            <h2 className="text-sm font-semibold text-gray-800">Original Claim Summary</h2>
            <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              Read-only
            </span>
          </div>

          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Trainer</p>
              <p className="font-semibold text-gray-800">{claim.trainerName as string}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Bill No</p>
              <p className="font-mono text-gray-800">{claim.billNo as string}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Client</p>
              <p className="text-gray-800">{claim.clientName as string}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Location</p>
              <p className="text-gray-800">{claim.trainingLocation as string}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Submitted On</p>
              <p className="text-gray-800">{formatDate((claim.submittedAt ?? claim.submittedAt) as string)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Status</p>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                {claim.status as string}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">All Claimed Line Items (read-only)</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Description</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Unit</th>
                    <th className="px-3 py-2 text-right font-semibold">Claimed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {allLineItems.map((li) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const liAny = li as any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const isFlagged = !!flaggedLineItems.find((f) => (f as any).id === liAny.id);
                    return (
                      <tr
                        key={liAny.id as string}
                        className={isFlagged ? 'bg-amber-50' : 'hover:bg-gray-50 transition-colors'}
                      >
                        <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            {categoryLabel(liAny.category as string)}
                            {isFlagged && (
                              <span className="inline-flex items-center rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                FLAGGED
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-xs">
                          <span className="line-clamp-2">{li.description}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{liAny.quantity as number}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(liAny.unitAmount as number)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(li.claimedAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Total Claimed
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                      {fmt(allLineItems.reduce((s, li) => s + li.claimedAmount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* HR Admin's clarification remark */}
          {claimRemarks.filter((r) => r.type === 'HR' || r.type === 'System').length > 0 && (
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">HR Admin Remarks</p>
              <div className="flex flex-col gap-2">
                {claimRemarks
                  .filter((r) => r.type === 'HR' || r.type === 'System')
                  .map((r) => (
                    <div key={r.remarkId} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                      <span className="font-medium text-gray-800">{r.createdBy}</span>{' '}
                      <span className="text-gray-400 text-xs">{formatDate(r.createdAt)}</span>
                      <p className="mt-0.5 text-gray-700">{r.text}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 2: Clarification Items ── */}
        <section className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">Section 2</span>
            <h2 className="text-sm font-semibold text-gray-800">Clarification Items</h2>
            <span className="ml-auto text-xs text-amber-700 font-medium">
              {flaggedLineItems.length} item{flaggedLineItems.length !== 1 ? 's' : ''} require response
            </span>
          </div>

          <div className="divide-y divide-amber-50">
            {flaggedLineItems.map((li) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const liAny = li as any;
              const liId = liAny.id as string;
              const resp = lineResponses[liId];
              const isDocRelated = isDocumentRelatedReason(liAny.reasonCode as string | undefined);
              const isComplete = (resp?.text ?? '').trim().length >= 10;

              return (
                <div key={liId} className="px-5 py-5">
                  {/* Line item header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {categoryLabel(liAny.category as string)}
                        </span>
                        {liAny.reasonCode && (
                          <span className="inline-flex items-center rounded-md bg-red-50 border border-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            {REASON_CODE_LABELS[liAny.reasonCode as string] ?? liAny.reasonCode as string}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{li.description}</p>
                      {liAny.date && (
                        <p className="text-xs text-gray-400 mt-0.5">Date: {formatDate(liAny.date as string)}</p>
                      )}
                    </div>
                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isComplete ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {isComplete ? (
                        <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Original vs Admin-flagged side-by-side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        Original Claim Value
                      </p>
                      <p className="text-lg font-bold text-gray-900">{fmt(li.claimedAmount)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {liAny.quantity as number} &times; {fmt(liAny.unitAmount as number)}
                      </p>
                      {liAny.receiptRef && (
                        <p className="text-xs text-gray-400 mt-1">
                          Ref: <span className="font-mono">{liAny.receiptRef as string}</span>
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
                        Admin-Flagged Issue
                      </p>
                      {liAny.deductionReason ? (
                        <p className="text-sm text-amber-800 leading-snug">{liAny.deductionReason as string}</p>
                      ) : (
                        <p className="text-sm text-amber-700 italic">
                          Receipts partially available. Please provide all 4 cab receipts to support
                          the claimed amount of {fmt(li.claimedAmount)}.
                        </p>
                      )}
                      <p className="text-xs text-amber-600 mt-2 font-medium">
                        Flagged on: {formatDate('2026-06-18T14:30:00.000Z')} by Neha Sharma (HR Admin)
                      </p>
                    </div>
                  </div>

                  {/* Trainer response textarea */}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Your Response{' '}
                      <span className="text-red-500">*</span>
                      <span className="text-gray-400 font-normal ml-1">(min. 10 characters)</span>
                    </label>
                    <textarea
                      className={`w-full rounded-lg border text-sm px-3 py-2.5 resize-none focus:outline-none focus:ring-2 transition-colors ${
                        (resp?.text ?? '').length > 0 && !isComplete
                          ? 'border-red-300 bg-red-50 focus:ring-red-200'
                          : isComplete
                          ? 'border-green-300 bg-green-50 focus:ring-green-200'
                          : 'border-gray-300 bg-white focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      rows={3}
                      placeholder={`Explain the discrepancy or provide supporting information for this ${categoryLabel(liAny.category as string)} item...`}
                      value={resp?.text ?? ''}
                      onChange={(e) => handleLineResponseChange(liId, e.target.value)}
                    />
                    {(resp?.text ?? '').length > 0 && !isComplete && (
                      <p className="text-xs text-red-500 mt-1">
                        Please provide at least 10 characters in your response.
                      </p>
                    )}
                  </div>

                  {/* Document replacement (only for doc-related reason codes) */}
                  {isDocRelated && (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                        Document Replacement Required
                      </p>
                      {resp?.replacementFile ? (
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{resp.replacementFile.name}</p>
                            <p className="text-xs text-gray-500">
                              {(resp.replacementFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReplacementFile(liId, null)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[liId]?.click()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload Replacement Document
                          </button>
                          <p className="text-[11px] text-blue-600 mt-1.5">
                            Upload a replacement receipt, invoice, or supporting document. Accepted: PDF, JPG, PNG (max 5MB).
                          </p>
                        </div>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[liId] = el; }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          handleReplacementFile(liId, file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Non-flagged line items — read-only summary */}
          {nonFlaggedLineItems.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Non-flagged items (no response required — read-only)
              </p>
              <div className="flex flex-col gap-1.5">
                {nonFlaggedLineItems.map((li) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const liAny = li as any;
                  return (
                    <div
                      key={liAny.id as string}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                          {liAny.category as string}
                        </span>
                        <span className="text-gray-700 text-xs">{li.description}</span>
                      </div>
                      <span className="font-semibold text-gray-800 text-xs shrink-0 ml-3">
                        {fmt(li.claimedAmount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 3: Updated Documents ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section 3</span>
            <h2 className="text-sm font-semibold text-gray-800">Updated Documents</h2>
            <span className="ml-auto text-xs text-gray-500">Flagged items only</span>
          </div>
          <div className="px-5 py-5">
            <DocumentChecklist
              requiredDocs={FLAGGED_DOC_REQUIREMENTS}
              uploadedAttachments={uploadedDocs}
              onUpload={handleDocUpload}
              isEditable={true}
            />
          </div>
        </section>

        {/* ── Section 4: Trainer Declaration ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section 4</span>
            <h2 className="text-sm font-semibold text-gray-800">Trainer Declaration</h2>
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Overall Response Remarks{' '}
                <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(min. 10 characters)</span>
              </label>
              <textarea
                className={`w-full rounded-lg border text-sm px-3 py-2.5 resize-none focus:outline-none focus:ring-2 transition-colors ${
                  declarationText.length > 0 && declarationText.trim().length < 10
                    ? 'border-red-300 bg-red-50 focus:ring-red-200'
                    : declarationText.trim().length >= 10
                    ? 'border-green-300 bg-green-50 focus:ring-green-200'
                    : 'border-gray-300 bg-white focus:ring-blue-200 focus:border-blue-400'
                }`}
                rows={4}
                placeholder="Provide an overall summary of your clarification responses. Explain any discrepancies, missing documents, or context that will help HR/Admin process your claim accurately..."
                value={declarationText}
                onChange={(e) => setDeclarationText(e.target.value)}
              />
              {declarationText.length > 0 && declarationText.trim().length < 10 && (
                <p className="text-xs text-red-500 mt-1">Please provide at least 10 characters.</p>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <p className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors leading-snug">
                I have reviewed the clarification request from HR/Admin and confirm that all information
                provided in this response — including uploaded documents, expense descriptions, and
                remarks — is accurate and complete to the best of my knowledge.
              </p>
            </label>
          </div>
        </section>

        {/* ── Validation Summary ── */}
        {!canSubmit && (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Before you can resubmit:
            </p>
            <ul className="flex flex-col gap-1.5">
              {flaggedLineItems.map((li) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const liAny = li as any;
                const liId = liAny.id as string;
                const filled = (lineResponses[liId]?.text ?? '').trim().length >= 10;
                return (
                  <li key={liId} className={`flex items-center gap-2 text-sm ${filled ? 'text-green-700' : 'text-gray-600'}`}>
                    {filled ? (
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    )}
                    Response for: <span className="font-medium">{li.description.slice(0, 50)}{li.description.length > 50 ? '...' : ''}</span>
                  </li>
                );
              })}
              <li className={`flex items-center gap-2 text-sm ${declarationText.trim().length >= 10 ? 'text-green-700' : 'text-gray-600'}`}>
                {declarationText.trim().length >= 10 ? (
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                Overall declaration remarks provided
              </li>
              <li className={`flex items-center gap-2 text-sm ${declarationChecked ? 'text-green-700' : 'text-gray-600'}`}>
                {declarationChecked ? (
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                Trainer declaration checkbox checked
              </li>
            </ul>
          </div>
        )}

        {/* ── Submit Bar ── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            {canSubmit ? (
              <span className="text-green-600 font-medium">All checks passed. Ready to resubmit.</span>
            ) : (
              <span>Complete all required fields above to enable resubmit.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/my-bills"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </a>
            <button
              type="button"
              onClick={handleResubmit}
              disabled={!canSubmit}
              className={`rounded-lg px-5 py-2 text-sm font-semibold shadow transition-all ${
                canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resubmitting...
                </span>
              ) : (
                'Resubmit Claim'
              )}
            </button>
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClarificationResponse;


