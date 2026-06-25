import type {
  ClaimHeader,
  ClaimLineItem,
  ClaimAttachment,
  DARecord,
  TravelLeg,
  AdvanceRecord,
  ValidationError,
} from '../types';

import {
  isOverPolicy,
  requiresReceipt,
  getRequiredDocuments,
} from './policyEngine';

import { mockClaims } from '../data/mockClaims';

// ── Constants ──────────────────────────────────────────────────────────────

export const SUPPORTED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png'] as const;
export const MAX_FILE_SIZE_MB = 5;

/** Days of buffer allowed for expense dates outside the assignment period. */
const DATE_BUFFER_DAYS = 2;

// ── Internal helpers ───────────────────────────────────────────────────────

function toMs(isoDate: string): number {
  return new Date(isoDate).getTime();
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function datesBetween(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const current = new Date(startIso);
  const end = new Date(endIso);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function makeError(
  field: string,
  message: string,
): ValidationError {
  return { field, message, severity: 'error' };
}

function makeWarning(
  field: string,
  message: string,
): ValidationError {
  return { field, message, severity: 'warning' };
}

// ── Public helpers ─────────────────────────────────────────────────────────

/**
 * Returns true when an identical (or overlapping) claim already exists in the
 * supplied existingClaims list for the same trainer and at least one of the
 * given assignment IDs within the date range.
 */
export function isDuplicateClaim(
  _trainerId: string,
  assignmentIds: string[],
  startDate: string,
  endDate: string,
  existingClaims: ClaimHeader[],
): boolean {
  const startMs = toMs(startDate);
  const endMs = toMs(endDate);

  return existingClaims.some((existing) => {
    // Must belong to the same trainer (matched via trainerName placeholder — real
    // implementations would compare trainerId stored on ClaimHeader).
    const trainerMatch = existing.assignmentIds.some((aid) =>
      assignmentIds.includes(aid),
    );
    if (!trainerMatch) return false;

    // Check date-range overlap using the claim's submittedAt ?? lastActionAt as a proxy
    const referenceDate = existing.submittedAt ?? existing.lastActionAt;
    const existingStart = toMs(referenceDate.slice(0, 10));
    const existingEnd = existing.submittedAt
      ? toMs(existing.submittedAt.slice(0, 10))
      : existingStart;

    return startMs <= existingEnd && endMs >= existingStart;
  });
}

// ── validateClaimForSubmission ─────────────────────────────────────────────

/**
 * Full submission-time validation for a claim.
 * Returns an array of ValidationErrors — items with severity 'error' block
 * submission; items with severity 'warning' are advisory.
 */
export function validateClaimForSubmission(
  claim: ClaimHeader,
  lineItems: ClaimLineItem[],
  attachments: ClaimAttachment[],
  daRecords: DARecord[],
  travelLegs: TravelLeg[],
  advanceRecords: AdvanceRecord[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. No valid assignment linked
  if (!claim.assignmentIds || claim.assignmentIds.length === 0) {
    errors.push(
      makeError(
        'assignmentIds',
        'Claim must be linked to at least one valid assignment.',
      ),
    );
  }

  // 2. Required travel fields missing — check each leg
  travelLegs.forEach((leg, idx) => {
    const prefix = `travelLegs[${idx}]`;
    if (!leg.from || leg.from.trim() === '') {
      errors.push(
        makeError(`${prefix}.from`, `Travel leg ${idx + 1}: departure city is required.`),
      );
    }
    if (!leg.to || leg.to.trim() === '') {
      errors.push(
        makeError(`${prefix}.to`, `Travel leg ${idx + 1}: destination city is required.`),
      );
    }
    if (!leg.departureDate) {
      errors.push(
        makeError(`${prefix}.departureDate`, `Travel leg ${idx + 1}: departure date is required.`),
      );
    }
    if (!leg.arrivalDate) {
      errors.push(
        makeError(`${prefix}.arrivalDate`, `Travel leg ${idx + 1}: arrival date is required.`),
      );
    }
    if (!leg.mode) {
      errors.push(
        makeError(`${prefix}.mode`, `Travel leg ${idx + 1}: travel mode is required.`),
      );
    }
  });

  // Derive claim period from line items and travel legs for boundary checks
  const allDates = [
    ...lineItems.map((li) => li.date ?? ''),
    ...travelLegs.map((tl) => tl.departureDate),
    ...travelLegs.map((tl) => tl.arrivalDate),
    ...daRecords.map((da) => da.date),
  ].filter(Boolean);

  const claimStart =
    allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : '';
  const claimEnd =
    allDates.length > 0 ? allDates.reduce((a, b) => (a > b ? a : b)) : '';

  // 3. Required documents missing (per policyEngine.getRequiredDocuments)
  const expenseTypes = [...new Set(lineItems.map((li) => li.expenseType as string))];
  const requiredDocs = getRequiredDocuments(expenseTypes);
  const attachmentCategories = attachments.map((a) => a.category as string);

  for (const doc of requiredDocs) {
    // Map required doc description to expense categories present in attachments
    const docLower = doc.toLowerCase();
    const covered =
      (docLower.includes('hotel') && attachmentCategories.includes('Lodging')) ||
      (docLower.includes('cab') && attachmentCategories.includes('Cab')) ||
      (docLower.includes('e-ticket') && (attachmentCategories.includes('TA') || attachmentCategories.includes('Other'))) ||
      (docLower.includes('boarding') && attachmentCategories.includes('TA')) ||
      (docLower.includes('pnr') && attachmentCategories.includes('TA')) ||
      attachments.some((a) =>
        a.fileName.toLowerCase().includes(docLower.split(' ')[0].toLowerCase()),
      );

    if (!covered) {
      errors.push(
        makeError(
          'attachments',
          `Required document missing: "${doc}".`,
        ),
      );
    }
  }

  // 4. Expense date outside claim period + buffer
  if (claimStart && claimEnd) {
    const bufferStart = addDays(claimStart, -DATE_BUFFER_DAYS);
    const bufferEnd = addDays(claimEnd, DATE_BUFFER_DAYS);

    lineItems.forEach((li, idx) => {
      const liDate = li.date ?? '';
      if (liDate && (liDate < bufferStart || liDate > bufferEnd)) {
        errors.push(
          makeError(
            `lineItems[${idx}].date`,
            `Line item "${li.description}" date ${liDate} is outside the claim period (with ${DATE_BUFFER_DAYS}-day buffer).`,
          ),
        );
      }
    });
  }

  // 5. Duplicate claim for same trainer / assignment / date range
  const otherClaims = mockClaims.filter((c: ClaimHeader) => c.claimId !== claim.claimId);
  if (
    claim.assignmentIds.length > 0 &&
    claimStart &&
    claimEnd &&
    isDuplicateClaim(
      claim.trainerName, // using trainerName as trainerId proxy
      claim.assignmentIds,
      claimStart,
      claimEnd,
      otherClaims,
    )
  ) {
    errors.push(
      makeError(
        'assignmentIds',
        'A claim already exists for this trainer, assignment, and date range.',
      ),
    );
  }

  // 6. Duplicate DA date
  const seenDates = new Set<string>();
  daRecords.forEach((da, idx) => {
    if (seenDates.has(da.date)) {
      errors.push(
        makeError(
          `daRecords[${idx}].date`,
          `Duplicate DA record for date ${da.date}. Only one DA entry per day is allowed.`,
        ),
      );
    }
    seenDates.add(da.date);
  });

  // 7. DA claimed for leave day
  daRecords.forEach((da, idx) => {
    if (da.isLeaveDay) {
      errors.push(
        makeError(
          `daRecords[${idx}].date`,
          `DA cannot be claimed for ${da.date} as it is marked as a leave day.`,
        ),
      );
    }
  });

  // 8. DA claimed for personal stayback day
  daRecords.forEach((da, idx) => {
    if (da.isPersonalStayback) {
      errors.push(
        makeError(
          `daRecords[${idx}].date`,
          `DA cannot be claimed for ${da.date} — personal stayback days are not reimbursable.`,
        ),
      );
    }
  });

  // 9. Cab from/to route missing
  travelLegs
    .filter((leg) => leg.mode === 'Cab')
    .forEach((leg, idx) => {
      if (!leg.from || !leg.to) {
        errors.push(
          makeError(
            `travelLegs[cab-${idx}]`,
            `Cab travel leg ${idx + 1}: both pick-up and drop-off locations are required.`,
          ),
        );
      }
    });

  // 10. Advance adjustment incomplete — warning
  const claimAdvances = advanceRecords.filter(
    (adv) =>
      adv.balance !== undefined && adv.balance > 0,
  );
  claimAdvances.forEach((adv) => {
    errors.push(
      makeWarning(
        'advanceRecords',
        `Advance of INR ${adv.amount} (ID: ${adv.advanceId}) has not been fully adjusted. Balance payable: ${adv.balance}.`,
      ),
    );
  });

  // 11. Over-policy amount without exception — warning
  lineItems.forEach((li, idx) => {
    if (
      isOverPolicy(
        li.claimedAmount,
        li.expenseType,
        claim.destinationCities[0] ?? '',
        undefined,
        li.date ?? '',
      ) &&
      !li.exceptionRequired
    ) {
      errors.push(
        makeWarning(
          `lineItems[${idx}].claimedAmount`,
          `Line item "${li.description}" (${li.expenseType}) exceeds the policy limit of ${li.claimedAmount}. Raise an exception request or reduce the amount.`,
        ),
      );
    }
  });

  // 12. Missing receipt for required expense — error
  lineItems.forEach((li, idx) => {
    if (
      requiresReceipt(li.expenseType, claim.destinationCities[0] ?? '', li.date ?? '') &&
      !li.receiptUploaded
    ) {
      errors.push(
        makeError(
          `lineItems[${idx}].receiptUploaded`,
          `A receipt is required for "${li.description}" (${li.expenseType}) but none has been attached.`,
        ),
      );
    }
  });

  // 13. Unsupported attachment type — error
  attachments.forEach((att, idx) => {
    const ext = '.' + att.fileName.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_FILE_TYPES.includes(ext as typeof SUPPORTED_FILE_TYPES[number])) {
      errors.push(
        makeError(
          `attachments[${idx}].fileName`,
          `Attachment "${att.fileName}" has an unsupported file type. Allowed types: ${SUPPORTED_FILE_TYPES.join(', ')}.`,
        ),
      );
    }
    if (att.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
      errors.push(
        makeError(
          `attachments[${idx}].fileSize`,
          `Attachment "${att.fileName}" exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB} MB.`,
        ),
      );
    }
  });

  return errors;
}

// ── validateForHRAdmin ─────────────────────────────────────────────────────

/**
 * HR/Admin-level review flags. These are all warnings (not blockers) to assist
 * reviewers when auditing a submitted claim.
 */
export function validateForHRAdmin(
  claim: ClaimHeader,
  lineItems: ClaimLineItem[],
  attachments: ClaimAttachment[],
  daRecords: DARecord[],
  travelLegs: TravelLeg[],
): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Missing documents flag
  if (claim.missingDocumentFlag) {
    warnings.push(
      makeWarning(
        'attachments',
        'Claim is flagged for missing supporting documents. Review attachments before approval.',
      ),
    );
  }

  // Duplicate invoice — check for attachments with identical filenames
  const fileNames = attachments.map((a) => a.fileName);
  const duplicateFiles = fileNames.filter(
    (name, i) => fileNames.indexOf(name) !== i,
  );
  if (duplicateFiles.length > 0) {
    warnings.push(
      makeWarning(
        'attachments',
        `Possible duplicate invoices detected: ${[...new Set(duplicateFiles)].join(', ')}.`,
      ),
    );
  }

  // Route discontinuity — consecutive legs should connect (to === next from)
  for (let i = 0; i < travelLegs.length - 1; i++) {
    const current = travelLegs[i];
    const next = travelLegs[i + 1];
    if (
      current.to &&
      next.from &&
      current.to.trim().toLowerCase() !== next.from.trim().toLowerCase()
    ) {
      warnings.push(
        makeWarning(
          `travelLegs[${i + 1}].from`,
          `Route gap detected: leg ${i + 1} ends at "${current.to}" but leg ${i + 2} departs from "${next.from}".`,
        ),
      );
    }
  }

  // Over-policy line items
  lineItems.forEach((li, idx) => {
    if (
      isOverPolicy(li.claimedAmount, li.expenseType, claim.destinationCities[0] ?? '', undefined, li.date ?? '')
    ) {
      warnings.push(
        makeWarning(
          `lineItems[${idx}].claimedAmount`,
          `Line item "${li.description}" (${li.expenseType}) exceeds the policy limit. Verify or request exception documentation.`,
        ),
      );
    }
  });

  // Leave day DA
  daRecords
    .filter((da) => da.isLeaveDay)
    .forEach((da) => {
      warnings.push(
        makeWarning(
          'daRecords',
          `DA claimed for ${da.date} which is marked as a leave day.`,
        ),
      );
    });

  // Personal stayback DA
  daRecords
    .filter((da) => da.isPersonalStayback)
    .forEach((da) => {
      warnings.push(
        makeWarning(
          'daRecords',
          `DA claimed for ${da.date} which is a personal stayback day.`,
        ),
      );
    });

  // Cab timing mismatch — cab date outside travel leg dates
  const travelDates = new Set<string>(
    travelLegs.flatMap((leg) => datesBetween(leg.departureDate, leg.arrivalDate)),
  );
  lineItems
    .filter((li) => li.expenseType === 'Cab')
    .forEach((li, idx) => {
      const liDate = li.date ?? '';
      if (travelDates.size > 0 && liDate && !travelDates.has(liDate)) {
        warnings.push(
          makeWarning(
            `lineItems[cab-${idx}].date`,
            `Cab expense "${li.description}" on ${liDate} does not correspond to any travel leg date.`,
          ),
        );
      }
    });

  // Ledger mismatch
  if (claim.ledgerMismatchFlag) {
    warnings.push(
      makeWarning(
        'totalClaimedAmount',
        'Claimed amount does not match the ledger entry. Finance reconciliation required.',
      ),
    );
  }

  // SLA breach
  if (claim.slaBreached) {
    warnings.push(
      makeWarning(
        'submittedAt',
        `Claim has breached the SLA threshold (${claim.agingDays} days in current status).`,
      ),
    );
  }

  // High-value claim
  if (claim.highValue) {
    warnings.push(
      makeWarning(
        'totalClaimedAmount',
        `Claim is flagged as high-value (${claim.currency} ${claim.totalClaimedAmount.toLocaleString()}). Senior approval may be required.`,
      ),
    );
  }

  return warnings;
}
