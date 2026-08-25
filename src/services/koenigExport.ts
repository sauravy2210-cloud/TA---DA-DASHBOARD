// Generates the Koenig bank-transfer Excel file in the exact format used by KSPL Kotak.
// Columns (in order): InvoiceId | beneficiaryname | accountno | ifsc | amount | remark | payby
// payby = 2 (NEFT/bank transfer code used by Kotak)

import * as XLSX from 'xlsx';
import type { ClaimHeader } from '../types';

interface BankInfo {
  accountNumber: string;
  ifsc: string;
}

export interface KoenigRow {
  InvoiceId: number;
  beneficiaryname: string;
  accountno: string;
  ifsc: string;
  amount: number;
  remark: string;
  payby: number;
}

function computeNetPayable(claim: ClaimHeader): number {
  // Same bug/fix as PaymentProcessing.tsx's computeNetPayable: once HR has decided a claim,
  // claim.netPayable is the AUTHORITATIVE figure computed at approval time — it already accounts
  // for DA-overlap exclusion and the "Already Paid — Same Assignment ID" deduction, neither of
  // which can be reconstructed from the flat fields below. Recomputing independently here sent
  // Akshay Kumar's actual bank-transfer file the pre-deduction 15,890 instead of the approved 570
  // (TADA-2026-00044, after HR applied a 15,320 already-paid deduction).
  const decidedStatuses = new Set(['Approved', 'Partially Approved', 'Payment Pending', 'Paid']);
  if (decidedStatuses.has(claim.status) && claim.netPayable != null) return claim.netPayable;

  const base =
    claim.approvedAmount && claim.approvedAmount > 0
      ? claim.approvedAmount
      : claim.totalClaimedAmount ?? 0;
  const alreadyPaidDeduction = (claim as unknown as { alreadyPaidDeduction?: number }).alreadyPaidDeduction ?? 0;
  return (
    base -
    (claim.advanceAdjusted ?? 0) -
    (claim.deductionAmount ?? 0) -
    (claim.recoverableAmount ?? 0) -
    alreadyPaidDeduction
  );
}

function buildRows(
  claims: ClaimHeader[],
  bankInfoMap: Record<string, BankInfo>
): KoenigRow[] {
  return claims
    .filter((c) => {
      const net = computeNetPayable(c);
      return net > 0; // only include claims with positive net payable
    })
    .map((c) => {
      const bank = bankInfoMap[c.trainerId] ?? { accountNumber: '', ifsc: '' };
      const net = computeNetPayable(c);
      // remark: "TA Bill - <BillNo> - <TrainerId>"
      const remark = `TA Bill - ${c.billNo} - ${c.trainerId}`;

      return {
        InvoiceId: 0,
        beneficiaryname: c.trainerName,
        accountno: bank.accountNumber,
        ifsc: bank.ifsc,
        amount: net,
        remark,
        payby: 2,
      };
    });
}

function buildWorkbook(rows: KoenigRow[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Header row exactly matching the Kotak template
  const wsData: (string | number)[][] = [
    ['InvoiceId', 'beneficiaryname', 'accountno', 'ifsc', 'amount', 'remark', 'payby'],
    ...rows.map((r) => [
      r.InvoiceId,
      r.beneficiaryname,
      r.accountno,
      r.ifsc,
      r.amount,
      r.remark,
      r.payby,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 12 },  // InvoiceId
    { wch: 28 },  // beneficiaryname
    { wch: 22 },  // accountno
    { wch: 16 },  // ifsc
    { wch: 14 },  // amount
    { wch: 42 },  // remark
    { wch: 8 },   // payby
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

/** Download the Koenig file as an .xlsx directly in the browser. */
export function downloadKoenigFile(
  claims: ClaimHeader[],
  bankInfoMap: Record<string, BankInfo>
): void {
  const rows = buildRows(claims, bankInfoMap);
  if (rows.length === 0) {
    alert('No claims with positive net payable to export.');
    return;
  }
  const wb = buildWorkbook(rows);
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Koenig_TADA_Payment_${today}.xlsx`);
}

/** Return the workbook as a base64 string for emailing via the notify API. */
export function buildKoenigFileBase64(
  claims: ClaimHeader[],
  bankInfoMap: Record<string, BankInfo>
): { base64: string; rows: number } {
  const rows = buildRows(claims, bankInfoMap);
  const wb = buildWorkbook(rows);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) as string;
  return { base64: wbout, rows: rows.length };
}
