// TA/DA Dashboard — Mock Report Summary Data
// All figures derived from mockClaims values for consistency.

import type { ReasonCode } from '../types';

// ── Monthly TA/DA Summary (Jan–Jun 2026) ──────────────────────────────────

export interface MonthlySummary {
  month: string;
  totalClaims: number;
  totalClaimed: number;
  totalApproved: number;
  totalDeducted: number;
  totalPaid: number;
}

export const monthlyTADASummary: MonthlySummary[] = [
  { month: 'Jan 2026', totalClaims: 18, totalClaimed: 312400, totalApproved: 298200, totalDeducted: 14200, totalPaid: 298200 },
  { month: 'Feb 2026', totalClaims: 22, totalClaimed: 408600, totalApproved: 389100, totalDeducted: 19500, totalPaid: 389100 },
  { month: 'Mar 2026', totalClaims: 31, totalClaimed: 574800, totalApproved: 541300, totalDeducted: 33500, totalPaid: 541300 },
  { month: 'Apr 2026', totalClaims: 27, totalClaimed: 496200, totalApproved: 468700, totalDeducted: 27500, totalPaid: 468700 },
  { month: 'May 2026', totalClaims: 24, totalClaimed: 452300, totalApproved: 425600, totalDeducted: 26700, totalPaid: 395200 },
  { month: 'Jun 2026', totalClaims: 13, totalClaimed: 430500, totalApproved: 114900, totalDeducted: 33100, totalPaid: 29400 },
];

// ── Trainer-Wise Report (5 trainers) ──────────────────────────────────────

export interface TrainerWiseReport {
  trainerId: string;
  trainerName: string;
  claimsCount: number;
  totalClaimed: number;
  totalApproved: number;
  avgApprovalRate: number;
  totalDeducted: number;
}

export const trainerWiseReport: TrainerWiseReport[] = [
  // Imran Khan: clm-0051 (28400, pending), clm-0045 (19800, pending)
  {
    trainerId: 'TRN-001',
    trainerName: 'Imran Khan',
    claimsCount: 2,
    totalClaimed: 48200,
    totalApproved: 0,
    avgApprovalRate: 0,
    totalDeducted: 0,
  },
  // Rahul Verma: clm-0042 (42800, pending), clm-0044 (96400, pending), clm-0038 (33600, pending)
  {
    trainerId: 'TRN-002',
    trainerName: 'Rahul Verma',
    claimsCount: 3,
    totalClaimed: 172800,
    totalApproved: 0,
    avgApprovalRate: 0,
    totalDeducted: 0,
  },
  // Anita Rao: clm-0039 (31200, pending), clm-0049 (30200 claimed → 29400 approved, 800 deducted, PAID)
  {
    trainerId: 'TRN-003',
    trainerName: 'Anita Rao',
    claimsCount: 2,
    totalClaimed: 61400,
    totalApproved: 29400,
    avgApprovalRate: 47.9,
    totalDeducted: 800,
  },
  // Priya Nair: clm-0033 (18600 → 17200 approved, 1400 deducted), clm-0047 (0, draft), clm-0046 (27800, pending)
  {
    trainerId: 'TRN-004',
    trainerName: 'Priya Nair',
    claimsCount: 3,
    totalClaimed: 46400,
    totalApproved: 17200,
    avgApprovalRate: 37.1,
    totalDeducted: 1400,
  },
  // Vikram Joshi: clm-0028 (37800 → 36500 approved, 1300 deducted), clm-0035 (22500 → rejected, 22500 deducted), clm-0050 (41200 → 31800 approved, 9400 deducted)
  {
    trainerId: 'TRN-005',
    trainerName: 'Vikram Joshi',
    claimsCount: 3,
    totalClaimed: 101500,
    totalApproved: 68300,
    avgApprovalRate: 67.3,
    totalDeducted: 33200,
  },
];

// ── Batch-Wise Report ──────────────────────────────────────────────────────

export interface BatchWiseReport {
  batchId: string;
  clientName: string;
  totalClaims: number;
  totalClaimed: number;
  totalApproved: number;
}

export const batchWiseReport: BatchWiseReport[] = [
  { batchId: 'BATCH-HYD-2026-112', clientName: 'TechMah Solutions', totalClaims: 1, totalClaimed: 28400, totalApproved: 0 },
  { batchId: 'BATCH-GGN-2026-087', clientName: 'CyberCorp Technologies', totalClaims: 1, totalClaimed: 42800, totalApproved: 0 },
  { batchId: 'BATCH-PNE-2026-055', clientName: 'Globant India', totalClaims: 2, totalClaimed: 61400, totalApproved: 29400 },
  { batchId: 'BATCH-BLR-2026-041', clientName: 'Infosys Limited', totalClaims: 1, totalClaimed: 18600, totalApproved: 17200 },
  { batchId: 'BATCH-MUM-2026-033', clientName: 'Accenture Solutions', totalClaims: 1, totalClaimed: 37800, totalApproved: 36500 },
  { batchId: 'BATCH-DXB-2026-009', clientName: 'Emirates NBD Bank', totalClaims: 1, totalClaimed: 96400, totalApproved: 0 },
  { batchId: 'BATCH-MUM-2026-048', clientName: 'KPMG India', totalClaims: 1, totalClaimed: 0, totalApproved: 0 },
  { batchId: 'BATCH-CHN-2026-022', clientName: 'Tata Consultancy Services', totalClaims: 1, totalClaimed: 22500, totalApproved: 0 },
  { batchId: 'BATCH-HYD-2026-098', clientName: 'Wipro Technologies', totalClaims: 1, totalClaimed: 33600, totalApproved: 0 },
  { batchId: 'BATCH-NOI-2026-061', clientName: 'HCL Technologies', totalClaims: 1, totalClaimed: 19800, totalApproved: 0 },
  { batchId: 'BATCH-HYD-2026-105', clientName: 'Deloitte India', totalClaims: 1, totalClaimed: 27800, totalApproved: 0 },
  { batchId: 'BATCH-PNE-2026-067', clientName: 'Tech Mahindra', totalClaims: 1, totalClaimed: 41200, totalApproved: 31800 },
];

// ── Client-Wise Report ─────────────────────────────────────────────────────

export interface ClientWiseReport {
  clientName: string;
  totalClaims: number;
  totalClaimed: number;
  totalApproved: number;
  cost: number;
}

export const clientWiseReport: ClientWiseReport[] = [
  { clientName: 'TechMah Solutions', totalClaims: 1, totalClaimed: 28400, totalApproved: 0, cost: 0 },
  { clientName: 'CyberCorp Technologies', totalClaims: 1, totalClaimed: 42800, totalApproved: 0, cost: 0 },
  { clientName: 'Globant India', totalClaims: 2, totalClaimed: 61400, totalApproved: 29400, cost: 29400 },
  { clientName: 'Infosys Limited', totalClaims: 1, totalClaimed: 18600, totalApproved: 17200, cost: 17200 },
  { clientName: 'Accenture Solutions', totalClaims: 1, totalClaimed: 37800, totalApproved: 36500, cost: 34000 },
  { clientName: 'Emirates NBD Bank', totalClaims: 1, totalClaimed: 96400, totalApproved: 0, cost: 0 },
  { clientName: 'KPMG India', totalClaims: 1, totalClaimed: 0, totalApproved: 0, cost: 0 },
  { clientName: 'Tata Consultancy Services', totalClaims: 1, totalClaimed: 22500, totalApproved: 0, cost: 0 },
  { clientName: 'Wipro Technologies', totalClaims: 1, totalClaimed: 33600, totalApproved: 0, cost: 0 },
  { clientName: 'HCL Technologies', totalClaims: 1, totalClaimed: 19800, totalApproved: 0, cost: 0 },
  { clientName: 'Deloitte India', totalClaims: 1, totalClaimed: 27800, totalApproved: 0, cost: 0 },
  { clientName: 'Tech Mahindra', totalClaims: 1, totalClaimed: 41200, totalApproved: 31800, cost: 31800 },
];

// ── Aging Report ───────────────────────────────────────────────────────────

export type AgingBucket = '<1d' | '1-2d' | '2-3d' | '3-5d' | '>5d';

export interface AgingReport {
  bucket: AgingBucket;
  count: number;
  totalAmount: number;
}

// Aging based on agingDays from mockClaims (only active/unresolved claims counted):
// clm-0044: 2d → '2-3d' (96400)
// clm-0051: 3d → '3-5d' (28400)
// clm-0046: 3d → '3-5d' (27800)
// clm-0045: 4d → '3-5d' (19800)
// clm-0042: 5d → '3-5d' (42800)
// clm-0039: 8d → '>5d' (31200)
// clm-0038: 12d → '>5d' (33600)
export const agingReport: AgingReport[] = [
  { bucket: '<1d', count: 0, totalAmount: 0 },
  { bucket: '1-2d', count: 0, totalAmount: 0 },
  { bucket: '2-3d', count: 1, totalAmount: 96400 },
  { bucket: '3-5d', count: 4, totalAmount: 118800 },
  { bucket: '>5d', count: 2, totalAmount: 64800 },
];

// ── Exception Report ───────────────────────────────────────────────────────

export interface ExceptionReportItem {
  claimId: string;
  billNo: string;
  trainerName: string;
  reason: string;
  amount: number;
  status: string;
}

// Exceptions from mockClaims (exceptionFlag: true)
export const exceptionReport: ExceptionReportItem[] = [
  {
    claimId: 'clm-0042',
    billNo: 'TA-2026-0042',
    trainerName: 'Rahul Verma',
    reason: 'Client dinner (pre-approved BD event) — exception item ₹6,200 included in claim.',
    amount: 6200,
    status: 'UNDER REVIEW',
  },
  {
    claimId: 'clm-0044',
    billNo: 'TA-2026-0044',
    trainerName: 'Rahul Verma',
    reason: 'International high-value claim — accommodation upgrade exception pending senior review.',
    amount: 96400,
    status: 'UNDER REVIEW',
  },
  {
    claimId: 'clm-0046',
    billNo: 'TA-2026-0046',
    trainerName: 'Priya Nair',
    reason: 'Extra 2-night personal stay-back included. ₹5,400 flagged as recoverable pending exception approval.',
    amount: 5400,
    status: 'UNDER REVIEW',
  },
];

// ── Deduction Report (by reason code) ─────────────────────────────────────

export interface DeductionReportItem {
  reasonCode: ReasonCode;
  count: number;
  totalDeduction: number;
}

// Derived from line items with deductionReason set and from rejected/partial claims:
// RC020_HOTEL_RATE_EXCEEDED: clm-0033 (1400), clm-0049 (800)           → 2 items, 2200
// RC002_NO_RECEIPT:          clm-0028 cab (1300), clm-0050 cabs (3200) → 2 items, 4500
// RC023_POLICY_NOT_APPLICABLE: clm-0035 full rejection (22500)         → 1 item, 22500
// RC001_OVER_POLICY_LIMIT:   clm-0050 business class (6200)            → 1 item, 6200
// RC005_PERSONAL_STAYBACK:   clm-0046 (5400 recoverable)               → 1 item, 5400
// RC022_LEDGER_MISMATCH:     clm-0045 discrepancy (1600 disputed)      → 1 item, 1600
export const deductionReport: DeductionReportItem[] = [
  { reasonCode: 'RC023_POLICY_NOT_APPLICABLE', count: 1, totalDeduction: 22500 },
  { reasonCode: 'RC001_OVER_POLICY_LIMIT', count: 1, totalDeduction: 6200 },
  { reasonCode: 'RC005_PERSONAL_STAYBACK', count: 1, totalDeduction: 5400 },
  { reasonCode: 'RC002_NO_RECEIPT', count: 2, totalDeduction: 4500 },
  { reasonCode: 'RC020_HOTEL_RATE_EXCEEDED', count: 2, totalDeduction: 2200 },
  { reasonCode: 'RC022_LEDGER_MISMATCH', count: 1, totalDeduction: 1600 },
];
