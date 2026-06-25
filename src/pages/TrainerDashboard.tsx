import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  BadgeCheck,
  XCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  CalendarDays,
  MapPin,
  Building2,
  BookOpen,
  ArrowRight,
  Bell,
  CreditCard,
} from 'lucide-react';

import KpiCard from '../components/KpiCard';
import { ClaimTable } from '../components/ClaimTable';
import EmptyState from '../components/EmptyState';
import { mockClaims } from '../data/mockClaims';
import { mockAssignments } from '../data/mockAssignments';
import { mockVenues } from '../data/mockMasters';
import type { User, ClaimStatus, PendingWith, PaymentStatus } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  const abs = Math.abs(Math.round(amount)).toString();
  if (abs.length <= 3) return `${amount < 0 ? '-' : ''}₹${abs}`;
  const last3 = abs.slice(-3);
  const rest = abs.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}₹${rest},${last3}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function daysUntilDeadline(deadline: string): number {
  const diff = new Date(deadline).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Map mockClaims status strings to ClaimHeader status type
// mockClaims uses uppercase strings like 'SUBMITTED', 'DRAFT', etc.
// ClaimTable expects proper ClaimStatus type — we need to normalise
type NormalisedStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Clarification Required'
  | 'Approved'
  | 'Partially Approved'
  | 'Rejected'
  | 'Payment Pending'
  | 'Paid';

function normaliseStatus(raw: string): NormalisedStatus {
  const map: Record<string, NormalisedStatus> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    'UNDER REVIEW': 'Under Review',
    'CLARIFICATION REQUIRED': 'Clarification Required',
    APPROVED: 'Approved',
    'PARTIALLY APPROVED': 'Partially Approved',
    REJECTED: 'Rejected',
    'PAYMENT PENDING': 'Payment Pending',
    PAID: 'Paid',
  };
  return map[raw.toUpperCase()] ?? ('Draft' as NormalisedStatus);
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface TrainerDashboardProps {
  currentUser?: User;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TrainerDashboard({ currentUser }: TrainerDashboardProps) {
  const navigate = useNavigate();

  // Resolve demo trainer name: for SuperAdmin show first trainer's data as demo
  const trainerName = useMemo(() => {
    if (!currentUser) return 'Rahul Verma';
    if (currentUser.role === 'SuperAdmin') return 'Rahul Verma';
    return currentUser.name;
  }, [currentUser]);

  // Filter claims for this trainer (by trainerName in mock data)
  const myClaims = useMemo(
    () => mockClaims.filter((c) => c.trainerName === trainerName),
    [trainerName]
  );

  // Filter eligible assignments for this trainer
  const myAssignments = useMemo(
    () =>
      mockAssignments.filter(
        (a) =>
          a.trainerIds.includes(currentUser?.trainerId ?? trainerName) &&
          a.status === 'Completed'
      ),
    [trainerName]
  );

  // KPI counts
  const kpi = useMemo(() => {
    const pending = myClaims.filter((c) =>
      ['Submitted', 'Under Review'].includes(normaliseStatus(c.status))
    ).length;
    const draft = myClaims.filter((c) => normaliseStatus(c.status) === 'Draft').length;
    const submitted = myClaims.filter((c) => normaliseStatus(c.status) === 'Submitted').length;
    const clarification = myClaims.filter(
      (c) => normaliseStatus(c.status) === 'Clarification Required'
    ).length;
    const approved = myClaims.filter((c) =>
      ['Approved', 'Partially Approved'].includes(normaliseStatus(c.status))
    ).length;
    const paymentPendingAmt = myClaims
      .filter((c) => normaliseStatus(c.status) === 'Payment Pending')
      .reduce((s, c) => s + (c.netPayable ?? c.approvedAmount ?? 0), 0);
    const paid = myClaims.filter((c) => normaliseStatus(c.status) === 'Paid').length;
    const rejected = myClaims.filter((c) => normaliseStatus(c.status) === 'Rejected').length;
    const totalClaimed = myClaims.reduce((s, c) => s + (c.totalClaimedAmount ?? 0), 0);
    const totalApproved = myClaims.reduce(
      (s, c) => s + (c.approvedAmount ?? 0),
      0
    );
    const totalDeducted = myClaims.reduce(
      (s, c) => s + (c.deductionAmount ?? 0),
      0
    );
    return {
      pending,
      draft,
      submitted,
      clarification,
      approved,
      paymentPendingAmt,
      paid,
      rejected,
      totalClaimed,
      totalApproved,
      totalDeducted,
    };
  }, [myClaims]);

  // Last 5 claims for the table
  const recentClaims = useMemo(
    () => [...myClaims].slice(0, 5),
    [myClaims]
  );

  // Clarification required claims
  const clarificationClaims = useMemo(
    () => myClaims.filter((c) => normaliseStatus(c.status) === 'Clarification Required'),
    [myClaims]
  );

  // Payment Pending claims
  const paymentPendingClaims = useMemo(
    () =>
      myClaims.filter((c) =>
        ['Payment Pending', 'Approved', 'Partially Approved'].includes(normaliseStatus(c.status))
      ),
    [myClaims]
  );

  // Adapt mockClaims shape to what ClaimTable expects (ClaimHeader)
  const adaptedClaims = useMemo(
    () =>
      recentClaims.map((c) => ({
        claimId: c.claimId,
        billNo: c.billNo,
        trainerId: '',
        trainerName: c.trainerName,
        assignmentIds: c.assignmentIds ?? [],
        batchIds: [] as string[],
        clientName: c.clientName,
        courseName: c.clientName, // mock doesn't have courseName on claim
        trainingLocation: c.trainingLocation ?? c.baseCity ?? '',
        claimStartDate: c.submittedAt ?? c.lastActionAt,
        claimEndDate: c.lastActionAt,
        baseCity: '',
        destinationCities: [c.baseCity ?? ''],
        status: normaliseStatus(c.status) as ClaimStatus,
        pendingWith: (c.pendingWith === 'Trainer'
          ? 'Trainer'
          : c.pendingWith === 'Finance'
          ? 'Finance'
          : c.pendingWith === 'HR/Admin'
          ? 'HR/Admin'
          : 'None') as PendingWith,
        submittedAt: c.submittedAt ?? '',
        lastActionAt: c.lastActionAt,
        adminOwnerId: '',
        totalClaimedAmount: c.totalClaimedAmount ?? 0,
        eligibleAmount: c.approvedAmount ?? c.totalClaimedAmount ?? 0,
        approvedAmount: c.approvedAmount ?? 0,
        deductionAmount: c.deductionAmount ?? 0,
        advanceAdjusted: 0,
        miscAdjustments: 0,
        recoverableAmount: c.recoverableAmount ?? 0,
        netPayable: c.netPayable ?? 0,
        currency: c.currency ?? 'INR',
        exceptionFlag: c.exceptionFlag ?? false,
        missingDocumentFlag: c.missingDocumentFlag ?? false,
        duplicateFlag: false,
        ledgerMismatchFlag: c.ledgerMismatchFlag ?? false,
        slaBreached: c.slaBreached ?? false,
        paymentStatus: 'Unpaid' as PaymentStatus,
        agingDays: c.agingDays ?? 0,
      })),
    [recentClaims]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 px-6 py-10 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Left: greeting */}
            <div>
              <p className="text-blue-100 text-sm font-medium tracking-wide mb-1 uppercase">
                Koenig Solutions — TA/DA Portal
              </p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Welcome back, {trainerName}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-blue-100 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Trainer
                </span>
                <span className="text-blue-300">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  {todayFormatted()}
                </span>
              </div>
              <p className="mt-3 text-blue-100 text-sm max-w-xl leading-relaxed">
                Track your TA/DA claims, eligible assignments, payments, and pending actions all in one place.
              </p>
            </div>

            {/* Right: CTA buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate('/claims/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-blue-700 font-semibold text-sm shadow hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create TA/DA Bill
              </button>
              <button
                type="button"
                onClick={() => navigate('/claims')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 border-white text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View My Bills
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-10">

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <KpiCard
              title="Pending TA/DA Bills"
              value={kpi.pending}
              subtitle="Submitted or Under Review"
              icon={Clock}
              accentColor="yellow"
              onClick={() => navigate('/claims?status=pending')}
            />

            <KpiCard
              title="Draft Bills"
              value={kpi.draft}
              subtitle="Incomplete — action needed"
              icon={FileText}
              accentColor="blue"
              onClick={() => navigate('/claims?status=draft')}
            />

            <KpiCard
              title="Submitted Bills"
              value={kpi.submitted}
              subtitle="Awaiting HR/Admin review"
              icon={Send}
              accentColor="blue"
              onClick={() => navigate('/claims?status=submitted')}
            />

            <KpiCard
              title="Clarification Required"
              value={kpi.clarification}
              subtitle="Respond to reviewer queries"
              icon={AlertTriangle}
              accentColor="red"
              onClick={() => navigate('/claims?status=clarification')}
            />

            <KpiCard
              title="Approved Bills"
              value={kpi.approved}
              subtitle="Approved by HR/Finance"
              icon={CheckCircle2}
              accentColor="green"
              onClick={() => navigate('/claims?status=approved')}
            />

            <KpiCard
              title="Payment Pending Amount"
              value={kpi.paymentPendingAmt}
              subtitle="Approved, awaiting disbursement"
              icon={Wallet}
              accentColor="yellow"
              isAmount
              onClick={() => navigate('/claims?status=payment_pending')}
            />

            <KpiCard
              title="Paid Bills"
              value={kpi.paid}
              subtitle="Fully disbursed"
              icon={BadgeCheck}
              accentColor="green"
              onClick={() => navigate('/claims?status=paid')}
            />

            <KpiCard
              title="Rejected Bills"
              value={kpi.rejected}
              subtitle="Rejected — see reason"
              icon={XCircle}
              accentColor="red"
              onClick={() => navigate('/claims?status=rejected')}
            />

            <KpiCard
              title="Total Claimed"
              value={kpi.totalClaimed}
              subtitle="Cumulative claimed amount"
              icon={TrendingUp}
              accentColor="indigo"
              isAmount
            />

            <KpiCard
              title="Total Approved"
              value={kpi.totalApproved}
              subtitle="Cumulative approved amount"
              icon={TrendingUp}
              accentColor="teal"
              isAmount
            />

            <KpiCard
              title="Total Deducted"
              value={kpi.totalDeducted}
              subtitle="Policy deductions applied"
              icon={TrendingDown}
              accentColor="red"
              isAmount
            />

            <KpiCard
              title="Quick Create"
              value="New Bill"
              subtitle="Start a TA/DA claim now"
              icon={Plus}
              accentColor="blue"
              onClick={() => navigate('/claims/new')}
            />
          </div>
        </section>

        {/* ── Clarification Required Panel ─────────────────────────────────── */}
        {clarificationClaims.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-semibold text-gray-700">
                Action Required — Clarification
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                {clarificationClaims.length}
              </span>
            </div>
            <div className="space-y-3">
              {clarificationClaims.map((claim) => (
                <div
                  key={claim.claimId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-800 text-sm">
                        {claim.billNo}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                        Clarification Required
                      </span>
                      {claim.agingDays > 0 && (
                        <span className="text-xs text-gray-400">
                          {claim.agingDays}d pending
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{claim.clientName}</span>
                      {claim.baseCity && (
                        <span className="text-gray-400"> · {claim.baseCity}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Claimed: <span className="font-medium text-gray-700">{formatINR(claim.totalClaimedAmount ?? 0)}</span>
                      {claim.submittedAt && (
                        <span> · Submitted {formatDate(claim.submittedAt)}</span>
                      )}
                    </p>
                    {claim.adminRemark && (
                      <p className="mt-2 text-xs text-orange-800 bg-orange-100 rounded px-3 py-1.5 italic border border-orange-200">
                        Reviewer note: {claim.adminRemark}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/claims/${claim.claimId}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors flex-shrink-0"
                  >
                    Respond
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Eligible Assignments ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-700">
              Eligible Assignments
            </h2>
            {myAssignments.length > 0 && (
              <span className="text-xs text-gray-400">
                {myAssignments.length} assignment{myAssignments.length !== 1 ? 's' : ''} eligible for claim
              </span>
            )}
          </div>

          {myAssignments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No eligible assignments"
              subtitle="You have no completed assignments pending a TA/DA claim right now."
              action={{ label: 'View All Bills', onClick: () => navigate('/claims') }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {myAssignments.map((asgn) => {
                const daysLeft = asgn.claimDeadline
                  ? daysUntilDeadline(asgn.claimDeadline)
                  : null;
                const deadlineUrgent = daysLeft !== null && daysLeft <= 7;

                return (
                  <div
                    key={asgn.assignmentId}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 leading-snug">
                          {asgn.courseName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{asgn.batchId ?? asgn.assignmentId}</p>
                      </div>
                      {asgn.country !== 'India' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex-shrink-0">
                          International
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{asgn.clientName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{mockVenues.find(v => v.venueId === asgn.venueId)?.venueName ?? asgn.city}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>
                          {formatDate(asgn.startDate)} – {formatDate(asgn.endDate)}
                        </span>
                      </div>
                    </div>

                    {/* Deadline */}
                    {asgn.claimDeadline && (
                      <div
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                          deadlineUrgent
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Deadline: {formatDate(asgn.claimDeadline)}
                        {daysLeft !== null && (
                          <span className={deadlineUrgent ? 'text-red-500 font-bold' : 'text-gray-400'}>
                            ({daysLeft}d left)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/claims/new?assignmentId=${asgn.assignmentId}`)
                      }
                      className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Bill
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Recent Bills Table ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-700">My Recent Bills</h2>
            <button
              type="button"
              onClick={() => navigate('/claims')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentClaims.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No bills yet"
              subtitle="You haven't created any TA/DA bills. Start by creating your first bill."
              action={{ label: 'Create TA/DA Bill', onClick: () => navigate('/claims/new') }}
            />
          ) : (
            <ClaimTable
              claims={adaptedClaims}
              onClaimClick={(id) => navigate(`/claims/${id}`)}
              userRole="Trainer"
            />
          )}
        </section>

        {/* ── Payment Status Panel ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-700">Payment Status</h2>
          </div>

          {paymentPendingClaims.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No pending payments"
              subtitle="All your approved claims have been disbursed."
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Bill No', 'Client', 'Location', 'Approved Amount', 'Net Payable', 'Status', 'Action'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paymentPendingClaims.map((claim) => {
                    const normStatus = normaliseStatus(claim.status);
                    const isPaid = normStatus === 'Paid';
                    const isPaymentPending = normStatus === 'Payment Pending';
                    return (
                      <tr
                        key={claim.claimId}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/claims/${claim.claimId}`)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-blue-600 font-medium text-xs hover:underline">
                            {claim.billNo}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 max-w-[140px] truncate">
                          {claim.clientName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {claim.baseCity ?? claim.trainingLocation ?? '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-green-700">
                          {formatINR(claim.approvedAmount ?? 0)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900">
                          {claim.netPayable != null
                            ? formatINR(claim.netPayable)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-700'
                                : isPaymentPending
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isPaid ? (
                              <><CheckCircle2 className="w-3 h-3" /> Paid</>
                            ) : isPaymentPending ? (
                              <><Clock className="w-3 h-3" /> Payment Pending</>
                            ) : (
                              <><CheckCircle2 className="w-3 h-3" /> Approved</>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/claims/${claim.claimId}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}


