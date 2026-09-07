// Route + multi-modal fare estimation for the Travel Bills "Map" column.
// Uses free, keyless services (OpenStreetMap Nominatim for geocoding, OSRM
// public demo for driving distance/time) since no Google Maps API key is
// configured in this project. Fares are heuristic estimates built from each
// country's publicly published metered-taxi / rideshare / transit rate
// cards (2024–25 ballpark figures), not live pricing — always paired with a
// link to open the real route in Google Maps so an approver can sanity-check
// against live data.

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export interface FareOption {
  mode: string;
  icon: string;
  fareLabel: string;
  etaLabel: string;
  note?: string;
}

export type CountryContext =
  | 'India' | 'UAE' | 'SaudiArabia' | 'Qatar'
  | 'USA' | 'UK' | 'Singapore' | 'Malaysia'
  | 'Australia' | 'SouthAfrica' | 'Other';

export interface RouteEstimate {
  origin: GeoPoint;
  destination: GeoPoint;
  distanceKm: number;
  durationMin: number;
  countryContext: CountryContext;
  contextLabel: string;
  fareOptions: FareOption[];
  mapsUrl: string;
  embedUrl: string;
}

const geocodeCache = new Map<string, GeoPoint | null>();
const routeCache = new Map<string, { distanceKm: number; durationMin: number } | null>();

// Real bill addresses carry several kinds of noise that trip up a literal-match geocoder:
//  - an airline name auto-appended to an airport label, e.g. "Delhi Airport (Air India )"
//  - a "House no./Flat no." style prefix, e.g. "House no.555, Sector 43 Gurugram ..."
//  - a PIN/ZIP code glued mid-string with no separating comma, e.g. "Gurugram 122009 Near ..."
// Strip all three before every geocoding attempt (Nominatim and Photon alike).
function stripNoise(query: string): string {
  return query
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^\s*(house|h|flat|plot|shop|door|building|bldg)\.?\s*no\.?\s*[:-]?\s*[\w./-]*\s*,?\s*/i, '')
    .replace(/\b\d{5,6}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Long, verbose bill addresses (building + cluster + street + city + country) often fail to
// match in one shot on Nominatim's parser. Fall back to progressively simplified variants —
// landmark name + city/country, then just the trailing city/country segments — before giving up.
function candidateQueries(query: string): string[] {
  const trimmed = query.trim();
  const stripped = stripNoise(trimmed);
  const parts = stripped.split(',').map(s => s.trim()).filter(Boolean);
  const variants = new Set<string>([trimmed, stripped]);
  if (parts.length > 3) {
    variants.add([parts[0], ...parts.slice(-2)].join(', '));
    variants.add(parts.slice(-3).join(', '));
  }
  if (parts.length > 2) {
    variants.add(parts.slice(-2).join(', '));
  }
  return Array.from(variants).filter(Boolean);
}

// Nominatim's usage policy caps public-instance callers at ~1 request/second. A single
// geocode() can itself issue several sequential candidate queries, and a route needs two
// geocode() calls (origin + destination) — serialize every Nominatim call through one
// module-level throttle so a busy reviewer clicking through several bills never bursts past
// that limit and gets silently rate-limited (which looks identical to "address not found").
let lastNominatimCall = 0;
async function throttleNominatim(): Promise<void> {
  const wait = Math.max(0, lastNominatimCall + 1100 - Date.now());
  lastNominatimCall = Date.now() + wait;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

async function geocodeOnce(query: string, countryCode?: string): Promise<GeoPoint | null> {
  await throttleNominatim();
  const cc = countryCode ? `&countrycodes=${countryCode}` : '';
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0${cc}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocode request failed');
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

// Photon (komoot's OSM-based search) tolerates typos, colloquial names ("Delhi Airport" vs.
// the official "Indira Gandhi International Airport") and noisy input far better than
// Nominatim's literal matcher — used only as a fallback once every Nominatim candidate has
// failed. `bias` (a country centroid, or the already-resolved other end of this same trip)
// keeps ambiguous short names (e.g. "Liverpool") from resolving to the wrong continent.
async function geocodePhoton(query: string, bias?: { lat: number; lon: number }): Promise<GeoPoint | null> {
  try {
    const biasParams = bias ? `&lat=${bias.lat}&lon=${bias.lon}&location_bias_scale=0.9` : '';
    const url = `https://photon.komoot.io/api/?limit=1${biasParams}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.geometry.coordinates;
    const p = feature.properties ?? {};
    const label = [p.name, p.city, p.state, p.country].filter(Boolean).join(', ') || query;
    return { lat, lon, label };
  } catch {
    return null;
  }
}

async function geocode(
  query: string,
  hint?: { cc: string; lat: number; lon: number },
  biasPoint?: GeoPoint
): Promise<GeoPoint | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  // Each candidate is tried independently — one throwing (e.g. a transient Nominatim
  // error) must not abort the remaining candidates or skip the Photon fallback below.
  for (const candidate of candidateQueries(query)) {
    try {
      const point = await geocodeOnce(candidate, hint?.cc);
      if (point) { geocodeCache.set(key, point); return point; }
    } catch { /* try the next candidate */ }
  }
  const bias = biasPoint ?? (hint ? { lat: hint.lat, lon: hint.lon } : undefined);
  try {
    const photonPoint = await geocodePhoton(stripNoise(query), bias);
    geocodeCache.set(key, photonPoint);
    return photonPoint;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

async function getRoadRoute(origin: GeoPoint, destination: GeoPoint): Promise<{ distanceKm: number; durationMin: number } | null> {
  const key = `${origin.lat},${origin.lon}|${destination.lat},${destination.lon}`;
  if (routeCache.has(key)) return routeCache.get(key)!;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('route request failed');
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) { routeCache.set(key, null); return null; }
    const result = { distanceKm: route.distance / 1000, durationMin: route.duration / 60 };
    routeCache.set(key, result);
    return result;
  } catch {
    routeCache.set(key, null);
    return null;
  }
}

// ─── Country detection ──────────────────────────────────────────────────────
// Nominatim's `display_name` always ends with the country name — that's a far
// more reliable signal than keyword-matching the raw (often abbreviated) bill
// address. We only fall back to keyword scanning of the raw From/To text when
// geocoding itself failed for both points.

const COUNTRY_NAME_TO_CONTEXT: Record<string, CountryContext> = {
  'india': 'India',
  'united arab emirates': 'UAE',
  'saudi arabia': 'SaudiArabia',
  'kingdom of saudi arabia': 'SaudiArabia',
  'qatar': 'Qatar',
  'united states': 'USA',
  'united states of america': 'USA',
  'usa': 'USA',
  'united kingdom': 'UK',
  'great britain': 'UK',
  'england': 'UK',
  'scotland': 'UK',
  'wales': 'UK',
  'singapore': 'Singapore',
  'malaysia': 'Malaysia',
  'australia': 'Australia',
  'south africa': 'SouthAfrica',
};

function contextFromCountryName(name: string | undefined): CountryContext | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return COUNTRY_NAME_TO_CONTEXT[key] ?? null;
}

function contextFromGeocodedLabel(label: string | undefined): CountryContext | null {
  if (!label) return null;
  const lastSegment = label.split(',').pop();
  return contextFromCountryName(lastSegment);
}

function contextFromKeywords(from: string, to: string): CountryContext {
  const s = `${from} ${to}`.toLowerCase();
  if (/dubai|abu dhabi|sharjah|\bajman\b|fujairah|ras al khaimah|united arab emirates|\buae\b/.test(s)) return 'UAE';
  if (/riyadh|jeddah|\bmecca\b|\bmakkah\b|medina|dammam|saudi arabia|\bksa\b/.test(s)) return 'SaudiArabia';
  if (/doha|\bqatar\b/.test(s)) return 'Qatar';
  if (/singapore/.test(s)) return 'Singapore';
  if (/kuala lumpur|penang|johor|malaysia|\bklia\b/.test(s)) return 'Malaysia';
  if (/sydney|melbourne|brisbane|perth|canberra|australia/.test(s)) return 'Australia';
  if (/johannesburg|cape town|durban|pretoria|south africa/.test(s)) return 'SouthAfrica';
  if (/london|manchester|birmingham|edinburgh|glasgow|united kingdom|\buk\b/.test(s)) return 'UK';
  if (/new york|los angeles|chicago|san francisco|boston|washington|\busa\b|united states/.test(s)) return 'USA';
  if (/india|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|noida|gurugram|gurgaon|ahmedabad|jaipur|lucknow|chandigarh|kochi|nagpur/.test(s)) return 'India';
  return 'Other';
}

function detectCountryContext(from: string, to: string, origin: GeoPoint | null, destination: GeoPoint | null): CountryContext {
  return (
    contextFromGeocodedLabel(destination?.label) ??
    contextFromGeocodedLabel(origin?.label) ??
    contextFromKeywords(from, to)
  );
}

// A coarse up-front guess (country code + centroid) from the raw bill text, used only to bias
// the geocoders toward the right part of the world — never as the final country shown to the
// user (detectCountryContext, above, trusts the actual geocoded result for that).
const COUNTRY_HINT_TABLE: Partial<Record<CountryContext, { cc: string; lat: number; lon: number }>> = {
  India: { cc: 'in', lat: 22.0, lon: 79.0 },
  UAE: { cc: 'ae', lat: 24.0, lon: 54.0 },
  SaudiArabia: { cc: 'sa', lat: 24.0, lon: 45.0 },
  Qatar: { cc: 'qa', lat: 25.3, lon: 51.2 },
  USA: { cc: 'us', lat: 39.8, lon: -98.6 },
  UK: { cc: 'gb', lat: 54.0, lon: -2.0 },
  Singapore: { cc: 'sg', lat: 1.35, lon: 103.8 },
  Malaysia: { cc: 'my', lat: 4.2, lon: 101.9 },
  Australia: { cc: 'au', lat: -25.0, lon: 134.0 },
  SouthAfrica: { cc: 'za', lat: -29.0, lon: 24.0 },
};

function guessCountryHint(from: string, to: string) {
  const ctx = contextFromKeywords(from, to);
  return ctx === 'Other' ? undefined : COUNTRY_HINT_TABLE[ctx];
}

// ─── Fare rate cards ────────────────────────────────────────────────────────
// Base + per-km (+ optional per-min) figures approximate each country's
// published metered-taxi and rideshare rate card. They are ballpark, not
// live/contracted pricing, and are shown with a ±15–25% band plus a note.

const round = (n: number) => Math.round(n);

function fmtRange(n: number, lowMult: number, highMult: number, locale: string) {
  return `${round(n * lowMult).toLocaleString(locale)} – ${round(n * highMult).toLocaleString(locale)}`;
}

interface CardMeta { flag: string; label: string; locale: string; currency: string }

const CARD_META: Record<Exclude<CountryContext, 'Other'>, CardMeta> = {
  India:        { flag: '🇮🇳', label: 'India rates',         locale: 'en-IN', currency: '₹' },
  UAE:          { flag: '🇦🇪', label: 'UAE rates',           locale: 'en-US', currency: 'AED' },
  SaudiArabia:  { flag: '🇸🇦', label: 'Saudi Arabia rates',  locale: 'en-US', currency: 'SAR' },
  Qatar:        { flag: '🇶🇦', label: 'Qatar rates',         locale: 'en-US', currency: 'QAR' },
  USA:          { flag: '🇺🇸', label: 'USA rates',           locale: 'en-US', currency: '$' },
  UK:           { flag: '🇬🇧', label: 'UK rates',            locale: 'en-GB', currency: '£' },
  Singapore:    { flag: '🇸🇬', label: 'Singapore rates',     locale: 'en-US', currency: 'S$' },
  Malaysia:     { flag: '🇲🇾', label: 'Malaysia rates',      locale: 'en-US', currency: 'RM' },
  Australia:    { flag: '🇦🇺', label: 'Australia rates',     locale: 'en-US', currency: 'A$' },
  SouthAfrica:  { flag: '🇿🇦', label: 'South Africa rates',  locale: 'en-US', currency: 'R' },
};

function buildFareOptions(distanceKm: number, durationMin: number, ctx: CountryContext): FareOption[] {
  const rows: FareOption[] = [];
  const km = Math.max(distanceKm, 0.1);
  const eta = Math.max(round(durationMin), 1);
  const busEta = `~${round(eta * 1.6)} min`;

  if (ctx === 'Other') {
    rows.push({ mode: 'Taxi / Cab (metered)', icon: '🚕', fareLabel: `~${km.toFixed(1)} km — check local meter/app`, etaLabel: `~${eta} min`, note: 'No local rate card for this country yet — verify against the receipt' });
    rows.push({ mode: 'Public Transit', icon: '🚌', fareLabel: 'See Google Maps for live transit options & fares', etaLabel: 'varies', note: 'Open in Google Maps below for exact lines/pricing' });
    return rows;
  }

  const { locale, currency: c } = CARD_META[ctx];
  const money = (n: number, lo: number, hi: number) => `${c} ${fmtRange(n, lo, hi, locale)}`;

  switch (ctx) {
    case 'India': {
      const auto = 30 + 15 * km;
      rows.push({ mode: 'Auto Rickshaw', icon: '🛺', fareLabel: money(auto, 0.85, 1.15), etaLabel: `~${eta} min`, note: 'Metered / local rate' });
      const cab = 50 + 18 * km;
      rows.push({ mode: 'Cab / Taxi', icon: '🚕', fareLabel: money(cab, 0.85, 1.15), etaLabel: `~${eta} min` });
      const uber = 45 + 12 * km + 1.5 * eta;
      rows.push({ mode: 'Uber Go', icon: '🚗', fareLabel: money(uber, 0.85, 1.25), etaLabel: `~${eta} min`, note: 'Estimated — check app for live/surge pricing' });
      const ola = 40 + 11 * km + 1.5 * eta;
      rows.push({ mode: 'Ola Mini', icon: '🚙', fareLabel: money(ola, 0.85, 1.25), etaLabel: `~${eta} min`, note: 'Estimated — check app for live/surge pricing' });
      if (km >= 1.5) {
        const metro = km < 5 ? 20 : km < 12 ? 35 : km < 25 ? 50 : 60;
        rows.push({ mode: 'Metro / Local Train', icon: '🚇', fareLabel: `₹${metro} approx`, etaLabel: 'varies', note: 'Only where metro/rail coverage exists — verify line' });
      }
      const bus = km < 5 ? 15 : km < 15 ? 25 : 40;
      rows.push({ mode: 'Public Bus', icon: '🚌', fareLabel: `₹${bus} approx`, etaLabel: busEta });
      break;
    }
    case 'UAE': {
      const taxi = Math.max(12, 5 + 1.82 * km);
      rows.push({ mode: 'Taxi (RTA metered)', icon: '🚕', fareLabel: money(taxi, 0.9, 1.15), etaLabel: `~${eta} min` });
      const rideshare = Math.max(10, 5 + 1.6 * km);
      rows.push({ mode: 'Careem / Uber', icon: '🚗', fareLabel: money(rideshare, 0.85, 1.2), etaLabel: `~${eta} min`, note: 'Estimated — check app for live pricing' });
      rows.push({ mode: 'Dubai Metro', icon: '🚇', fareLabel: 'AED 3 – 8.5 (zone based)', etaLabel: 'varies', note: 'Only if both points are near a Metro station' });
      rows.push({ mode: 'Public Bus (RTA)', icon: '🚌', fareLabel: 'AED 3 – 5', etaLabel: busEta });
      break;
    }
    case 'SaudiArabia': {
      const taxi = Math.max(10, 5 + 2.0 * km);
      rows.push({ mode: 'Taxi (metered)', icon: '🚕', fareLabel: money(taxi, 0.9, 1.2), etaLabel: `~${eta} min` });
      const rideshare = Math.max(10, 5 + 1.5 * km + 0.25 * eta);
      rows.push({ mode: 'Careem / Uber', icon: '🚗', fareLabel: money(rideshare, 0.85, 1.2), etaLabel: `~${eta} min`, note: 'Estimated — check app for live pricing' });
      rows.push({ mode: 'Riyadh Metro / SAPTCO Bus', icon: '🚇', fareLabel: 'SAR 4 – 8 (where available)', etaLabel: 'varies', note: 'Metro network limited to Riyadh — verify coverage' });
      break;
    }
    case 'Qatar': {
      const taxi = Math.max(10, 4 + 1.5 * km);
      rows.push({ mode: 'Karwa Taxi (metered)', icon: '🚕', fareLabel: money(taxi, 0.9, 1.15), etaLabel: `~${eta} min` });
      const rideshare = Math.max(10, 5 + 1.3 * km);
      rows.push({ mode: 'Careem / Uber', icon: '🚗', fareLabel: money(rideshare, 0.85, 1.2), etaLabel: `~${eta} min`, note: 'Estimated — check app for live pricing' });
      rows.push({ mode: 'Doha Metro', icon: '🚇', fareLabel: 'QAR 2 – 6 (zone based)', etaLabel: 'varies', note: 'Only if both points are near a Metro station' });
      rows.push({ mode: 'Karwa Bus', icon: '🚌', fareLabel: 'QAR 2 – 3', etaLabel: busEta });
      break;
    }
    case 'USA': {
      const taxi = 3.5 + 2.2 * km;
      rows.push({ mode: 'Taxi (metered)', icon: '🚕', fareLabel: money(taxi, 0.9, 1.3), etaLabel: `~${eta} min`, note: 'Metered rate varies significantly by city' });
      const rideshare = 3 + 1.5 * km + 0.3 * eta;
      rows.push({ mode: 'Uber / Lyft', icon: '🚗', fareLabel: money(rideshare, 0.8, 1.4), etaLabel: `~${eta} min`, note: 'Estimated — surge pricing can push this higher' });
      rows.push({ mode: 'Bus / Subway', icon: '🚌', fareLabel: '$2.5 – 3 flat (typical city transit)', etaLabel: busEta, note: 'Flat fare in most metro systems (e.g. NYC MTA)' });
      break;
    }
    case 'UK': {
      const taxi = 3.5 + 1.5 * km;
      rows.push({ mode: 'Taxi / Black Cab', icon: '🚕', fareLabel: money(taxi, 0.9, 1.3), etaLabel: `~${eta} min`, note: 'London black-cab tariff is higher at peak/night' });
      const rideshare = 2.5 + 1.25 * km + 0.15 * eta;
      rows.push({ mode: 'Uber', icon: '🚗', fareLabel: money(rideshare, 0.8, 1.3), etaLabel: `~${eta} min`, note: 'Estimated — check app for live/surge pricing' });
      rows.push({ mode: 'Bus', icon: '🚌', fareLabel: '£1.75 – 2 flat', etaLabel: busEta });
      rows.push({ mode: 'Underground / Rail', icon: '🚇', fareLabel: '£2.80 – 6.60 (zone based)', etaLabel: 'varies', note: 'London Underground zonal pricing — other cities vary' });
      break;
    }
    case 'Singapore': {
      const taxi = 4 + 0.65 * km;
      rows.push({ mode: 'Taxi (metered)', icon: '🚕', fareLabel: money(taxi, 0.9, 1.3), etaLabel: `~${eta} min`, note: 'Peak-hour & booking surcharges apply' });
      const grab = 5 + 0.7 * km + 0.15 * eta;
      rows.push({ mode: 'Grab', icon: '🚗', fareLabel: money(grab, 0.85, 1.3), etaLabel: `~${eta} min`, note: 'Estimated — check app for live/surge pricing' });
      rows.push({ mode: 'MRT / Bus', icon: '🚇', fareLabel: 'S$1.20 – 2.50 (distance based)', etaLabel: busEta });
      break;
    }
    case 'Malaysia': {
      const taxi = 3 + 1.0 * km;
      rows.push({ mode: 'Taxi (metered)', icon: '🚕', fareLabel: money(taxi, 0.85, 1.2), etaLabel: `~${eta} min` });
      const grab = 5 + 1.0 * km + 0.2 * eta;
      rows.push({ mode: 'Grab', icon: '🚗', fareLabel: money(grab, 0.85, 1.3), etaLabel: `~${eta} min`, note: 'Estimated — check app for live/surge pricing' });
      rows.push({ mode: 'LRT / MRT', icon: '🚇', fareLabel: 'RM 1 – 5 (distance based)', etaLabel: 'varies', note: 'Only where rail coverage exists near both points' });
      rows.push({ mode: 'RapidKL Bus', icon: '🚌', fareLabel: 'RM 1 – 5', etaLabel: busEta });
      break;
    }
    case 'Australia': {
      const taxi = 4.2 + 2.3 * km;
      rows.push({ mode: 'Taxi (metered)', icon: '🚕', fareLabel: money(taxi, 0.9, 1.25), etaLabel: `~${eta} min` });
      const rideshare = 3 + 1.5 * km + 0.35 * eta;
      rows.push({ mode: 'Uber / Didi', icon: '🚗', fareLabel: money(rideshare, 0.8, 1.3), etaLabel: `~${eta} min`, note: 'Estimated — check app for live/surge pricing' });
      rows.push({ mode: 'Train / Bus', icon: '🚇', fareLabel: 'A$3 – 5 (zone/distance based)', etaLabel: busEta });
      break;
    }
    case 'SouthAfrica': {
      const rideshare = 25 + 8 * km + 1.5 * eta;
      rows.push({ mode: 'Uber / Bolt', icon: '🚗', fareLabel: money(rideshare, 0.8, 1.3), etaLabel: `~${eta} min`, note: 'Metered street taxis are rare — rideshare is the norm' });
      rows.push({ mode: 'Minibus Taxi', icon: '🚐', fareLabel: 'R10 – 25 (route based)', etaLabel: busEta, note: 'Informal shared transit — fixed per-route fares' });
      break;
    }
  }

  return rows;
}

export async function estimateRoute(from: string, to: string): Promise<RouteEstimate | null> {
  if (!from?.trim() || !to?.trim()) return null;
  const hint = guessCountryHint(from, to);
  // Sequential, not Promise.all: keeps Nominatim calls from bursting in parallel, and lets a
  // successfully-resolved origin bias the (harder) destination geocode — or vice versa.
  const origin = await geocode(from, hint);
  const destination = await geocode(to, hint, origin ?? undefined);
  if (!origin || !destination) return null;

  const road = await getRoadRoute(origin, destination);
  const distanceKm = road?.distanceKm ?? 0;
  const durationMin = road?.durationMin ?? 0;
  const countryContext = detectCountryContext(from, to, origin, destination);
  const contextLabel = countryContext === 'Other' ? '🌐 Generic estimate' : `${CARD_META[countryContext].flag} ${CARD_META[countryContext].label}`;

  return {
    origin,
    destination,
    distanceKm,
    durationMin,
    countryContext,
    contextLabel,
    fareOptions: buildFareOptions(distanceKm, durationMin, countryContext),
    mapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`,
    embedUrl: `https://www.google.com/maps?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}&output=embed`,
  };
}
