import { useState, useMemo } from 'react';
import type { User } from '../types';
import { mockClaims, mockPayments } from '../data/mockClaims';
import { exportReport } from '../services/exportEngine';

interface ReportsProps {
  currentUser?: User;
}

interface ReportDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const REPORT_DEFS: ReportDef[] = [
  {
    id: 'monthly_summary',
    name: 'Monthly TA/DA Summary',
    description: 'Consolidated TA/DA spend by month with totals, deductions, and payment status.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-indigo-600 bg-indigo-50',
    category: 'Summary',
  },
  {
    id: 'trainer_wise',
    name: 'Trainer-wise Claim Report',
    description: 'Per-trainer breakdown of submitted, approved, rejected, and paid claims.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      </svg>
    ),
    color: 'text-blue-600 bg-blue-50',
    category: 'Summary',
  },
  {
    id: 'batch_wise',
    name: 'Batch-wise TA/DA Report',
    description: 'TA/DA costs aggregated by batch and assignment for each delivery.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: 'text-teal-600 bg-teal-50',
    category: 'Summary',
  },
  {
    id: 'client_wise',
    name: 'Client-wise TA/DA Cost',
    description: 'Total TA/DA expenditure billable or attributed to each client.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: 'text-purple-600 bg-purple-50',
    category: 'Summary',
  },
  {
    id: 'pending_bills',
    name: 'Pending Bills Report',
    description: 'All claims currently awaiting review, clarification, or approval.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-amber-600 bg-amber-50',
    category: 'Status',
  },
  {
    id: 'rejected_bills',
    name: 'Rejected Bills Report',
    description: 'All rejected claims with rejection reasons and responsible admin.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-red-600 bg-red-50',
    category: 'Status',
  },
  {
    id: 'deduction',
    name: 'Deduction Report',
    description: 'Itemised deductions applied to claims — policy breaches, non-eligibles, adjustments.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-orange-600 bg-orange-50',
    category: 'Finance',
  },
  {
    id: 'payment',
    name: 'Payment Report',
    description: 'Complete payment disbursement history with UTR, amounts, and dates.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'text-green-600 bg-green-50',
    category: 'Finance',
  },
  {
    id: 'exception',
    name: 'Exception Report',
    description: 'Claims flagged for exceptions — over-limit, missing docs, unusual patterns.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    color: 'text-yellow-600 bg-yellow-50',
    category: 'Compliance',
  },
  {
    id: 'aging',
    name: 'Aging Report',
    description: 'Claims bucketed by aging days — shows backlog and SLA risk.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'text-indigo-600 bg-indigo-50',
    category: 'Compliance',
  },
  {
    id: 'recoverable',
    name: 'Recoverable Report',
    description: 'Amounts classified as recoverable from trainers (personal expenses, staybacks).',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: 'text-rose-600 bg-rose-50',
    category: 'Finance',
  },
  {
    id: 'country_da',
    name: 'Country-wise DA Report',
    description: 'Daily Allowance spending by country and city tier for international claims.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-cyan-600 bg-cyan-50',
    category: 'Summary',
  },
  {
    id: 'cab_cost',
    name: 'Cab Cost Report',
    description: 'Cab and conveyance expenses claimed, with eligibility and actual approvals.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    color: 'text-slate-600 bg-slate-50',
    category: 'Finance',
  },
  {
    id: 'missing_doc',
    name: 'Missing Document Report',
    description: 'Claims with outstanding missing receipts or supporting documents.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'text-amber-600 bg-amber-50',
    category: 'Compliance',
  },
  {
    id: 'sla_breach',
    name: 'SLA Breach Report',
    description: 'Claims that breached processing SLAs with days overdue and responsible team.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-red-600 bg-red-50',
    category: 'Compliance',
  },
  {
    id: 'admin_productivity',
    name: 'Admin Productivity Report',
    description: 'Claims processed, avg TAT, rejections, and exceptions per admin user.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-violet-600 bg-violet-50',
    category: 'Admin',
  },
  {
    id: 'ledger_mismatch',
    name: 'Ledger Mismatch Report',
    description: 'Claims with discrepancies between claim amounts and GL/ledger entries.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'text-fuchsia-600 bg-fuchsia-50',
    category: 'Finance',
  },
  {
    id: 'leave_day_da',
    name: 'Leave-Day DA Reversal Report',
    description: 'DA entries flagged for leave days that were reversed or adjusted.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    color: 'text-gray-600 bg-gray-50',
    category: 'Compliance',
  },
];

function generateReportData(reportId: string, claims: typeof mockClaims, dateFrom: string, dateTo: string) {
  const filtered = claims.filter((c) => {
    if (dateFrom && c.submittedAt && c.submittedAt < dateFrom) return false;
    if (dateTo && c.submittedAt && c.submittedAt > dateTo + 'T23:59:59') return false;
    return true;
  });

  switch (reportId) {
    case 'monthly_summary': {
      const byMonth: Record<string, { month: string; count: number; claimed: number; approved: number; deducted: number; paid: number }> = {};
      filtered.forEach((c) => {
        const month = c.submittedAt ? c.submittedAt.slice(0, 7) : 'Unknown';
        if (!byMonth[month]) byMonth[month] = { month, count: 0, claimed: 0, approved: 0, deducted: 0, paid: 0 };
        byMonth[month].count++;
        byMonth[month].claimed += c.totalClaimedAmount;
        byMonth[month].approved += c.approvedAmount ?? 0;
        byMonth[month].deducted += c.deductionAmount;
        if (c.status === 'Paid') byMonth[month].paid += c.netPayable ?? 0;
      });
      return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    }
    case 'trainer_wise': {
      const byTrainer: Record<string, { trainer: string; claims: number; claimed: number; approved: number; rejected: number; paid: number }> = {};
      filtered.forEach((c) => {
        if (!byTrainer[c.trainerName]) byTrainer[c.trainerName] = { trainer: c.trainerName, claims: 0, claimed: 0, approved: 0, rejected: 0, paid: 0 };
        byTrainer[c.trainerName].claims++;
        byTrainer[c.trainerName].claimed += c.totalClaimedAmount;
        byTrainer[c.trainerName].approved += c.approvedAmount ?? 0;
        if (c.status === 'Rejected') byTrainer[c.trainerName].rejected++;
        if (c.status === 'Paid') byTrainer[c.trainerName].paid += c.netPayable ?? 0;
      });
      return Object.values(byTrainer);
    }
    case 'client_wise': {
      const byClient: Record<string, { client: string; claims: number; totalClaimed: number; totalApproved: number }> = {};
      filtered.forEach((c) => {
        if (!byClient[c.clientName]) byClient[c.clientName] = { client: c.clientName, claims: 0, totalClaimed: 0, totalApproved: 0 };
        byClient[c.clientName].claims++;
        byClient[c.clientName].totalClaimed += c.totalClaimedAmount;
        byClient[c.clientName].totalApproved += c.approvedAmount ?? 0;
      });
      return Object.values(byClient);
    }
    case 'pending_bills':
      return filtered.filter((c) => ['Submitted', 'Under Review', 'Clarification Required', 'Resubmitted'].includes(c.status)).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, status: c.status, agingDays: c.agingDays, claimedAmount: c.totalClaimedAmount, submittedAt: fmtDate(c.submittedAt),
      }));
    case 'rejected_bills':
      return filtered.filter((c) => c.status === 'Rejected').map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, client: c.clientName, claimedAmount: c.totalClaimedAmount, submittedAt: fmtDate(c.submittedAt), remarks: c.adminRemark ?? '—',
      }));
    case 'deduction':
      return filtered.filter((c) => c.deductionAmount > 0).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, claimedAmount: c.totalClaimedAmount, approvedAmount: c.approvedAmount ?? 0, deductionAmount: c.deductionAmount, recoverable: c.recoverableAmount,
      }));
    case 'payment':
      return mockPayments.map((p) => ({
        billNumber: (p as unknown as Record<string, unknown>).billNo, trainer: (p as unknown as Record<string, unknown>).trainerName, netPaid: (p as unknown as Record<string, unknown>).netPaid, paymentMode: (p as unknown as Record<string, unknown>).paymentMode, utr: (p as unknown as Record<string, unknown>).referenceUTR ?? '—', status: (p as unknown as Record<string, unknown>).paymentStatus, paidAt: fmtDate((p as unknown as Record<string, unknown>).paidAt as string),
      }));
    case 'exception':
      return filtered.filter((c) => c.exceptionFlag).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, client: c.clientName, claimedAmount: c.totalClaimedAmount, status: c.status, agingDays: c.agingDays,
      }));
    case 'aging':
      return filtered.map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, status: c.status, agingDays: c.agingDays, bucket: c.agingDays <= 2 ? '0-2d' : c.agingDays <= 5 ? '3-5d' : c.agingDays <= 10 ? '6-10d' : '10d+', slaBreached: c.slaBreached ? 'Yes' : 'No',
      }));
    case 'recoverable':
      return filtered.filter((c) => c.recoverableAmount > 0).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, recoverableAmount: c.recoverableAmount, status: c.status, client: c.clientName,
      }));
    case 'missing_doc':
      return filtered.filter((c) => c.missingDocumentFlag).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, client: c.clientName, status: c.status, agingDays: c.agingDays, submittedAt: fmtDate(c.submittedAt),
      }));
    case 'sla_breach':
      return filtered.filter((c) => c.slaBreached).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, status: c.status, agingDays: c.agingDays, pendingWith: c.pendingWith,
      }));
    case 'ledger_mismatch':
      return filtered.filter((c) => c.ledgerMismatchFlag).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, claimedAmount: c.totalClaimedAmount, approvedAmount: c.approvedAmount ?? 0, status: c.status,
      }));
    case 'country_da':
      return filtered.filter((c) => (c.destinationCities.some(x => x !== 'India'))).map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, country: (c.destinationCities[0] ?? ""), city: c.baseCity, currency: c.currency, claimedAmount: c.totalClaimedAmount, approvedAmount: c.approvedAmount ?? 0,
      }));
    default:
      return filtered.map((c) => ({
        billNumber: c.billNo, trainer: c.trainerName, client: c.clientName, status: c.status, claimedAmount: c.totalClaimedAmount,
      }));
  }
}

const CATEGORIES = ['All', 'Summary', 'Status', 'Finance', 'Compliance', 'Admin'];

export default function Reports({ currentUser: _currentUser }: ReportsProps) {
  const [dateFrom, setDateFrom] = useState('2026-06-01');
  const [dateTo, setDateTo] = useState('2026-06-30');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  const previewData = useMemo(() => {
    if (!selectedReport) return [];
    return generateReportData(selectedReport, mockClaims, dateFrom, dateTo);
  }, [selectedReport, dateFrom, dateTo]);

  const previewHeaders = useMemo(() => {
    if (previewData.length === 0) return [];
    return Object.keys(previewData[0] as object);
  }, [previewData]);

  const filteredDefs = REPORT_DEFS.filter((r) => categoryFilter === 'All' || r.category === categoryFilter);

  function handleExportCSV(reportId: string) {
    const data = generateReportData(reportId, mockClaims, dateFrom, dateTo);
    exportReport(reportId, data);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reports & Exports</h1>
            <p className="mt-0.5 text-sm text-gray-500">Generate and download TA/DA reports in CSV format</p>
          </div>
        </div>
      </div>

      {/* Date range + category filter */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center ml-4 mt-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Report cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDefs.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report.id === selectedReport ? null : report.id)}
              className={`cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                selectedReport === report.id ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 rounded-xl p-2.5 ${report.color}`}>
                  {report.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">{report.name}</h3>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{report.description}</p>
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {report.category}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleExportCSV(report.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  disabled
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400 cursor-not-allowed"
                  title="PDF export coming soon"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Preview table */}
        {selectedReport && (
          <div className="rounded-xl border border-indigo-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-100 bg-indigo-50 rounded-t-xl">
              <div>
                <h3 className="text-sm font-semibold text-indigo-900">
                  Preview: {REPORT_DEFS.find((r) => r.id === selectedReport)?.name}
                </h3>
                <p className="text-xs text-indigo-600 mt-0.5">
                  {previewData.length} record{previewData.length !== 1 ? 's' : ''} for selected date range
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-indigo-400 hover:text-indigo-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {previewData.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                No data available for the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewHeaders.map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                          {h.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {previewHeaders.map((h) => (
                          <td key={h} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                            {String((row as Record<string, unknown>)[h] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 10 && (
                  <div className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">
                    Showing first 10 of {previewData.length} records. Export CSV for full data.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


