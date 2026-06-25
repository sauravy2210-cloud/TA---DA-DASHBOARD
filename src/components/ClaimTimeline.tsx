'use client';

import type { ClaimStatusHistory, ClaimStatus } from '../types';
import { formatDate } from '../services/calculationEngine';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ClaimStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-indigo-100 text-indigo-700',
  'Clarification Required': 'bg-orange-100 text-orange-700',
  Resubmitted: 'bg-cyan-100 text-cyan-700',
  Approved: 'bg-green-100 text-green-700',
  'Partially Approved': 'bg-lime-100 text-lime-700',
  Rejected: 'bg-red-100 text-red-700',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  'Payment Pending': 'bg-purple-100 text-purple-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-gray-200 text-gray-500',
  Reopened: 'bg-pink-100 text-pink-700',
};

function StatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}

// ── Icon helpers ───────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type StepVariant = 'completed' | 'current' | 'future';

function stepVariant(
  index: number,
  currentIndex: number,
): StepVariant {
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'current';
  return 'future';
}

function StepIcon({ variant }: { variant: StepVariant }) {
  if (variant === 'completed') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow">
        <CheckIcon />
      </span>
    );
  }
  if (variant === 'current') {
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 shadow">
        {/* pulsing ring */}
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
        <span className="relative h-3 w-3 rounded-full bg-white" />
      </span>
    );
  }
  // future
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white" />
  );
}

// ── Utility ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  // formatDate handles YYYY-MM-DD; for ISO datetime we extract date + time parts
  const datePart = iso.slice(0, 10);
  const timePart = iso.length > 10 ? iso.slice(11, 16) : '';
  return timePart ? `${formatDate(datePart)}, ${timePart}` : formatDate(datePart);
}

// ── Ordered status progression (for ordering history visually) ─────────────────

const STATUS_ORDER: ClaimStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Clarification Required',
  'Resubmitted',
  'Approved',
  'Partially Approved',
  'Rejected',
  'On Hold',
  'Payment Pending',
  'Paid',
  'Cancelled',
  'Reopened',
];

// ── Main component ─────────────────────────────────────────────────────────────

interface ClaimTimelineProps {
  statusHistory: ClaimStatusHistory[];
  currentStatus: ClaimStatus;
}

export default function ClaimTimeline({
  statusHistory,
  currentStatus,
}: ClaimTimelineProps) {
  // Sort history chronologically
  const sorted = [...statusHistory].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );

  // Derive future steps: statuses in canonical order that come after current and
  // have never appeared in history
  const seenStatuses = new Set(sorted.map((h) => h.toStatus));
  const currentOrderIndex = STATUS_ORDER.indexOf(currentStatus);
  const futureStatuses = STATUS_ORDER.slice(currentOrderIndex + 1).filter(
    (s) => !seenStatuses.has(s) && s !== 'Rejected' && s !== 'Cancelled',
  );

  // Build unified steps list
  type Step =
    | { kind: 'history'; entry: ClaimStatusHistory; index: number }
    | { kind: 'future'; status: ClaimStatus; index: number };

  const steps: Step[] = [
    ...sorted.map((entry, i) => ({
      kind: 'history' as const,
      entry,
      index: i,
    })),
    ...futureStatuses.map((status, i) => ({
      kind: 'future' as const,
      status,
      index: sorted.length + i,
    })),
  ];

  const lastHistoryIndex = sorted.length - 1;

  return (
    <div className="relative flex flex-col">
      {steps.map((step, stepIdx) => {
        const isLast = stepIdx === steps.length - 1;

        if (step.kind === 'history') {
          const { entry, index } = step;
          const variant = stepVariant(index, lastHistoryIndex);
          return (
            <div key={entry.historyId} className="flex gap-4">
              {/* Left: icon + connector line */}
              <div className="flex flex-col items-center">
                <StepIcon variant={variant} />
                {!isLast && (
                  <div
                    className={`mt-1 w-0.5 flex-1 ${
                      variant === 'completed'
                        ? 'bg-green-300'
                        : variant === 'current'
                          ? 'bg-blue-200'
                          : 'bg-gray-200'
                    }`}
                    style={{ minHeight: '2rem' }}
                  />
                )}
              </div>

              {/* Right: content */}
              <div className="pb-8 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={entry.toStatus} />
                  {entry.reasonCode && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                      {entry.reasonCode}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  {formatDateTime(entry.changedAt)}
                </p>

                <p className="mt-0.5 text-sm text-gray-700">
                  <span className="font-medium">{entry.changedBy}</span>
                  <span className="mx-1 text-gray-400">·</span>
                  <span className="text-gray-500">{entry.changedByRole}</span>
                </p>

                {entry.remarks && (
                  <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm italic text-gray-600">
                    &ldquo;{entry.remarks}&rdquo;
                  </p>
                )}
              </div>
            </div>
          );
        }

        // future step
        return (
          <div key={`future-${step.status}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StepIcon variant="future" />
              {!isLast && (
                <div
                  className="mt-1 w-0.5 flex-1 bg-gray-200"
                  style={{ minHeight: '2rem' }}
                />
              )}
            </div>
            <div className="pb-8 flex-1 min-w-0">
              <StatusBadge status={step.status} />
              <p className="mt-1 text-xs text-gray-400">Pending</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

