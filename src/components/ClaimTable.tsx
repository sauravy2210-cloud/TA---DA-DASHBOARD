import React, { useState, useMemo } from 'react';
import type { ClaimHeader, UserRole, ClaimStatus, PendingWith } from '../types';

// ── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ClaimStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-yellow-100 text-yellow-700',
  'Clarification Required': 'bg-orange-100 text-orange-700',
  Resubmitted: 'bg-indigo-100 text-indigo-700',
  Approved: 'bg-green-100 text-green-700',
  'Partially Approved': 'bg-teal-100 text-teal-700',
  Rejected: 'bg-red-100 text-red-700',
  'On Hold': 'bg-pink-100 text-pink-700',
  'Payment Pending': 'bg-purple-100 text-purple-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-gray-200 text-gray-500',
  Reopened: 'bg-cyan-100 text-cyan-700',
};

const PENDING_WITH_COLORS: Record<PendingWith, string> = {
  Trainer: 'bg-amber-100 text-amber-700',
  'HR/Admin': 'bg-blue-100 text-blue-700',
  Finance: 'bg-violet-100 text-violet-700',
  Approver: 'bg-orange-100 text-orange-700',
  None: 'bg-gray-100 text-gray-500',
};

const StatusBadge: React.FC<{ status: ClaimStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}
  >
    {status}
  </span>
);

const PendingWithBadge: React.FC<{ pendingWith: PendingWith }> = ({ pendingWith }) => {
  if (pendingWith === 'None') return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${PENDING_WITH_COLORS[pendingWith] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {pendingWith}
    </span>
  );
};

const RiskFlagBadge: React.FC<{ claim: ClaimHeader }> = ({ claim }) => {
  const flags: { label: string; color: string; title: string }[] = [];
  if (claim.exceptionFlag) flags.push({ label: '!', color: 'text-orange-500', title: 'Exception flag' });
  if (claim.missingDocumentFlag) flags.push({ label: '📎', color: 'text-red-500', title: 'Missing documents' });
  if (claim.duplicateFlag) flags.push({ label: '⊗', color: 'text-purple-500', title: 'Duplicate detected' });
  if (claim.ledgerMismatchFlag) flags.push({ label: '≠', color: 'text-yellow-600', title: 'Ledger mismatch' });
  if (flags.length === 0) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className="flex items-center gap-1">
      {flags.map((f, i) => (
        <span
          key={i}
          title={f.title}
          className={`text-sm font-bold cursor-default select-none ${f.color}`}
        >
          {f.label}
        </span>
      ))}
    </span>
  );
};

// ── Skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 bg-gray-200 rounded w-full" />
      </td>
    ))}
  </tr>
);

// ── EmptyState ────────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <tr>
    <td colSpan={99}>
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg
          className="w-12 h-12 mb-3 opacity-40"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M9 7a4 4 0 118 0A4 4 0 019 7zM3 20a9 9 0 0118 0"
          />
        </svg>
        <p className="text-sm">{message}</p>
      </div>
    </td>
  </tr>
);

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null;

interface SortState {
  key: keyof ClaimHeader | null;
  dir: SortDir;
}

function sortClaims(claims: ClaimHeader[], sort: SortState): ClaimHeader[] {
  if (!sort.key || !sort.dir) return claims;
  const key = sort.key;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...claims].sort((a, b) => {
    const av = a[key] as string | number | boolean;
    const bv = b[key] as string | number | boolean;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

// ── Column header with sort indicator ────────────────────────────────────────

const ColHeader: React.FC<{
  label: string;
  sortKey?: keyof ClaimHeader;
  sort: SortState;
  onSort: (key: keyof ClaimHeader) => void;
}> = ({ label, sortKey, sort, onSort }) => {
  const active = sortKey && sort.key === sortKey;
  return (
    <th
      scope="col"
      className={`
        px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide
        whitespace-nowrap select-none
        ${sortKey ? 'cursor-pointer hover:text-gray-800' : ''}
      `}
      onClick={() => sortKey && onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey && (
          <span className={`text-xs ${active ? 'text-blue-500' : 'text-gray-300'}`}>
            {active && sort.dir === 'asc' ? '▲' : active && sort.dir === 'desc' ? '▼' : '⇅'}
          </span>
        )}
      </span>
    </th>
  );
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Main component ────────────────────────────────────────────────────────────

interface ClaimTableProps {
  claims: ClaimHeader[];
  onClaimClick: (claimId: string) => void;
  userRole: UserRole;
  showCheckboxes?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  loading?: boolean;
  emptyMessage?: string;
}

export const ClaimTable: React.FC<ClaimTableProps> = ({
  claims,
  onClaimClick,
  userRole,
  showCheckboxes = false,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  loading = false,
  emptyMessage = 'No claims found.',
}) => {
  const [sort, setSort] = useState<SortState>({ key: null, dir: null });

  const isPrivileged = userRole === 'HRAdmin' || userRole === 'SuperAdmin';
  const canBulk = isPrivileged && showCheckboxes;

  const handleSort = (key: keyof ClaimHeader) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: null };
    });
  };

  const sorted = useMemo(() => sortClaims(claims, sort), [claims, sort]);

  const allSelected = claims.length > 0 && claims.every((c) => selectedIds.includes(c.claimId));

  // Count visible columns for skeleton
  const colCount =
    (canBulk ? 1 : 0) +
    14 + // fixed columns
    (isPrivileged ? 1 : 0); // Trainer Name/ID

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        {/* Sticky header */}
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {/* Checkbox column */}
            {canBulk && (
              <th scope="col" className="pl-3 pr-2 py-3 w-8">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={allSelected}
                  onChange={onSelectAll}
                  aria-label="Select all claims"
                />
              </th>
            )}

            <ColHeader label="Bill No" sortKey="billNo" sort={sort} onSort={handleSort} />
            {isPrivileged && (
              <ColHeader label="Trainer" sortKey="trainerName" sort={sort} onSort={handleSort} />
            )}
            <ColHeader label="Batch ID" sort={sort} onSort={handleSort} />
            <ColHeader label="Client" sortKey="clientName" sort={sort} onSort={handleSort} />
            <ColHeader label="Course" sortKey="courseName" sort={sort} onSort={handleSort} />
            <ColHeader label="Training Location" sortKey="trainingLocation" sort={sort} onSort={handleSort} />
            <ColHeader label="Claim Period" sortKey="claimStartDate" sort={sort} onSort={handleSort} />
            <ColHeader label="Claimed ₹" sortKey="totalClaimedAmount" sort={sort} onSort={handleSort} />
            <ColHeader label="Approved ₹" sortKey="approvedAmount" sort={sort} onSort={handleSort} />
            <ColHeader label="Deduction ₹" sortKey="deductionAmount" sort={sort} onSort={handleSort} />
            <ColHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
            <ColHeader label="Pending With" sortKey="pendingWith" sort={sort} onSort={handleSort} />
            <ColHeader label="Aging" sortKey="agingDays" sort={sort} onSort={handleSort} />
            <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
              Risk Flags
            </th>
            <ColHeader label="Last Action" sortKey="lastActionAt" sort={sort} onSort={handleSort} />
            <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Action
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
          ) : sorted.length === 0 ? (
            <EmptyState message={emptyMessage} />
          ) : (
            sorted.map((claim) => {
              const isSelected = selectedIds.includes(claim.claimId);
              const agingColor = claim.slaBreached
                ? 'text-red-600 font-semibold'
                : claim.agingDays > 10
                ? 'text-orange-500'
                : 'text-gray-700';

              return (
                <tr
                  key={claim.claimId}
                  className={`
                    transition-colors duration-100 cursor-pointer
                    hover:bg-blue-50
                    ${isSelected ? 'bg-blue-50' : 'bg-white'}
                  `}
                  onClick={() => onClaimClick(claim.claimId)}
                >
                  {/* Checkbox */}
                  {canBulk && (
                    <td
                      className="pl-3 pr-2 py-3 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(claim.claimId)}
                        aria-label={`Select claim ${claim.billNo}`}
                      />
                    </td>
                  )}

                  {/* Bill No — link style */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaimClick(claim.claimId);
                      }}
                    >
                      {claim.billNo}
                    </button>
                  </td>

                  {/* Trainer Name/ID — HRAdmin/SuperAdmin only */}
                  {isPrivileged && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-gray-800 font-medium text-xs">{claim.trainerName}</div>
                      <div className="text-gray-400 text-xs">{claim.trainerId}</div>
                    </td>
                  )}

                  {/* Batch IDs */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-700">
                    {claim.batchIds.join(', ') || '—'}
                  </td>

                  {/* Client */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-700 max-w-[140px] truncate" title={claim.clientName}>
                    {claim.clientName}
                  </td>

                  {/* Course */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-700 max-w-[140px] truncate" title={claim.courseName}>
                    {claim.courseName}
                  </td>

                  {/* Training Location */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-700">
                    {claim.trainingLocation}
                  </td>

                  {/* Claim Period */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                    <div>{fmtDate(claim.claimStartDate)}</div>
                    <div className="text-gray-400">to {fmtDate(claim.claimEndDate)}</div>
                  </td>

                  {/* Claimed */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-800 font-medium">
                    {fmt(claim.totalClaimedAmount)}
                  </td>

                  {/* Approved */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-green-700 font-medium">
                    {fmt(claim.approvedAmount)}
                  </td>

                  {/* Deduction */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-red-600">
                    {claim.deductionAmount > 0 ? `-${fmt(claim.deductionAmount)}` : '—'}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <StatusBadge status={claim.status} />
                  </td>

                  {/* Pending With */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <PendingWithBadge pendingWith={claim.pendingWith} />
                  </td>

                  {/* Aging Days */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`text-xs ${agingColor}`}>
                      {claim.agingDays}d
                      {claim.slaBreached && (
                        <span className="ml-1 text-red-500 font-bold" title="SLA Breached">⚠</span>
                      )}
                    </span>
                  </td>

                  {/* Risk Flags */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <RiskFlagBadge claim={claim} />
                  </td>

                  {/* Last Action */}
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                    {fmtDate(claim.lastActionAt)}
                  </td>

                  {/* Action button */}
                  <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onClaimClick(claim.claimId)}
                      className="
                        inline-flex items-center px-2.5 py-1 text-xs font-medium
                        text-blue-700 bg-blue-50 border border-blue-200
                        rounded hover:bg-blue-100 transition-colors duration-100
                        focus:outline-none focus:ring-2 focus:ring-blue-400
                      "
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ClaimTable;

