import type { ClaimHeader, ClaimLineItem, AdvanceRecord } from '../types';

export interface LedgerResult {
  approvedAmount: number;
  advanceAdjusted: number;
  miscAdjustments: number;
  recoverableAmount: number;
  finalSettlement: number;
  isBalanced: boolean;
  discrepancy: number;
  blockers: string[];
}

export function reconcileLedger(
  claim: ClaimHeader,
  lineItems: ClaimLineItem[],
  advanceRecords: AdvanceRecord[]
): LedgerResult {
  const blockers: string[] = [];

  // Approved amount: sum of approved line items, falling back to claim-level approvedAmount
  const approvedAmount =
    lineItems.length > 0
      ? lineItems.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0)
      : (claim.approvedAmount ?? 0);

  // Advance adjusted: sum of adjustedAmount across all advance records for this claim
  const advanceAdjusted = advanceRecords.reduce(
    (sum, rec) => sum + (rec.adjustedAmount ?? 0),
    0
  );

  // Misc adjustments: deduction amount stored on the claim header (signed — positive means deduction applied)
  const miscAdjustments = -(claim.deductionAmount ?? 0);

  // Recoverable amount from claim header
  const recoverableAmount = claim.recoverableAmount ?? 0;

  // finalSettlement = approvedAmount - advanceAdjusted + miscAdjustments - recoverableAmount
  const finalSettlement =
    approvedAmount - advanceAdjusted + miscAdjustments - recoverableAmount;

  // ── Blocker: advance unmapped without explanation ──────────────────────────
  for (const rec of advanceRecords) {
    if (!rec.adjustedInClaimId && (!rec.purpose || rec.purpose.trim() === '')) {
      blockers.push(
        `Advance ${rec.advanceId} (${rec.amount} INR) is unmapped and has no explanation.`
      );
    }
  }

  // ── Blocker: misc adjustment (deduction on a line item) has no reason ──────
  for (const item of lineItems) {
    const hasDeduction =
      item.approvedAmount !== null &&
      item.approvedAmount < item.claimedAmount;
    if (hasDeduction && (!(item.internalRemark ?? '') || (item.internalRemark ?? '').trim() === '')) {
      blockers.push(
        `Line item ${item.lineItemId} (${item.description}) has a deduction but no deduction reason.`
      );
    }
  }

  // ── Blocker: recovery missing for company-paid personal stayback ──────────
  // A personal stayback expense is flagged when a line item is an exception
  // and its description mentions stayback/personal, or its category is 'Lodging'
  // with an exception flag. The claim must carry a non-zero recoverableAmount.
  const hasPersonalStaybackLineItem = lineItems.some(
    (item) =>
      item.exceptionRequired &&
      (item.expenseType === 'Lodging' ||
        /stayback|personal stay/i.test(item.description))
  );
  if (hasPersonalStaybackLineItem && recoverableAmount === 0) {
    blockers.push(
      'Claim contains a company-paid personal stayback but no recovery amount is recorded.'
    );
  }

  // ── Blocker: finalSettlement does not match claim.netPayable (tolerance ₹1) ─
  const netPayable = claim.netPayable ?? 0;
  const discrepancy = Math.abs(finalSettlement - netPayable);
  const isBalanced = discrepancy <= 1;

  if (!isBalanced) {
    blockers.push(
      `Final settlement ₹${finalSettlement.toFixed(2)} does not match claim netPayable ₹${netPayable.toFixed(2)} (discrepancy ₹${discrepancy.toFixed(2)}).`
    );
  }

  return {
    approvedAmount,
    advanceAdjusted,
    miscAdjustments,
    recoverableAmount,
    finalSettlement,
    isBalanced,
    discrepancy,
    blockers,
  };
}

export function getLedgerStatus(
  claim: ClaimHeader
): 'Reconciled' | 'Mismatch' | 'Pending' {
  if (claim.approvedAmount === null || claim.netPayable === null) {
    return 'Pending';
  }
  if (claim.ledgerMismatchFlag) {
    return 'Mismatch';
  }
  return 'Reconciled';
}

export function formatLedgerLine(
  label: string,
  amount: number,
  sign: '+' | '-'
): string {
  const formattedAmount = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = sign === '+' ? '+' : '-';
  return `${label.padEnd(36)} ${prefix} ₹${formattedAmount}`;
}


