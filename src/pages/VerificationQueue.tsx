import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, ClaimHeader, ClaimStatus, PendingWith, PaymentStatus } from '../types';
import { ClaimTable } from '../components/ClaimTable';
import { getClaims, STORAGE_KEYS, saveToStorage } from '../services/storageService';
import { exportClaimsQueue } from '../services/exportEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VerificationQueueProps {
  currentUser?: User;
}

// Aging bucket labels
type AgingBucket = '<1d' | '1-2d' | '2-3d' | '3-5d' | '>5d' | '>10d';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CLAIM_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Under Review', value: 'UNDER REVIEW' },
  { label: 'Clarification Required', value: 'CLARIFICATION REQUIRED' },
  { label: 'Resubmitted', value: 'RESUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Partially Approved', value: 'PARTIALLY APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'On Hold', value: 'ON HOLD' },
  { label: 'Payment Pending', value: 'PAYMENT PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PAYMENT_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'Unpaid', value: 'Unpaid' },
  { label: 'Processed', value: 'Processed' },
  { label: 'Paid', value: 'Paid' },
];

const EXPENSE_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'TA (Travel)', value: 'TA' },
  { label: 'DA (Daily Allowance)', value: 'DA' },
  { label: 'Lodging', value: 'Lodging' },
  { label: 'Cab / Conveyance', value: 'Cab' },
  { label: 'Other', value: 'Other' },
];

const AGING_BUCKET_OPTIONS: { label: string; value: AgingBucket }[] = [
  { label: '< 1 day', value: '<1d' },
  { label: '1 – 2 days', value: '1-2d' },
  { label: '2 – 3 days', value: '2-3d' },
  { label: '3 – 5 days', value: '3-5d' },
  { label: '> 5 days', value: '>5d' },
  { label: '> 10 days', value: '>10d' },
];

const ADMIN_OWNERS = [
  { label: 'Neha Sharma', value: 'neha.sharma' },
  { label: 'Amit Kulkarni', value: 'amit.kulkarni' },
  { label: 'Ritu Mehta', value: 'ritu.mehta' },
  { label: 'Unassigned', value: 'unassigned' },
];

interface Filters {
  trainerSearch: string;
  billNo: string;
  assignmentId: string;
  batchId: string;
  course: string;
  client: string;
  trainingLocation: string;
  country: string;
  city: string;
  claimStatuses: string[];
  paymentStatus: string;
  expenseType: string;
  dateFrom: string;
  dateTo: string;
  agingBuckets: AgingBucket[];
  adminOwner: string;
  exceptionFlag: boolean;
  missingDocFlag: boolean;
  duplicateFlag: boolean;
  highValue: boolean;
  ledgerMismatch: boolean;
  slaBreached: boolean;
  amountMin: string;
  amountMax: string;
}

const EMPTY_FILTERS: Filters = {
  trainerSearch: '',
  billNo: '',
  assignmentId: '',
  batchId: '',
  course: '',
  client: '',
  trainingLocation: '',
  country: '',
  city: '',
  claimStatuses: [],
  paymentStatus: '',
  expenseType: '',
  dateFrom: '',
  dateTo: '',
  agingBuckets: [],
  adminOwner: '',
  exceptionFlag: false,
  missingDocFlag: false,
  duplicateFlag: false,
  highValue: false,
  ledgerMismatch: false,
  slaBreached: false,
  amountMin: '',
  amountMax: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function agingBucketMatch(agingDays: number, buckets: AgingBucket[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.some((b) => {
    if (b === '<1d') return agingDays < 1;
    if (b === '1-2d') return agingDays >= 1 && agingDays <= 2;
    if (b === '2-3d') return agingDays > 2 && agingDays <= 3;
    if (b === '3-5d') return agingDays > 3 && agingDays <= 5;
    if (b === '>5d') return agingDays > 5;
    if (b === '>10d') return agingDays > 10;
    return false;
  });
}

function filterClaims(claims: ClaimHeader[], filters: Filters, search: string): ClaimHeader[] {
  const q = search.trim().toLowerCase();

  return claims.filter((c) => {
    // Search bar — bill no, PNR (simulated as billNumber prefix), trainer name, client
    if (q) {
      const hay = [
        c.billNo ?? '',
        c.trainerName ?? '',
        c.clientName ?? '',
        // simulate PNR as first 8 chars of billNumber reversed
        (c.billNo ?? '').split('').reverse().join('').substring(0, 10),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    // Trainer name/ID/email
    if (filters.trainerSearch.trim()) {
      const ts = filters.trainerSearch.trim().toLowerCase();
      if (!(c.trainerName ?? '').toLowerCase().includes(ts)) return false;
    }

    // Bill number
    if (filters.billNo.trim()) {
      if (!(c.billNo ?? '').toLowerCase().includes(filters.billNo.trim().toLowerCase())) return false;
    }

    // Assignment ID
    if (filters.assignmentId.trim()) {
      const aid = filters.assignmentId.trim().toLowerCase();
      if (!(c.assignmentIds ?? []).some((a: string) => a.toLowerCase().includes(aid))) return false;
    }

    // Batch ID
    if (filters.batchId.trim()) {
      const bid = filters.batchId.trim().toLowerCase();
      if (!(c.assignmentIds ?? []).some((a: string) => a.toLowerCase().includes(bid))) return false;
    }

    // Course — not in mock, skip silently
    // Client
    if (filters.client.trim()) {
      if (!(c.clientName ?? '').toLowerCase().includes(filters.client.trim().toLowerCase())) return false;
    }

    // Training location
    if (filters.trainingLocation.trim()) {
      const loc = `${c.trainingLocation ?? ''} ${c.baseCity ?? ''}`.toLowerCase();
      if (!loc.includes(filters.trainingLocation.trim().toLowerCase())) return false;
    }

    // Country
    if (filters.country.trim()) {
      if (!(c.destinationCities[0] ?? '').toLowerCase().includes(filters.country.trim().toLowerCase())) return false;
    }

    // City
    if (filters.city.trim()) {
      if (!(c.baseCity ?? '').toLowerCase().includes(filters.city.trim().toLowerCase())) return false;
    }

    // Claim status multi-select (filter values are uppercase keys, compare case-insensitively)
    if (filters.claimStatuses.length > 0) {
      if (!filters.claimStatuses.includes((c.status ?? '').toUpperCase().trim())) return false;
    }

    // Payment status
    if (filters.paymentStatus) {
      const su = (c.status ?? '').toUpperCase();
      const isPaid = su === 'PAID';
      const isProcessed = su === 'PAYMENT PENDING';
      const isUnpaid = !isPaid && !isProcessed;
      if (filters.paymentStatus === 'Paid' && !isPaid) return false;
      if (filters.paymentStatus === 'Processed' && !isProcessed) return false;
      if (filters.paymentStatus === 'Unpaid' && !isUnpaid) return false;
    }

    // Aging buckets
    if (!agingBucketMatch(c.agingDays ?? 0, filters.agingBuckets)) return false;

    // Admin owner — not tracked on mock, skip unless unassigned
    if (filters.adminOwner === 'unassigned') {
      // treat all mock claims as unassigned for demo
    }

    // Flag filters
    if (filters.exceptionFlag && !c.exceptionFlag) return false;
    if (filters.missingDocFlag && !c.missingDocumentFlag) return false;
    if (filters.duplicateFlag && !c.duplicateFlag) return false;
    if (filters.highValue && !c.highValue) return false;
    if (filters.ledgerMismatch && !c.ledgerMismatchFlag) return false;
    if (filters.slaBreached && !c.slaBreached) return false;

    // Amount range
    const minFilter = parseFloat(filters.amountMin || '0');
    const maxFilter = parseFloat(filters.amountMax || '0');
    const amount = c.totalClaimedAmount ?? 0;
    if (!isNaN(minFilter) && minFilter > 0 && amount < minFilter) return false;
    if (!isNaN(maxFilter) && maxFilter > 0 && amount > maxFilter) return false;

    // Submitted date range
    if (filters.dateFrom && c.submittedAt) {
      if (new Date(c.submittedAt) < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo && c.submittedAt) {
      if (new Date(c.submittedAt) > new Date(`${filters.dateTo}T23:59:59`)) return false;
    }

    return true;
  });
}

// No-op adapter — getClaims() already returns ClaimHeader[]
function adaptToClaimHeader(c: ClaimHeader): ClaimHeader { return c; }

const STATUS_MAP: Record<string, ClaimStatus> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  'UNDER REVIEW': 'Under Review',
  'CLARIFICATION REQUIRED': 'Clarification Required',
  RESUBMITTED: 'Resubmitted',
  APPROVED: 'Approved',
  'PARTIALLY APPROVED': 'Partially Approved',
  REJECTED: 'Rejected',
  'ON HOLD': 'On Hold',
  'PAYMENT PENDING': 'Payment Pending',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

function toClaimStatus(s: string): ClaimStatus {
  return STATUS_MAP[s?.toUpperCase()] ?? 'Draft';
}

function toPendingWith(s: string | null | undefined): PendingWith {
  const map: Record<string, PendingWith> = {
    Trainer: 'Trainer',
    'HR/Admin': 'HR/Admin',
    Finance: 'Finance',
    Approver: 'Approver',
    Reviewer: 'HR/Admin',
  };
  if (!s) return 'None';
  return map[s] ?? 'None';
}

// ─── Small UI helpers ────────────────────────────────────────────────────────

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
    {label}
    <button
      type="button"
      onClick={onRemove}
      className="ml-0.5 text-blue-500 hover:text-blue-800 focus:outline-none"
      aria-label={`Remove filter: ${label}`}
    >
      ×
    </button>
  </span>
);

const CheckboxFilter: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}> = ({ label, checked, onChange, color = 'text-blue-600' }) => (
  <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-gray-700 hover:text-gray-900">
    <input
      type="checkbox"
      className={`rounded border-gray-300 ${color} focus:ring-2 focus:ring-offset-0`}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const VerificationQueue: React.FC<VerificationQueueProps> = ({ currentUser }) => {
  const navigate = useNavigate();

  // ── State ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Load all real claims from localStorage
  const allClaims = useMemo<ClaimHeader[]>(() => getClaims(), []);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filterClaims(allClaims, filters, search),
    [allClaims, filters, search]
  );

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const adaptedClaims = useMemo(() => paginated.map(adaptToClaimHeader), [paginated]);

  // ── Selection ────────────────────────────────────────────────────────────
  const allOnPageSelected =
    paginated.length > 0 && paginated.every((c) => selectedIds.includes(c.claimId));

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (allOnPageSelected) {
      const pageIds = new Set(paginated.map((c) => c.claimId));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginated.map((c) => c.claimId);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }, [allOnPageSelected, paginated]);

  // ── Bulk approve eligibility ─────────────────────────────────────────────
  const selectedClaims = useMemo(
    () => allClaims.filter((c) => selectedIds.includes(c.claimId)),
    [allClaims, selectedIds]
  );

  const bulkApproveEligible =
    selectedClaims.length > 0 &&
    selectedClaims.every(
      (c) =>
        !c.exceptionFlag &&
        !c.missingDocumentFlag &&
        !c.duplicateFlag &&
        !c.ledgerMismatchFlag &&
        !c.slaBreached &&
        ['Submitted', 'Under Review', 'Resubmitted'].includes(c.status ?? '')
    );

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const updateClaimsInStorage = useCallback(
    (ids: string[], updater: (c: ClaimHeader) => Partial<ClaimHeader>) => {
      const storedAll = getClaims();
      const storedMap = new Map(storedAll.map((c) => [c.claimId, c]));

      const updatedList = allClaims
        .filter((c) => ids.includes(c.claimId))
        .map((c) => {
          const base = storedMap.get(c.claimId) ?? c;
          return { ...base, ...updater(c) };
        });

      const idsSet = new Set(ids);
      const retained = storedAll.filter((c) => !idsSet.has(c.claimId));
      saveToStorage(STORAGE_KEYS.CLAIMS, [...retained, ...updatedList]);
    },
    [allClaims]
  );

  const handleMarkUnderReview = () => {
    updateClaimsInStorage(selectedIds, () => ({
      status: 'Under Review' as import('../types').ClaimStatus,
      lastActionAt: new Date().toISOString(),
    }));
    alert(`Marked ${selectedIds.length} claim(s) as Under Review.`);
    setSelectedIds([]);
  };

  const handleBulkApprove = () => {
    if (!bulkApproveEligible) return;
    updateClaimsInStorage(selectedIds, (c) => ({
      status: 'Approved' as import('../types').ClaimStatus,
      approvedAmount: c.totalClaimedAmount,
      lastActionAt: new Date().toISOString(),
    }));
    alert(`Bulk approved ${selectedIds.length} claim(s).`);
    setSelectedIds([]);
  };

  const handleAssignReviewer = () => {
    const reviewer = prompt('Enter reviewer name to assign:');
    if (!reviewer) return;
    updateClaimsInStorage(selectedIds, () => ({
      adminRemark: `Assigned to ${reviewer}`,
      lastActionAt: new Date().toISOString(),
    }));
    alert(`Assigned ${selectedIds.length} claim(s) to ${reviewer}.`);
    setSelectedIds([]);
  };

  const handleReassignReviewer = () => {
    const reviewer = prompt('Enter new reviewer name:');
    if (!reviewer) return;
    updateClaimsInStorage(selectedIds, () => ({
      adminRemark: `Reassigned to ${reviewer}`,
      lastActionAt: new Date().toISOString(),
    }));
    alert(`Reassigned ${selectedIds.length} claim(s) to ${reviewer}.`);
    setSelectedIds([]);
  };

  const handleExportSelected = () => {
    const toExport = allClaims
      .filter((c) => selectedIds.includes(c.claimId))
      .map(adaptToClaimHeader);
    exportClaimsQueue(toExport as import('../types').ClaimHeader[]);
  };

  const handleSendReminder = () => {
    const trainers = [
      ...new Set(
        allClaims.filter((c) => selectedIds.includes(c.claimId)).map((c) => c.trainerName)
      ),
    ].join(', ');
    alert(`Reminder sent to: ${trainers}`);
    setSelectedIds([]);
  };

  // ── Filter helpers ───────────────────────────────────────────────────────
  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    setSelectedIds([]);
  }, []);

  const toggleStatusFilter = (value: string) => {
    setFilters((prev) => {
      const already = prev.claimStatuses.includes(value);
      return {
        ...prev,
        claimStatuses: already
          ? prev.claimStatuses.filter((s) => s !== value)
          : [...prev.claimStatuses, value],
      };
    });
    setPage(1);
    setSelectedIds([]);
  };

  const toggleAgingBucket = (value: AgingBucket) => {
    setFilters((prev) => {
      const already = prev.agingBuckets.includes(value);
      return {
        ...prev,
        agingBuckets: already
          ? prev.agingBuckets.filter((b) => b !== value)
          : [...prev.agingBuckets, value],
      };
    });
    setPage(1);
    setSelectedIds([]);
  };

  const handleClearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
    setSelectedIds([]);
  };

  // ── Active filter pills ──────────────────────────────────────────────────
  const activeFilterPills: { label: string; onRemove: () => void }[] = [];

  if (search) activeFilterPills.push({ label: `Search: "${search}"`, onRemove: () => setSearch('') });
  if (filters.trainerSearch) activeFilterPills.push({ label: `Trainer: ${filters.trainerSearch}`, onRemove: () => setFilter('trainerSearch', '') });
  if (filters.billNo) activeFilterPills.push({ label: `Bill: ${filters.billNo}`, onRemove: () => setFilter('billNo', '') });
  if (filters.assignmentId) activeFilterPills.push({ label: `Assignment: ${filters.assignmentId}`, onRemove: () => setFilter('assignmentId', '') });
  if (filters.batchId) activeFilterPills.push({ label: `Batch: ${filters.batchId}`, onRemove: () => setFilter('batchId', '') });
  if (filters.client) activeFilterPills.push({ label: `Client: ${filters.client}`, onRemove: () => setFilter('client', '') });
  if (filters.trainingLocation) activeFilterPills.push({ label: `Location: ${filters.trainingLocation}`, onRemove: () => setFilter('trainingLocation', '') });
  if (filters.country) activeFilterPills.push({ label: `Country: ${filters.country}`, onRemove: () => setFilter('country', '') });
  if (filters.city) activeFilterPills.push({ label: `City: ${filters.city}`, onRemove: () => setFilter('city', '') });
  filters.claimStatuses.forEach((s) =>
    activeFilterPills.push({ label: `Status: ${s}`, onRemove: () => toggleStatusFilter(s) })
  );
  if (filters.paymentStatus) activeFilterPills.push({ label: `Payment: ${filters.paymentStatus}`, onRemove: () => setFilter('paymentStatus', '') });
  if (filters.expenseType) activeFilterPills.push({ label: `Expense: ${filters.expenseType}`, onRemove: () => setFilter('expenseType', '') });
  filters.agingBuckets.forEach((b) =>
    activeFilterPills.push({ label: `Aging: ${b}`, onRemove: () => toggleAgingBucket(b) })
  );
  if (filters.adminOwner) activeFilterPills.push({ label: `Owner: ${ADMIN_OWNERS.find((o) => o.value === filters.adminOwner)?.label ?? filters.adminOwner}`, onRemove: () => setFilter('adminOwner', '') });
  if (filters.exceptionFlag) activeFilterPills.push({ label: 'Exception flag', onRemove: () => setFilter('exceptionFlag', false) });
  if (filters.missingDocFlag) activeFilterPills.push({ label: 'Missing docs', onRemove: () => setFilter('missingDocFlag', false) });
  if (filters.duplicateFlag) activeFilterPills.push({ label: 'Duplicate', onRemove: () => setFilter('duplicateFlag', false) });
  if (filters.highValue) activeFilterPills.push({ label: 'High value', onRemove: () => setFilter('highValue', false) });
  if (filters.ledgerMismatch) activeFilterPills.push({ label: 'Ledger mismatch', onRemove: () => setFilter('ledgerMismatch', false) });
  if (filters.slaBreached) activeFilterPills.push({ label: 'SLA breached', onRemove: () => setFilter('slaBreached', false) });
  if (filters.amountMin) activeFilterPills.push({ label: `Min ₹${filters.amountMin}`, onRemove: () => setFilter('amountMin', '') });
  if (filters.amountMax) activeFilterPills.push({ label: `Max ₹${filters.amountMax}`, onRemove: () => setFilter('amountMax', '') });
  if (filters.dateFrom) activeFilterPills.push({ label: `From: ${filters.dateFrom}`, onRemove: () => setFilter('dateFrom', '') });
  if (filters.dateTo) activeFilterPills.push({ label: `To: ${filters.dateTo}`, onRemove: () => setFilter('dateTo', '') });

  const userRole = currentUser?.role ?? 'HRAdmin';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Verification Queue</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-blue-600 text-white">
              {filtered.length}
            </span>
          </div>

          {/* Bulk action header buttons — disabled until selection */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleAssignReviewer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Assign Reviewer
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleReassignReviewer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Reassign
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleMarkUnderReview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              Mark Under Review
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleExportSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export Selected
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleSendReminder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              Send Reminder
            </button>
            <button
              type="button"
              disabled={!bulkApproveEligible}
              onClick={handleBulkApprove}
              title={
                selectedIds.length === 0
                  ? 'Select claims first'
                  : !bulkApproveEligible
                  ? 'Cannot bulk approve: some selected claims have flags or ineligible status'
                  : `Bulk approve ${selectedIds.length} claim(s)`
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-green-500 bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Bulk Approve
            </button>
          </div>
        </div>

        {/* Selected count indicator */}
        {selectedIds.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
            <span className="font-medium">{selectedIds.length} claim(s) selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-blue-500 hover:text-blue-700 underline text-xs"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* ── Search bar ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-2xl">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }}
              placeholder="Search bill no, PNR, invoice, trainer, payment ref..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              filterOpen || activeFilterPills.length > 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Filters
            {activeFilterPills.length > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-blue-700 text-xs font-bold">
                {activeFilterPills.length}
              </span>
            )}
          </button>

          {activeFilterPills.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm text-red-500 hover:text-red-700 font-medium underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {activeFilterPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {activeFilterPills.map((p, i) => (
              <FilterChip key={i} label={p.label} onRemove={p.onRemove} />
            ))}
          </div>
        )}
      </div>

      {/* ── Advanced filter panel ── */}
      {filterOpen && (
        <div className="bg-white border-b border-gray-200 px-6 py-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">

            {/* Trainer name/ID/email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trainer Name / ID / Email</label>
              <input
                type="text"
                value={filters.trainerSearch}
                onChange={(e) => setFilter('trainerSearch', e.target.value)}
                placeholder="e.g. Rahul Verma"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Bill number */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill Number</label>
              <input
                type="text"
                value={filters.billNo}
                onChange={(e) => setFilter('billNo', e.target.value)}
                placeholder="e.g. TA-2026-0051"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Assignment ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assignment ID</label>
              <input
                type="text"
                value={filters.assignmentId}
                onChange={(e) => setFilter('assignmentId', e.target.value)}
                placeholder="e.g. asgn-HYD-2026-112"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Batch ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Batch ID</label>
              <input
                type="text"
                value={filters.batchId}
                onChange={(e) => setFilter('batchId', e.target.value)}
                placeholder="e.g. batch-2026"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Course */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Course</label>
              <input
                type="text"
                value={filters.course}
                onChange={(e) => setFilter('course', e.target.value)}
                placeholder="Course name"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client</label>
              <input
                type="text"
                value={filters.client}
                onChange={(e) => setFilter('client', e.target.value)}
                placeholder="e.g. Infosys"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Training Location */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Training Location</label>
              <input
                type="text"
                value={filters.trainingLocation}
                onChange={(e) => setFilter('trainingLocation', e.target.value)}
                placeholder="City or venue"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Country</label>
              <input
                type="text"
                value={filters.country}
                onChange={(e) => setFilter('country', e.target.value)}
                placeholder="e.g. UAE"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">City</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => setFilter('city', e.target.value)}
                placeholder="e.g. Hyderabad"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Payment status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilter('paymentStatus', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">All</option>
                {PAYMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Expense type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Expense Type</label>
              <select
                value={filters.expenseType}
                onChange={(e) => setFilter('expenseType', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">All</option>
                {EXPENSE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Admin owner */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Admin Owner</label>
              <select
                value={filters.adminOwner}
                onChange={(e) => setFilter('adminOwner', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">All</option>
                {ADMIN_OWNERS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Amount range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Amount Range (₹)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={filters.amountMin}
                  onChange={(e) => setFilter('amountMin', e.target.value)}
                  placeholder="Min"
                  min={0}
                  className="w-1/2 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="number"
                  value={filters.amountMax}
                  onChange={(e) => setFilter('amountMax', e.target.value)}
                  placeholder="Max"
                  min={0}
                  className="w-1/2 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Submitted date range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Submitted Date Range</label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter('dateFrom', e.target.value)}
                  className="w-1/2 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter('dateTo', e.target.value)}
                  className="w-1/2 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Claim status multi-select */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Claim Status</label>
            <div className="flex flex-wrap gap-2">
              {CLAIM_STATUS_OPTIONS.map((o) => {
                const active = filters.claimStatuses.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleStatusFilter(o.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aging buckets */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Aging Bucket</label>
            <div className="flex flex-wrap gap-2">
              {AGING_BUCKET_OPTIONS.map((o) => {
                const active = filters.agingBuckets.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleAgingBucket(o.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      active
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flag checkboxes */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Risk Flags</label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <CheckboxFilter
                label="Exception flag"
                checked={filters.exceptionFlag}
                onChange={(v) => setFilter('exceptionFlag', v)}
                color="text-orange-500"
              />
              <CheckboxFilter
                label="Missing documents"
                checked={filters.missingDocFlag}
                onChange={(v) => setFilter('missingDocFlag', v)}
                color="text-red-500"
              />
              <CheckboxFilter
                label="Duplicate claim"
                checked={filters.duplicateFlag}
                onChange={(v) => setFilter('duplicateFlag', v)}
                color="text-purple-500"
              />
              <CheckboxFilter
                label="High value"
                checked={filters.highValue}
                onChange={(v) => setFilter('highValue', v)}
                color="text-yellow-600"
              />
              <CheckboxFilter
                label="Ledger mismatch"
                checked={filters.ledgerMismatch}
                onChange={(v) => setFilter('ledgerMismatch', v)}
                color="text-yellow-600"
              />
              <CheckboxFilter
                label="SLA breached"
                checked={filters.slaBreached}
                onChange={(v) => setFilter('slaBreached', v)}
                color="text-red-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk actions bar (appears when rows selected) ── */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-semibold text-blue-800">
              {selectedIds.length} selected
            </span>
            <span className="text-blue-300">|</span>
            <button
              type="button"
              onClick={handleAssignReviewer}
              className="text-blue-700 hover:text-blue-900 font-medium hover:underline"
            >
              Assign Reviewer
            </button>
            <button
              type="button"
              onClick={handleReassignReviewer}
              className="text-blue-700 hover:text-blue-900 font-medium hover:underline"
            >
              Reassign Reviewer
            </button>
            <button
              type="button"
              onClick={handleMarkUnderReview}
              className="text-yellow-700 hover:text-yellow-900 font-medium hover:underline"
            >
              Mark Under Review
            </button>
            <button
              type="button"
              onClick={handleExportSelected}
              className="text-gray-700 hover:text-gray-900 font-medium hover:underline"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={handleSendReminder}
              className="text-indigo-700 hover:text-indigo-900 font-medium hover:underline"
            >
              Send Reminder to Trainer
            </button>
            <button
              type="button"
              disabled={!bulkApproveEligible}
              onClick={handleBulkApprove}
              title={!bulkApproveEligible ? 'Cannot bulk approve: some claims have flags or ineligible status' : undefined}
              className="font-semibold text-green-700 hover:text-green-900 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Bulk Approve
              {!bulkApproveEligible && selectedIds.length > 0 && (
                <span className="ml-1 text-xs font-normal text-red-500">(blocked)</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 px-6 py-4">
        <ClaimTable
          claims={adaptedClaims as import('../types').ClaimHeader[]}
          onClaimClick={(claimId) => navigate(`/claims/${claimId}/review`)}
          userRole={userRole}
          showCheckboxes={true}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          emptyMessage="No claims match your current filters."
        />
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} claims
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      page === p
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationQueue;




