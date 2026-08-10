// Live exchange rates — fetched from open.er-api.com (same data source as XE)
// Cached in sessionStorage for the browser session to avoid repeated fetches

const CACHE_KEY = 'live_fx_rates';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RatesCache {
  rates: Record<string, number>; // key = currency code, value = 1 USD = X units
  fetchedAt: number;
}

// Fallback rates if the API is unreachable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, INR: 84, AED: 3.67, EUR: 0.92, GBP: 0.79,
  SGD: 1.34, AUD: 1.53, CAD: 1.36, JPY: 155, SAR: 3.75,
  QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.38, MYR: 4.71,
  THB: 35.1, ZAR: 18.6, NPR: 134, BDT: 110, LKR: 320,
};

let _ratesPromise: Promise<Record<string, number>> | null = null;

export async function fetchLiveRates(): Promise<Record<string, number>> {
  // Return cached promise if already in-flight
  if (_ratesPromise) return _ratesPromise;

  // Check sessionStorage cache
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: RatesCache = JSON.parse(raw);
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.rates;
      }
    }
  } catch { /* ignore */ }

  _ratesPromise = (async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rates: Record<string, number> = data.rates ?? {};
      // Persist to session cache
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rates, fetchedAt: Date.now() }));
      return rates;
    } catch {
      console.warn('[currencyRates] Live fetch failed — using fallback rates');
      return FALLBACK_RATES;
    } finally {
      _ratesPromise = null;
    }
  })();

  return _ratesPromise;
}

/**
 * Convert `amount` in `fromCurrency` to INR using live rates.
 * `rates` is the Record returned by fetchLiveRates() (all vs USD).
 */
export function convertToINR(amount: number, fromCurrency: string, rates: Record<string, number>): number {
  if (!amount || amount === 0) return 0;
  const cur = (fromCurrency ?? 'INR').toUpperCase();
  if (cur === 'INR') return amount;
  const inrPerUsd = rates['INR'] ?? FALLBACK_RATES['INR'] ?? 84;
  const curPerUsd = rates[cur] ?? FALLBACK_RATES[cur] ?? 84;
  // amount / curPerUsd = USD; USD * inrPerUsd = INR
  return Math.round((amount / curPerUsd) * inrPerUsd);
}

/** React hook — fetches once and keeps rates in state */
import { useState, useEffect } from 'react';

export function useLiveRates() {
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveRates().then(r => { setRates(r); setLoading(false); });
  }, []);

  return { rates, loading };
}
