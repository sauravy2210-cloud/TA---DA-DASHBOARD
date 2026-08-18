/**
 * Live FX rates — GET /api/fx-rates?base=INR&symbols=USD,AED
 *
 * Fetches mid-market rates from Frankfurter (European Central Bank data),
 * the same authoritative source used by XE.com for mid-market rates.
 * Results are cached server-side for 1 hour to minimise external calls.
 *
 * Response: { base, rates: { USD: number, AED: number, ... }, updatedAt: ISO }
 */
export const config = { maxDuration: 10 }; // Vercel Hobby plan hard cap

// Simple in-memory cache (survives within a single serverless instance lifetime)
let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const base    = String(req.query.base    || 'INR').toUpperCase();
  const symbols = String(req.query.symbols || 'USD,AED,EUR,GBP').toUpperCase();

  // Return cached rates if still fresh
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL_MS && cache.base === base) {
    const filtered = {};
    for (const s of symbols.split(',')) {
      if (cache.rates[s] != null) filtered[s] = cache.rates[s];
    }
    return res.status(200).json({
      base,
      rates: filtered,
      updatedAt: cache.updatedAt,
      source: 'Frankfurter / ECB (cached)',
    });
  }

  try {
    // Frankfurter API — ECB data, no API key required, same source as XE mid-market rates
    const url = `https://api.frankfurter.app/latest?from=${base}`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Koenig-TADA-Portal/1.0' },
    });

    if (!r.ok) throw new Error(`Frankfurter HTTP ${r.status}`);
    const data = await r.json();

    if (!data.rates) throw new Error('No rates in response');

    // Cache the full rate set
    cache = {
      base: data.base || base,
      rates: data.rates,
      updatedAt: data.date ? `${data.date}T00:00:00Z` : new Date().toISOString(),
    };
    cacheTime = now;

    // Return only the requested symbols
    const filtered = {};
    for (const s of symbols.split(',')) {
      if (data.rates[s] != null) filtered[s] = data.rates[s];
    }

    return res.status(200).json({
      base: data.base || base,
      rates: filtered,
      updatedAt: cache.updatedAt,
      source: 'Frankfurter / ECB (live)',
    });

  } catch (err) {
    // Fallback to hardcoded indicative rates so the UI never breaks
    const FALLBACK = { USD: 0.011976, AED: 0.043956, EUR: 0.010989, GBP: 0.009346 };
    const filtered = {};
    for (const s of symbols.split(',')) {
      if (FALLBACK[s]) filtered[s] = FALLBACK[s];
    }
    return res.status(200).json({
      base,
      rates: filtered,
      updatedAt: new Date().toISOString(),
      source: 'fallback-indicative',
      warning: `Live rates unavailable: ${err.message}`,
    });
  }
}
