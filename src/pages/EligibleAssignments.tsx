import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { mockAssignments } from '../data/mockAssignments';
import { mockClaims } from '../data/mockClaims';

// ── Local types ───────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'table';

type EligibilityFilter = 'All' | 'Eligible' | 'Claimed' | 'Deadline Passed' | 'Upcoming';

interface Filters {
  dateFrom: string;
  dateTo: string;
  status: EligibilityFilter;
  client: string;
  course: string;
  country: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date('2026-06-24');

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.ceil((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function deriveDisplayStatus(
  assignmentStatus: string,
  claimDeadline: string | undefined,
  isClaimed: boolean,
): 'Eligible' | 'Claimed' | 'Deadline Passed' | 'Upcoming' {
  if (assignmentStatus === 'Upcoming') return 'Upcoming';
  if (isClaimed) return 'Claimed';
  if (assignmentStatus === 'Cancelled') return 'Deadline Passed';
  if (claimDeadline) {
    const days = daysBetween(claimDeadline);
    if (days < 0) return 'Deadline Passed';
  }
  return 'Eligible';
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReturnType<typeof deriveDisplayStatus> }) {
  const styles: Record<typeof status, string> = {
    Eligible: 'bg-green-100 text-green-800 border border-green-300',
    Claimed: 'bg-blue-100 text-blue-800 border border-blue-300',
    'Deadline Passed': 'bg-red-100 text-red-800 border border-red-300',
    Upcoming: 'bg-gray-100 text-gray-600 border border-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

// ── Already-claimed badge ─────────────────────────────────────────────────────

function AlreadyClaimedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-300">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Already Claimed
    </span>
  );
}

// ── Deadline pill ─────────────────────────────────────────────────────────────

function DeadlinePill({ deadline }: { deadline: string | undefined }) {
  if (!deadline) return <span className="text-gray-400 text-xs">No deadline</span>;
  const days = daysBetween(deadline);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Passed ({formatDate(deadline)})
      </span>
    );
  }
  if (days < 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        {days}d left ({formatDate(deadline)})
      </span>
    );
  }
  return <span className="text-xs text-gray-600">{formatDate(deadline)}</span>;
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  displayStatus,
  isClaimed,
  onCreateClaim,
  onViewClaim,
  onRequestExtension,
  onSetReminder,
}: {
  displayStatus: ReturnType<typeof deriveDisplayStatus>;
  isClaimed: boolean;
  onCreateClaim: () => void;
  onViewClaim: () => void;
  onRequestExtension: () => void;
  onSetReminder: () => void;
}) {
  if (isClaimed || displayStatus === 'Claimed') {
    return (
      <button
        onClick={onViewClaim}
        className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300 transition-colors"
      >
        View Claim
      </button>
    );
  }
  if (displayStatus === 'Eligible') {
    return (
      <button
        onClick={onCreateClaim}
        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
      >
        Create TA/DA Bill
      </button>
    );
  }
  if (displayStatus === 'Deadline Passed') {
    return (
      <button
        onClick={onRequestExtension}
        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 transition-colors"
      >
        Request Extension
      </button>
    );
  }
  // Upcoming
  return (
    <button
      onClick={onSetReminder}
      className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300 transition-colors"
    >
      Set Reminder
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  currentUser: User;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EligibleAssignments({ currentUser }: Props) {
  const navigate = useNavigate();

  // Derive trainer ID from user
  const trainerId = currentUser.trainerId ?? currentUser.id;

  // Filter assignments for this trainer
  const trainerAssignments = useMemo(
    () =>
      mockAssignments.filter((a) =>
        a.trainerIds.some((id) => id === trainerId),
      ),
    [trainerId],
  );

  // Build claimed assignment id set from mockClaims
  const claimedAssignmentIds = useMemo(() => {
    const set = new Set<string>();
    mockClaims.forEach((c) => {
      if (Array.isArray(c.assignmentIds)) {
        c.assignmentIds.forEach((id) => set.add(id));
      }
    });
    return set;
  }, []);

  // Filters state
  const [filters, setFilters] = useState<Filters>({
    dateFrom: '',
    dateTo: '',
    status: 'All',
    client: '',
    course: '',
    country: '',
  });

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reminder toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  // Unique filter options derived from trainer's assignments
  const clientOptions = useMemo(
    () => [...new Set(trainerAssignments.map((a) => a.clientName))].sort(),
    [trainerAssignments],
  );
  const courseOptions = useMemo(
    () => [...new Set(trainerAssignments.map((a) => a.courseName))].sort(),
    [trainerAssignments],
  );
  const countryOptions = useMemo(
    () => [...new Set(trainerAssignments.map((a) => a.country))].sort(),
    [trainerAssignments],
  );

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return trainerAssignments.filter((a) => {
      const isClaimed = claimedAssignmentIds.has(a.assignmentId);
      const displayStatus = deriveDisplayStatus(a.status, a.claimDeadline, isClaimed);

      if (filters.status !== 'All' && displayStatus !== filters.status) return false;
      if (filters.client && a.clientName !== filters.client) return false;
      if (filters.course && a.courseName !== filters.course) return false;
      if (filters.country && a.country !== filters.country) return false;
      if (filters.dateFrom && a.startDate < filters.dateFrom) return false;
      if (filters.dateTo && a.endDate > filters.dateTo) return false;
      return true;
    });
  }, [trainerAssignments, claimedAssignmentIds, filters]);

  // Selection helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectableIds(): string[] {
    return filteredAssignments
      .filter((a) => {
        const isClaimed = claimedAssignmentIds.has(a.assignmentId);
        const ds = deriveDisplayStatus(a.status, a.claimDeadline, isClaimed);
        return ds === 'Eligible' && !isClaimed;
      })
      .map((a) => a.assignmentId);
  }

  const canMultiClaim = [...selectedIds].length >= 2;

  function handleCreateClaim(assignmentId: string) {
    navigate(`/claims/new?assignmentId=${assignmentId}`);
  }

  function handleViewClaim(assignmentId: string) {
    const claim = mockClaims.find((c) => c.assignmentIds?.includes(assignmentId));
    if (claim) navigate(`/claims/${claim.claimId}`);
    else showToast('No claim found for this assignment.');
  }

  function handleRequestExtension(assignmentId: string) {
    showToast(`Extension request initiated for assignment ${assignmentId}.`);
  }

  function handleSetReminder(assignmentId: string) {
    showToast(`Reminder set for assignment ${assignmentId}.`);
  }

  function handleMultiClaim() {
    const ids = [...selectedIds].join(',');
    navigate(`/claims/new?assignmentIds=${ids}`);
  }

  function handleSelectAll() {
    const ids = selectableIds();
    if (ids.every((id) => selectedIds.has(id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl animate-pulse">
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMsg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Eligible Assignments</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Showing assignments for{' '}
              <span className="font-medium text-gray-700">{currentUser.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canMultiClaim && (
              <button
                onClick={handleMultiClaim}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Create Multi-Assignment Claim ({[...selectedIds].length})
              </button>
            )}
            {!canMultiClaim && (
              <button
                onClick={() => showToast('Select 2 or more eligible assignments to create a multi-assignment claim.')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Create Multi-Assignment Claim
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as EligibilityFilter }))}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {(['All', 'Eligible', 'Claimed', 'Deadline Passed', 'Upcoming'] as const).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Client */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Client</label>
              <select
                value={filters.client}
                onChange={(e) => setFilters((f) => ({ ...f, client: e.target.value }))}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Clients</option>
                {clientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Course */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Course</label>
              <select
                value={filters.course}
                onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value }))}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Courses</option>
                {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Country */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Country</label>
              <select
                value={filters.country}
                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Countries</option>
                {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Filter actions row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''} shown
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilters({ dateFrom: '', dateTo: '', status: 'All', client: '', course: '', country: '' })}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear filters
              </button>
              {/* View toggle */}
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-3.5 h-3.5 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-3.5 h-3.5 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                  </svg>
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Multi-select bar ── */}
        {selectableIds().length > 0 && (
          <div className="flex items-center gap-3 mb-4 px-1">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectableIds().every((id) => selectedIds.has(id))}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
              />
              Select all eligible ({selectableIds().length})
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-1 rounded-full border border-indigo-200">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {filteredAssignments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 font-medium">No assignments match your filters.</p>
            <button
              onClick={() => setFilters({ dateFrom: '', dateTo: '', status: 'All', client: '', course: '', country: '' })}
              className="mt-3 text-sm text-indigo-600 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* ── Grid View ── */}
        {viewMode === 'grid' && filteredAssignments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAssignments.map((assignment) => {
              const isClaimed = claimedAssignmentIds.has(assignment.assignmentId);
              const displayStatus = deriveDisplayStatus(assignment.status, assignment.claimDeadline, isClaimed);
              const isSelectable = displayStatus === 'Eligible' && !isClaimed;
              const isSelected = selectedIds.has(assignment.assignmentId);

              return (
                <div
                  key={assignment.assignmentId}
                  className={`bg-white rounded-xl border transition-all shadow-sm hover:shadow-md ${
                    isSelected
                      ? 'border-indigo-400 ring-2 ring-indigo-200'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2.5">
                      {/* Checkbox */}
                      {isSelectable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(assignment.assignmentId)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer mt-0.5 flex-shrink-0"
                        />
                      )}
                      {/* Client logo placeholder */}
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-indigo-600 uppercase leading-none">
                          {assignment.clientName.substring(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-500 truncate">{assignment.assignmentId}</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{assignment.clientName}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={displayStatus} />
                      {isClaimed && <AlreadyClaimedBadge />}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 pb-3 space-y-2">
                    {/* Course */}
                    <div className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p className="text-xs text-gray-700 font-medium leading-snug">{assignment.courseName}</p>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-xs text-gray-600">
                        {assignment.city}, {assignment.country}
                        <span className="ml-1 text-gray-400">({assignment.cityTier})</span>
                      </p>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-gray-600">
                        {formatDate(assignment.startDate)} — {formatDate(assignment.endDate)}
                      </p>
                    </div>

                    {/* Batch ID */}
                    {assignment.batchId && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <p className="text-xs text-gray-500">Batch: <span className="font-medium">{assignment.batchId}</span></p>
                      </div>
                    )}

                    {/* Deadline */}
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Deadline:</span>
                        <DeadlinePill deadline={assignment.claimDeadline} />
                      </div>
                    </div>
                  </div>

                  {/* Card footer / action */}
                  <div className="px-4 pb-4">
                    <ActionButton
                      displayStatus={displayStatus}
                      isClaimed={isClaimed}
                      onCreateClaim={() => handleCreateClaim(assignment.assignmentId)}
                      onViewClaim={() => handleViewClaim(assignment.assignmentId)}
                      onRequestExtension={() => handleRequestExtension(assignment.assignmentId)}
                      onSetReminder={() => handleSetReminder(assignment.assignmentId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Table View ── */}
        {viewMode === 'table' && filteredAssignments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectableIds().length > 0 && selectableIds().every((id) => selectedIds.has(id))}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignment</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client / Course</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Training Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.map((assignment) => {
                    const isClaimed = claimedAssignmentIds.has(assignment.assignmentId);
                    const displayStatus = deriveDisplayStatus(assignment.status, assignment.claimDeadline, isClaimed);
                    const isSelectable = displayStatus === 'Eligible' && !isClaimed;
                    const isSelected = selectedIds.has(assignment.assignmentId);

                    return (
                      <tr
                        key={assignment.assignmentId}
                        className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          {isSelectable ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(assignment.assignmentId)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                            />
                          ) : (
                            <span className="w-4 h-4 block" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 text-xs">{assignment.assignmentId}</p>
                          {assignment.batchId && (
                            <p className="text-gray-400 text-xs">Batch: {assignment.batchId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{assignment.clientName}</p>
                          <p className="text-gray-500 text-xs">{assignment.courseName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{assignment.city}</p>
                          <p className="text-gray-400 text-xs">{assignment.country} · {assignment.cityTier}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-gray-700 text-xs">{formatDate(assignment.startDate)}</p>
                          <p className="text-gray-400 text-xs">→ {formatDate(assignment.endDate)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <DeadlinePill deadline={assignment.claimDeadline} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={displayStatus} />
                            {isClaimed && <AlreadyClaimedBadge />}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <ActionButton
                            displayStatus={displayStatus}
                            isClaimed={isClaimed}
                            onCreateClaim={() => handleCreateClaim(assignment.assignmentId)}
                            onViewClaim={() => handleViewClaim(assignment.assignmentId)}
                            onRequestExtension={() => handleRequestExtension(assignment.assignmentId)}
                            onSetReminder={() => handleSetReminder(assignment.assignmentId)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

