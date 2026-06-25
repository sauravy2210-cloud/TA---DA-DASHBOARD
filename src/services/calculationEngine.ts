/**
 * calculationEngine.ts
 *
 * Core calculation engine for the Koenig TA/DA Dashboard.
 * All monetary values are in INR unless explicitly noted.
 */

import type {
  TravelLeg,
  HotelStay,
  DARecord,
  CabRecord,
  ClaimLineItem,
  LeaveRecord,
} from '../types';

import {
  getDARateForDay,
  checkDAPartialDay,
  getPolicyLimit,
} from './policyEngine';


// ── Internal utilities ──────────────────────────────────────────────────────

/** Parse an ISO date string (YYYY-MM-DD) into a UTC midnight Date. */
function parseDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date as YYYY-MM-DD (ISO). */
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Return an array of ISO date strings covering [start, end] inclusive. */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = parseDate(start);
  const last = parseDate(end);
  while (current <= last) {
    dates.push(toISODate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** Convert a foreign-currency amount to INR using mockCountries rates. */


// ── DA Breakdown ────────────────────────────────────────────────────────────

interface DABreakdownParams {
  travelLegs: TravelLeg[];
  hotelStays: HotelStay[];
  assignmentStartDate: string;
  assignmentEndDate: string;
  leaveRecords: LeaveRecord[];
  personalStaybackDates: string[];
  country: string;
  city: string;
  cityTier: string;
}

/**
 * Build a DARecord for every calendar day from the first departure to the last
 * arrival, applying:
 *   - Leave-day exclusion (isLeaveDay → eligibleAmount 0)
 *   - Personal stayback exclusion (isPersonalStayback → eligibleAmount 0)
 *   - Partial-day logic for departure / arrival days
 *   - Policy-rate lookup via policyEngine
 */
export function calculateDABreakdown(params: DABreakdownParams): DARecord[] {
  const {
    travelLegs,
    leaveRecords,
    personalStaybackDates,
    country,
    cityTier,
  } = params;

  if (travelLegs.length === 0) return [];

  // Sort legs to find first departure and last arrival
  const sorted = [...travelLegs].sort((a, b) =>
    a.departureDate.localeCompare(b.departureDate),
  );
  const firstDeparture = sorted[0].departureDate;
  const lastArrival = sorted.reduce((acc, leg) =>
    leg.arrivalDate > acc ? leg.arrivalDate : acc,
    sorted[0].arrivalDate,
  );

  const days = dateRange(firstDeparture, lastArrival);

  // Build leave-day set — use leaveRecord.approved instead of status
  const leaveDays = new Set<string>();
  for (const leave of leaveRecords) {
    if (leave.approved) {
      for (const d of dateRange(leave.startDate, leave.endDate)) {
        leaveDays.add(d);
      }
    }
  }

  // Personal stayback set
  const staybackSet = new Set(personalStaybackDates);

  // Departure / arrival day index from travel legs
  const departureDays = new Map<string, string>(); // date → HH:MM time
  const arrivalDays   = new Map<string, string>(); // date → HH:MM time
  for (const leg of travelLegs) {
    departureDays.set(leg.departureDate, leg.departureTime ?? '');
    arrivalDays.set(leg.arrivalDate, leg.arrivalTime ?? '');
  }

  const records: DARecord[] = [];

  for (const date of days) {
    const isLeaveDay = leaveDays.has(date);
    const isPersonalStayback = staybackSet.has(date);
    const isDepartureDay = departureDays.has(date);
    const isArrivalDay = arrivalDays.has(date);
    const departureTime = departureDays.get(date);
    const arrivalTime = arrivalDays.get(date);

    const partialDayStatus = checkDAPartialDay(
      departureTime,
      arrivalTime,
      isDepartureDay,
      isArrivalDay,
    );

    const policyRate = getDARateForDay(date, country, cityTier);

    let eligibleAmount = 0;
    if (!isLeaveDay && !isPersonalStayback) {
      if (partialDayStatus === 'full') {
        eligibleAmount = policyRate;
      } else if (partialDayStatus === 'half') {
        eligibleAmount = policyRate / 2;
      }
      // 'excluded' → 0
    }

    records.push({
      date,
      city: params.city,
      country,
      cityTier,
      rateApplicable: policyRate,
      fullDayEligible: partialDayStatus === 'full',
      partialDayReason: partialDayStatus !== 'full' ? partialDayStatus : undefined,
      isLeaveDay,
      isPersonalStayback,
      isDuplicate: false,
      eligibleAmount,
      notes: partialDayStatus === 'excluded'
        ? 'Day excluded by partial-day rule'
        : partialDayStatus === 'half'
        ? 'Half-day DA applied'
        : undefined,
    });

    // Attach computed fields via type extension (cast to avoid TS error on
    // the narrower base type — the extended shape is used internally)
    const record = records[records.length - 1] as DARecord & {
      isDepartureDay: boolean;
      isArrivalDay: boolean;
      partialDayStatus: 'full' | 'half' | 'excluded';
      policyRate: number;
      eligibleAmount: number;
    };
    record.isDepartureDay = isDepartureDay;
    record.isArrivalDay = isArrivalDay;
    record.partialDayStatus = partialDayStatus;
    record.policyRate = policyRate;
    record.eligibleAmount = eligibleAmount;
  }

  return records;
}

// ── Claim Totals ────────────────────────────────────────────────────────────

interface ClaimTotals {
  totalClaimedAmount: number;
  eligibleAmount: number;
  approvedAmount: number;
  deductionAmount: number;
  advanceAdjusted: number;
  miscAdjustments: number;
  recoverableAmount: number;
  netPayable: number;
}

/**
 * Aggregate claim line items into a summary.
 * netPayable = approvedAmount - advanceAdjusted + miscAdjustments - recoverableAmount
 */
export function calculateClaimTotals(lineItems: ClaimLineItem[]): ClaimTotals {
  let totalClaimedAmount = 0;
  let eligibleAmount = 0;
  let approvedAmount = 0;
  let deductionAmount = 0;

  for (const item of lineItems) {
    totalClaimedAmount += item.claimedAmount;
    const approved = item.approvedAmount ?? 0;
    approvedAmount += approved;
    deductionAmount += item.claimedAmount - approved;
    // Eligible = claimed unless there is an explicit deduction (deductionAmount > 0)
    eligibleAmount += item.deductionAmount ? approved : item.claimedAmount;
  }

  // Advance and misc are not stored per line-item in the base type; callers
  // should supply them via a wrapper. We expose zero defaults here.
  const advanceAdjusted = 0;
  const miscAdjustments = 0;
  const recoverableAmount = 0;

  const netPayable =
    approvedAmount - advanceAdjusted + miscAdjustments - recoverableAmount;

  return {
    totalClaimedAmount,
    eligibleAmount,
    approvedAmount,
    deductionAmount,
    advanceAdjusted,
    miscAdjustments,
    recoverableAmount,
    netPayable,
  };
}

// ── Lodging Eligibility ─────────────────────────────────────────────────────

interface LodgingEligibility {
  eligibleAmount: number;
  deduction: number;
  isPersonalStayback: boolean;
  recoverable: number;
}

/**
 * Determine how much of a hotel stay is reimbursable against the policy limit.
 * Personal stayback nights are marked as recoverable (trainer must repay).
 */
export function calculateLodgingEligibility(
  stay: HotelStay,
  policyLimit: number,
): LodgingEligibility {
  const isPersonalStayback = stay.stayType === 'Company Provided' ? false : true;

  if (isPersonalStayback) {
    const totalINR = stay.totalAmount;
    return {
      eligibleAmount: 0,
      deduction: totalINR,
      isPersonalStayback: true,
      recoverable: totalINR,
    };
  }

  const totalINR = stay.totalAmount;

  // Calculate number of nights
  const checkIn = parseDate(stay.checkIn);
  const checkOut = parseDate(stay.checkOut);
  const nights = Math.max(
    1,
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
  );

  const cappedTotal = policyLimit * nights;

  if (totalINR <= cappedTotal) {
    return {
      eligibleAmount: totalINR,
      deduction: 0,
      isPersonalStayback: false,
      recoverable: 0,
    };
  }

  return {
    eligibleAmount: cappedTotal,
    deduction: totalINR - cappedTotal,
    isPersonalStayback: false,
    recoverable: 0,
  };
}

// ── Cab Eligibility ─────────────────────────────────────────────────────────

interface CabEligibility {
  eligible: boolean;
  eligibleAmount: number;
  deduction: number;
  reason?: string;
}

/**
 * Determine whether a cab record is reimbursable.
 * Rules:
 *   1. Cab date must fall within assignment dates.
 *   2. Claimed amount must not exceed the policy daily cap.
 *   3. A receipt must be present.
 */
export function calculateCabEligibility(
  cab: CabRecord,
  assignmentDates: string[],
  policyLimit: number,
): CabEligibility {
  const assignmentSet = new Set(assignmentDates);

  if (!assignmentSet.has(cab.date)) {
    return {
      eligible: false,
      eligibleAmount: 0,
      deduction: cab.amount,
      reason: 'Travel date falls outside assignment period',
    };
  }

  if (!cab.receiptUploaded) {
    return {
      eligible: false,
      eligibleAmount: 0,
      deduction: cab.amount,
      reason: 'No receipt provided; cab reimbursement requires a valid receipt',
    };
  }

  const claimedINR = cab.amount;

  if (policyLimit > 0 && claimedINR > policyLimit) {
    return {
      eligible: true,
      eligibleAmount: policyLimit,
      deduction: claimedINR - policyLimit,
      reason: `Claimed amount ₹${claimedINR.toFixed(0)} exceeds daily cab limit of ₹${policyLimit.toFixed(0)}`,
    };
  }

  return {
    eligible: true,
    eligibleAmount: claimedINR,
    deduction: 0,
  };
}

// ── Formatting Utilities ────────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees using the Indian lakh/crore notation.
 * e.g. 142500 → "₹1,42,500"
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const absStr = Math.abs(rounded).toString();

  let formatted: string;
  if (absStr.length <= 3) {
    formatted = absStr;
  } else {
    // Last 3 digits are always grouped
    const last3 = absStr.slice(-3);
    const rest = absStr.slice(0, -3);
    // Remaining digits are grouped in pairs from the right
    const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = `${pairs},${last3}`;
  }

  return `${rounded < 0 ? '-' : ''}₹${formatted}`;
}

/**
 * Format an ISO date string (YYYY-MM-DD) as "18-Jun-2026".
 */
export function formatDate(date: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [y, m, d] = date.split('-').map(Number);
  const month = months[m - 1] ?? `${m}`;
  const day = String(d).padStart(2, '0');
  return `${day}-${month}-${y}`;
}

/**
 * Return the number of calendar days elapsed since a claim was submitted.
 * Returns 0 when submittedAt is in the future or unparseable.
 */
export function getAgingDays(submittedAt: string): number {
  const submitted = new Date(submittedAt);
  if (isNaN(submitted.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - submitted.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// Re-export getPolicyLimit for convenience so callers can resolve hotel/cab
// limits without importing policyEngine directly.
export { getPolicyLimit };


