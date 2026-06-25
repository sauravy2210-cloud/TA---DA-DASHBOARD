import type { PolicyRule } from '../types';
import { mockPolicies } from '../data/mockMasters';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalise a country string to the token used in policy expenseType fields. */
function countryToken(country: string): string {
  const c = country.trim().toLowerCase();
  if (c === 'india') return 'India';
  if (c === 'uae' || c === 'united arab emirates') return 'International';
  if (c === 'usa' || c === 'united states' || c === 'united states of america') return 'International';
  if (c === 'singapore') return 'International';
  if (c === 'uk' || c === 'united kingdom') return 'International';
  // Default — treat unknown countries as International
  return 'International';
}

/** Normalise a city-tier / city-category token for matching against expenseType. */
function tierToken(cityTier?: string): string {
  if (!cityTier) return '';
  const t = cityTier.trim().toLowerCase();
  if (t === 'tier-1' || t === 'tier1' || t === 'metro') return 'Metro';
  if (t === 'tier-2' || t === 'tier2') return 'Tier1';   // policy uses Tier1 for Tier-2 cities
  if (t === 'tier-3' || t === 'tier3') return 'Tier2';
  if (t === 'international') return 'International';
  return '';
}

/** Map expenseType strings to PolicyCategory values. */
function categoryFromExpenseType(expenseType: string): string {
  const e = expenseType.trim().toLowerCase();
  if (e === 'da' || e === 'daily allowance') return 'DA';
  if (e === 'hotel' || e === 'accommodation') return 'Hotel';
  if (e === 'cab' || e === 'conveyance' || e === 'local transport') return 'Cab';
  if (e === 'flight' || e === 'air travel') return 'Flight';
  if (e === 'train' || e === 'rail') return 'Train';
  // Pass through capitalised as-is for any future categories
  return expenseType.trim();
}

/**
 * Score a policy for how well it matches a given country + optional tier.
 * Higher score = better match. Returns -1 if clearly not a match.
 */
function matchScore(policy: PolicyRule, country: string, cityTier?: string): number {
  const applicable = policy.expenseType.toLowerCase();
  const countryTok = countryToken(country).toLowerCase();
  const tierTok = tierToken(cityTier).toLowerCase();

  // International country — must match an "international" rule
  if (countryTok === 'international') {
    if (!applicable.includes('international')) return -1;
    // Prefer a rule that also names the city/country (e.g. "International Dubai")
    return applicable === 'international' ? 1 : 2;
  }

  // Domestic (India) rules
  if (countryTok === 'india') {
    if (!applicable.includes('india')) return -1;
    if (tierTok && applicable.includes(tierTok)) return 3;      // exact tier match
    if (applicable === 'india') return 1;                        // generic India rule
    return 0;
  }

  return -1;
}

/**
 * Check whether a policy is effective on a given date.
 * If no date is supplied the policy is considered in effect.
 */
function isEffective(policy: PolicyRule, date?: string): boolean {
  if (!date) return true;
  return policy.effectiveFrom <= date;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Returns the best-matching active PolicyRule for the supplied parameters, or
 * null when no policy covers the combination.
 */
export function getActivePolicy(
  expenseType: string,
  country: string,
  cityTier?: string,
  date?: string,
): PolicyRule | null {
  const category = categoryFromExpenseType(expenseType);

  const candidates = mockPolicies.filter(
    (p) =>
      p.active &&
      p.expenseType === category &&
      isEffective(p, date) &&
      matchScore(p, country, cityTier) >= 0,
  );

  if (candidates.length === 0) return null;

  // Return the candidate with the highest specificity score
  candidates.sort(
    (a, b) => matchScore(b, country, cityTier) - matchScore(a, country, cityTier),
  );
  return candidates[0];
}

/**
 * Returns the effective monetary cap for the expense type in the given context.
 * Returns 0 when no policy is found or no cap is defined.
 */
export function getPolicyLimit(
  expenseType: string,
  country: string,
  cityTier?: string,
  date?: string,
): number {
  const policy = getActivePolicy(expenseType, country, cityTier, date);
  if (!policy) return 0;
  return policy.maxAmount ?? 0;
}

/**
 * Returns true when the supplied amount exceeds the policy cap.
 * If no cap is defined (limit === 0) the function always returns false so that
 * uncapped expense types (Flight, Train) are not flagged.
 */
export function isOverPolicy(
  amount: number,
  expenseType: string,
  country: string,
  cityTier?: string,
  date?: string,
): boolean {
  const limit = getPolicyLimit(expenseType, country, cityTier, date);
  if (limit === 0) return false;
  return amount > limit;
}

/**
 * Returns true when the policy for this expense type mandates a receipt.
 * Hotel, Cab, Flight, and Train always require receipts; DA does not.
 */
export function requiresReceipt(
  expenseType: string,
  country: string,
  date?: string,
): boolean {
  const category = categoryFromExpenseType(expenseType);
  // DA is the only category where receipts are not required
  if (category === 'DA') return false;

  const _policy = getActivePolicy(expenseType, country, undefined, date);
  if (!_policy) {
    // Default to requiring receipt for unknown expense types
    return category !== 'DA';
  }

  // All non-DA categories in the mock data require receipts per their notes
  return true;
}

/**
 * Returns the DA rate (per day) applicable for the given date, country and tier.
 * Returns 0 when no DA policy is found.
 */
export function getDARateForDay(
  date: string,
  country: string,
  cityTier?: string,
): number {
  return getPolicyLimit('DA', country, cityTier, date);
}

/**
 * Determines how a partial travel day counts toward DA entitlement.
 *
 * Logic derived from the "DA India Metro" policy notes:
 *   - Departure day before 17:00  → 'excluded' (traveller is leaving, no overnight)
 *   - Departure day at/after 17:00 → 'half' (late departure earns half day)
 *   - Arrival day before/at 12:00  → 'half' (early arrival, short stay)
 *   - Arrival day after 12:00      → 'full' (arrived late, qualifies for full day)
 *   - Non-travel days              → 'full'
 *
 * Returns:
 *   'full'     — full DA rate applies
 *   'half'     — 50 % of DA rate applies
 *   'excluded' — no DA payable for this day
 */
export function checkDAPartialDay(
  departureTime: string | undefined,
  arrivalTime: string | undefined,
  isDepartureDay: boolean,
  isArrivalDay: boolean,
): 'full' | 'half' | 'excluded' {
  if (isDepartureDay && departureTime) {
    const [hh, mm] = departureTime.split(':').map(Number);
    const minutes = hh * 60 + (mm ?? 0);
    const cutoff17 = 17 * 60; // 17:00
    // Departing before 17:00 → not eligible (excluded)
    if (minutes < cutoff17) return 'excluded';
    // Departing at or after 17:00 → half day
    return 'half';
  }

  if (isArrivalDay && arrivalTime) {
    const [hh, mm] = arrivalTime.split(':').map(Number);
    const minutes = hh * 60 + (mm ?? 0);
    const cutoff12 = 12 * 60; // 12:00
    // Arriving after 12:00 → full day
    if (minutes > cutoff12) return 'full';
    // Arriving at or before 12:00 → half day (short stay on that day)
    return 'half';
  }

  // Regular travel day — full DA applies
  return 'full';
}

// Document requirements keyed by expense category
const DOCUMENT_MAP: Record<string, string[]> = {
  DA: [],   // No supporting documents needed for DA
  Hotel: ['Hotel Invoice / Receipt', 'GST Invoice (if applicable)'],
  Cab: ['Cab / Meter Receipt', 'App Receipt (Uber / Ola / etc.)'],
  Flight: ['E-Ticket', 'Boarding Pass'],
  Train: ['PNR-linked E-Ticket'],
};

/**
 * Returns the consolidated list of required document types for a claim that
 * contains the supplied expense types. Duplicates are removed.
 */
export function getRequiredDocuments(expenseTypes: string[]): string[] {
  const docs = new Set<string>();
  for (const expenseType of expenseTypes) {
    const category = categoryFromExpenseType(expenseType);
    const required = DOCUMENT_MAP[category] ?? [`Receipt for ${category}`];
    for (const doc of required) {
      docs.add(doc);
    }
  }
  return Array.from(docs);
}

/**
 * Returns true when the claimed amount exceeds the policy limit by more than
 * a defined exception threshold (20 % above cap), meaning finance approval /
 * exception sign-off is required before the claim can be processed.
 *
 * If no cap exists (limit === 0) the function returns false — uncapped expense
 * types never require an exception workflow.
 */
export function isExceptionRequired(
  amount: number,
  expenseType: string,
  country: string,
  cityTier?: string,
  date?: string,
): boolean {
  const limit = getPolicyLimit(expenseType, country, cityTier, date);
  if (limit === 0) return false;
  const exceptionThreshold = limit * 1.2; // 20 % tolerance before exception is raised
  return amount > exceptionThreshold;
}
