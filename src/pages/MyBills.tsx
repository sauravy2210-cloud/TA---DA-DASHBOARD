import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { FilterBar } from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import { SearchInput } from '../components/SearchInput';
import { ClaimTable } from '../components/ClaimTable';
import { getClaims } from '../services/storageService';
import { exportClaimsQueue } from '../services/exportEngine';
import type { ClaimStatus, PendingWith, PaymentStatus, ClaimHeader } from '../types';

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

  // Reload from storage whenever this page mounts
  useEffect(() => {
    setAllClaims(getClaims());
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

      // Date range (by submittedAt)
      const dateRange = filters.dateRange as string[];
      const [dateFrom, dateTo] = dateRange;
      if (dateFrom && claim.submittedAt) {
        if (new Date(claim.submittedAt) < new Date(dateFrom)) return false;
      }
      if (dateTo && claim.submittedAt) {
        if (new Date(claim.submittedAt) > new Date(`${dateTo}T23:59:59`)) return false;
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
          <button
            type="button"
            onClick={() => navigate('/claims/new')}
            className="
              inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              text-white bg-blue-600 border border-transparent rounded-lg
              hover:bg-blue-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Claim
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
        <ClaimTable
          claims={adaptedClaims as ClaimHeader[]}
          onClaimClick={(claimId) => navigate(`/claims/${claimId}`)}
          userRole={currentUser.role}
          emptyMessage="No claims match your filters."
        />
      </div>

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



