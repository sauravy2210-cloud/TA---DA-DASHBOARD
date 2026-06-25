import type { ClaimHeader, PaymentRecord } from '../types';
import { formatINR, formatDate } from './calculationEngine';

// ── Core CSV export ────────────────────────────────────────────────────────

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
): void {
  const escape = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines: string[] = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ];

  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Claims Queue export ────────────────────────────────────────────────────

export function exportClaimsQueue(claims: ClaimHeader[]): void {
  const headers = [
    'Bill No',
    'Trainer Name',
    'Trainer ID',
    'Batch ID',
    'Assignment ID',
    'Client',
    'Course',
    'Training Location',
    'Claim Period',
    'Claimed Amount',
    'Eligible Amount',
    'Approved Amount',
    'Deduction',
    'Recoverable',
    'Net Payable',
    'Status',
    'Pending With',
    'Submitted Date',
    'Aging Days',
    'SLA Breached',
    'Exception',
    'Missing Docs',
    'Duplicate',
    'Ledger Status',
    'Admin Owner',
  ];

  const rows = claims.map(c => [
    c.billNo,
    c.trainerName,
    c.trainerId,
    c.batchIds.join('; '),
    c.assignmentIds.join('; '),
    c.clientName,
    c.courseName,
    c.trainingLocation,
    c.submittedAt ? formatDate(c.submittedAt) : '',
    formatINR(c.totalClaimedAmount),
    formatINR(c.eligibleAmount),
    formatINR(c.approvedAmount),
    formatINR(c.deductionAmount),
    formatINR(c.recoverableAmount),
    formatINR(c.netPayable),
    c.status,
    c.pendingWith,
    c.submittedAt ? formatDate(c.submittedAt) : '',
    c.agingDays,
    c.slaBreached ? 'Yes' : 'No',
    c.exceptionFlag ? 'Yes' : 'No',
    c.missingDocumentFlag ? 'Yes' : 'No',
    c.duplicateFlag ? 'Yes' : 'No',
    c.ledgerMismatchFlag ? 'Mismatch' : 'OK',
    c.adminOwnerId ?? '',
  ]);

  const timestamp = new Date().toISOString().slice(0, 10);
  exportToCSV(`Claims_Queue_${timestamp}`, headers, rows);
}

// ── Payment Sheet export ───────────────────────────────────────────────────

export function exportPaymentSheet(
  claims: ClaimHeader[],
  payments: PaymentRecord[]
): void {
  const headers = [
    'Bill No',
    'Trainer ID',
    'Trainer Name',
    'Claim Period',
    'Batch ID',
    'Client',
    'Approved Amount',
    'Advance Adjusted',
    'Misc Adjustments',
    'Recoverable Amount',
    'Net Payable',
    'Currency',
    'Payment Status',
    'Payment Date',
    'Payment Reference/UTR',
    'Finance Remarks',
  ];

  const claimMap = new Map<string, ClaimHeader>(claims.map(c => [c.claimId, c]));

  const rows = payments.map(p => {
    const claim = claimMap.get(p.claimId);
    return [
      claim?.billNo ?? '',
      claim?.trainerId ?? '',
      claim?.trainerName ?? '',
      claim?.submittedAt ? formatDate(claim.submittedAt) : '',
      claim?.batchIds.join('; ') ?? '',
      claim?.clientName ?? '',
      claim ? formatINR(claim.approvedAmount) : '',
      claim ? formatINR(claim.advanceAdjusted) : '',
      claim ? formatINR(claim.miscAdjustments) : '',
      claim ? formatINR(claim.recoverableAmount) : '',
      claim ? formatINR(claim.netPayable) : '',
      claim?.currency ?? 'INR',
      claim?.paymentStatus ?? '',
      p.paymentDate ? formatDate(p.paymentDate) : '',
      p.referenceUTR ?? '',
      p.financeRemarks ?? '',
    ];
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  exportToCSV(`Payment_Sheet_${timestamp}`, headers, rows);
}

// ── Generic report export ──────────────────────────────────────────────────

export function exportReport(reportType: string, data: unknown[]): void {
  if (data.length === 0) {
    exportToCSV(`Report_${reportType}`, [], []);
    return;
  }

  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null) {
    const headers = ['Value'];
    const rows = (data as (string | number)[]).map(v => [v]);
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCSV(`Report_${reportType}_${timestamp}`, headers, rows);
    return;
  }

  const headers = Object.keys(firstRow as Record<string, unknown>);
  const rows = (data as Record<string, unknown>[]).map(record =>
    headers.map(key => {
      const val = record[key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val as string | number;
    })
  );

  const timestamp = new Date().toISOString().slice(0, 10);
  exportToCSV(`Report_${reportType}_${timestamp}`, headers, rows);
}


