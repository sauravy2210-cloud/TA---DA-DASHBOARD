import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { FilterBar } from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import { SearchInput } from '../components/SearchInput';
import { ClaimTable } from '../components/ClaimTable';
import { getClaims, deleteClaim, refreshClaims, getDraftClaims, deleteDraftClaim } from '../services/storageService';
import { exportClaimsQueue } from '../services/exportEngine';
import type { ClaimHeader } from '../types';

// ─── Props ─────────────────────────────────────────────────────────────────

interface MyBillsProps {
  currentUser?: User;
}

// ─── Filter config ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Submitted', value: 'Submitted' },
  { label: 'Under Review', value: 'Under Review' },
  { label: 'Clarification Required', value: 'Clarification Required' },
  { label: 'Resubmitted', value: 'Resubmitted' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Partially Approved', value: 'Partially Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'On Hold', value: 'On Hold' },
  { label: 'Payment Pending', value: 'Payment Pending' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Cancelled', value: 'Cancelled' },
];

const PAYMENT_STATUS_OPTIONS = [
  { label: 'Unpaid', value: 'Unpaid' },
  { label: 'Processed', value: 'Processed' },
  { label: 'Paid', value: 'Paid' },
];

const FILTER_CONFIGS: FilterConfig[] = [
  { key: 'dateRange', label: 'Date Range', type: 'daterange' },
  { key: 'status', label: 'Status', type: 'multiselect', options: STATUS_OPTIONS },
  { key: 'batchId', label: 'Batch ID', type: 'text' },
  { key: 'client', label: 'Client', type: 'text' },
  { key: 'trainingLocation', label: 'Training Location', type: 'text' },
  { key: 'paymentStatus', label: 'Payment Status', type: 'select', options: PAYMENT_STATUS_OPTIONS },
  { key: 'amountMin', label: 'Min Amount (₹)', type: 'text' },
  { key: 'amountMax', label: 'Max Amount (₹)', type: 'text' },
];

const EMPTY_FILTERS: Record<string, string | string[]> = {
  dateRange: ['', ''],
  status: [],
  batchId: '',
  client: '',
  trainingLocation: '',
  paymentStatus: '',
  amountMin: '',
  amountMax: '',
};

const PAGE_SIZE = 10;

const DEFAULT_USER: User = {
  id: '',
  name: '',
  role: 'Trainer',
  email: '',
  avatarInitials: '',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeStatus(status: string): string {
  return status;
}

function matchesSearch(claim: ClaimHeader, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  return (
    (claim.billNo ?? '').toLowerCase().includes(lower) ||
    (claim.assignmentIds ?? []).some((a: string) => a.toLowerCase().includes(lower)) ||
    (claim.clientName ?? '').toLowerCase().includes(lower)
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

const MyBills: React.FC<MyBillsProps> = ({ currentUser = DEFAULT_USER }) => {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Record<string, string | string[]>>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [allClaims, setAllClaims] = useState<ClaimHeader[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Always pull fresh from Turso on mount; merge local drafts at end
  useEffect(() => {
    refreshClaims().then(() => {
      const submitted = getClaims();
      const drafts = getDraftClaims();
      // Merge: submitted claims take priority over any draft with same ID
      const submittedIds = new Set(submitted.map(c => c.claimId));
      const pendingDrafts = drafts.filter(d => !submittedIds.has(d.claimId));
      setAllClaims([...submitted, ...pendingDrafts]);
    });
  }, []);

  // Filter claims to current trainer (for Trainer role) or all for others
  const ownClaims = useMemo(() => {
    if (currentUser.role === 'Trainer') {
      return allClaims.filter(
        (c) => c.trainerId === (currentUser.trainerId || currentUser.id) ||
               c.trainerName === currentUser.name
      );
    }
    return allClaims;
  }, [currentUser, allClaims]);

  const filtered = useMemo(() => {
    return ownClaims.filter((claim) => {
      // Search
      if (!matchesSearch(claim, search)) return false;

      // Status multi-select
      const statusFilter = filters.status as string[];
      if (statusFilter.length > 0) {
        if (!statusFilter.some((s) => normalizeStatus(claim.status) === s)) return false;
      }

      // Batch ID
      const batchFilter = (filters.batchId as string).trim().toLowerCase();
      if (batchFilter) {
        const batchMatch = (claim.assignmentIds ?? []).some((a: string) =>
          a.toLowerCase().includes(batchFilter)
        );
        if (!batchMatch) return false;
      }

      // Client
      const clientFilter = (filters.client as string).trim().toLowerCase();
      if (clientFilter && !(claim.clientName ?? '').toLowerCase().includes(clientFilter)) return false;

      // Training Location
      const locFilter = (filters.trainingLocation as string).trim().toLowerCase();
      if (locFilter) {
        const loc = `${claim.baseCity ?? ''} ${claim.trainingLocation ?? ''}`.toLowerCase();
        if (!loc.includes(locFilter)) return false;
      }

      // Payment status — map from claim status
      const psFilter = filters.paymentStatus as string;
      if (psFilter) {
        const statusVal = normalizeStatus(claim.status);
        const isPaid = statusVal === 'Paid';
        const isProcessed = statusVal === 'Payment Pending';
        const isUnpaid = !isPaid && !isProcessed;
        if (psFilter === 'Paid' && !isPaid) return false;
        if (psFilter === 'Processed' && !isProcessed) return false;
        if (psFilter === 'Unpaid' && !isUnpaid) return false;
      }

      // Date range — match against claim period (start/end date) or submittedAt
      const dateRange = filters.dateRange as string[];
      const [dateFrom, dateTo] = dateRange;
      if (dateFrom || dateTo) {
        // Use claim period if available, fall back to submittedAt
        const claimFrom = claim.claimStartDate || claim.submittedAt || '';
        const claimTo   = claim.claimEndDate   || claim.submittedAt || '';
        if (dateFrom && claimTo && claimTo < dateFrom) return false;
        if (dateTo   && claimFrom && claimFrom > `${dateTo}T23:59:59`) return false;
      }

      // Amount range
      const minFilter = parseFloat((filters.amountMin as string) || '0');
      const maxFilter = parseFloat(filters.amountMax as string);
      const amount = claim.totalClaimedAmount ?? 0;
      if (!isNaN(minFilter) && minFilter > 0 && amount < minFilter) return false;
      if (!isNaN(maxFilter) && maxFilter > 0 && amount > maxFilter) return false;

      return true;
    });
  }, [ownClaims, filters, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const adaptedClaims = useMemo(() => paginated, [paginated]);

  const handleFilterChange = (key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
  };

  const handleExportCSV = () => {
    exportClaimsQueue(filtered as ClaimHeader[]);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      // Check if it's a local draft or a submitted claim
      const drafts = getDraftClaims();
      const isDraft = drafts.some(d => d.claimId === deleteConfirmId);
      if (isDraft) {
        deleteDraftClaim(deleteConfirmId);
        setAllClaims(prev => prev.filter(c => c.claimId !== deleteConfirmId));
      } else {
        await deleteClaim(deleteConfirmId);
        await refreshClaims();
        const submitted = getClaims();
        const remaining = getDraftClaims().filter(d => !submitted.some(c => c.claimId === d.claimId));
        setAllClaims([...submitted, ...remaining]);
      }
      setDeleteConfirmId(null);
    } catch {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Bills / Claim History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} claim{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="
              inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              text-gray-700 bg-white border border-gray-300 rounded-lg
              hover:bg-gray-50 hover:border-gray-400 transition-colors
              focus:outline-none focus:ring-2 focus:ring-gray-400
            "
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 space-y-3">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by Bill No, Batch ID, or Client name..."
          className="max-w-md"
        />
        <FilterBar
          filters={FILTER_CONFIGS}
          values={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      {/* ── Table ── */}
      <div className="flex-1 px-6 py-4">
        {/* Draft bills shown above submitted bills */}
        {adaptedClaims.some(c => c.status === 'Draft') && (
          <div className="mb-4 space-y-2">
            <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Saved Drafts
            </h2>
            {adaptedClaims.filter(c => c.status === 'Draft').map(draft => (
              <div key={draft.claimId} className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-800">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      Draft
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{draft.billNo}</span>
                    {draft.claimStartDate && (
                      <span className="text-xs text-gray-500">
                        {draft.claimStartDate}{draft.claimEndDate && draft.claimEndDate !== draft.claimStartDate ? ` → ${draft.claimEndDate}` : ''}
                      </span>
                    )}
                    {draft.trainingLocation && (
                      <span className="text-xs text-gray-500">• {draft.trainingLocation}</span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 mt-1">Saved automatically — click Resume to continue editing</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/create-bill?draft=${draft.claimId}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(draft.claimId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                    title="Delete draft"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ClaimTable
          claims={adaptedClaims.filter(c => c.status !== 'Draft') as ClaimHeader[]}
          onClaimClick={(claimId) => navigate(`/claims/${claimId}`)}
          userRole={currentUser.role}
          onDeleteClaim={currentUser.role === 'Trainer' ? setDeleteConfirmId : undefined}
          onEditClaim={currentUser.role === 'Trainer' ? (claimId) => navigate(`/create-bill?edit=${claimId}`) : undefined}
          emptyMessage="No claims match your filters."
        />
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteConfirmId && (() => {
        const bill = allClaims.find(c => c.claimId === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Delete Bill</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to delete bill{' '}
                <span className="font-semibold text-gray-900">{bill?.billNo ?? deleteConfirmId}</span>?
              </p>
              {deleteError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{deleteError}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
                >
                  {deleteLoading ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="
                px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300
                text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
              "
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
                  <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    className={`
                      px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                      focus:outline-none focus:ring-2 focus:ring-blue-400
                      ${
                        page === p
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="
                px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300
                text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
              "
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBills;



