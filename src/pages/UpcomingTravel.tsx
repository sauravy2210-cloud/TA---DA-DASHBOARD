import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plane, Train, Bus, Car, MapPin, Calendar, Clock,
  ChevronRight, Search, Filter, Loader2, AlertCircle,
  CheckCircle2, ExternalLink, X, FileText, Shield,
  RefreshCw,
} from 'lucide-react';
import type { User as UserType } from '../types';

// ── API response shape (apikey=256) ──────────────────────────────────────────

interface FlightRecord {
  trip_ID: number | null;
  flight_number: string | null;
  from_city: string | null;
  to_city: string | null;
  departure_date: string | null;
  departure_time: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  connecting_flight_id: number | null;
  Is_cancelled: string | null;
  ticket_path: string | null;
  insurance_path: string | null;
  airlines_name: string | null;
  transport_type: string | null;
  [key: string]: unknown;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
};

function parseDate(raw: string | null): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mon = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (mon) {
    const [, dd, m, yyyy] = mon;
    const mm = MONTH_MAP[m] ?? MONTH_MAP[m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  const sl = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (sl) return `${sl[3]}-${sl[2]}-${sl[1]}`;
  return s.slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dep = new Date(iso + 'T00:00:00');
  return Math.ceil((dep.getTime() - today.getTime()) / 86400000);
}

function daysLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `in ${days} days`;
}

function buildUrl(path: string | null): string | null {
  if (!path) return null;
  const s = String(path).trim();
  if (s.startsWith('http')) return s;
  return `https://api.koenig-solutions.com${s.startsWith('/') ? '' : '/'}${s}`;
}

// ── Transport type helpers ────────────────────────────────────────────────────

function transportIcon(type: string | null) {
  const t = (type ?? '').toLowerCase();
  if (t.includes('train'))  return <Train size={15} />;
  if (t.includes('bus'))    return <Bus size={15} />;
  if (t.includes('cab') || t.includes('car')) return <Car size={15} />;
  return <Plane size={15} />;
}

function transportColor(type: string | null): string {
  const t = (type ?? '').toLowerCase();
  if (t.includes('train'))  return 'bg-green-100 text-green-700';
  if (t.includes('bus'))    return 'bg-orange-100 text-orange-700';
  if (t.includes('cab') || t.includes('car')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
}

// ── API fetch ─────────────────────────────────────────────────────────────────

async function fetchUpcomingTravel(empCode: string): Promise<FlightRecord[]> {
  const tokenRes = await fetch('/koenig-api/api/Kites/Operator/GetToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName: 'Saurav_GetTrainerFligh',
      userPassword: 'g$z2pVJR2Tde',
      userRole: 'Get Trainer Flight & Travel Details',
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token request failed: HTTP ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  if (tokenData.statuscode !== 200) throw new Error(tokenData.message || 'Token fetch failed');
  const { accessToken, deviceToken } = tokenData.content;

  const empCodeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode;
  const url =
    `/koenig-api/api/Kites/Operator/common` +
    `?apikey=256` +
    `&accessToken=${encodeURIComponent(accessToken)}` +
    `&deviceToken=${encodeURIComponent(deviceToken)}`;

  const dataRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ koenig_trainer_emp_code: empCodeValue }),
  });
  if (!dataRes.ok) throw new Error(`Travel request failed: HTTP ${dataRes.status}`);
  const data = await dataRes.json();
  if (data.statuscode !== 200) throw new Error(data.message || 'Travel fetch failed');

  let raw = data.content;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
  if (!Array.isArray(raw)) return [];

  console.log('[API 256 / UpcomingTravel] total records:', raw.length);
  return raw;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpcomingTravel({ currentUser }: { currentUser: UserType }) {
  const navigate = useNavigate();
  const empCode = (currentUser?.trainerId ?? '').replace(/^EMP-/i, '').trim();

  const [records, setRecords]     = useState<FlightRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const today = todayISO();

  const load = useCallback(async () => {
    if (!empCode) { setError('No employee code found. Please log in again.'); return; }
    setLoading(true); setError(''); setRecords([]);
    try {
      const all = await fetchUpcomingTravel(empCode);
      // Keep only non-cancelled records with departure_date >= today, sorted nearest first
      const upcoming = all
        .filter(r => {
          if (r.Is_cancelled === 'Yes') return false;
          const dep = parseDate(r.departure_date);
          return dep >= today;
        })
        .sort((a, b) => parseDate(a.departure_date).localeCompare(parseDate(b.departure_date)));
      setRecords(upcoming);
      if (all.length > 0 && upcoming.length === 0) {
        setError(`${all.length} travel record(s) found in PMS but none are upcoming (all are past or cancelled).`);
      }
    } catch (e) {
      setError((e as Error).message || 'Failed to fetch travel data');
    } finally {
      setLoading(false);
    }
  }, [empCode, today]);

  useEffect(() => { load(); }, [load]);

  // ── Derived filter options ──
  const typeOptions = ['All', ...Array.from(new Set(records.map(r => r.transport_type ?? 'Flight').filter(Boolean)))];

  const filtered = records.filter(r => {
    const dep   = parseDate(r.departure_date);
    const type  = (r.transport_type ?? 'Flight').toLowerCase();
    const q     = search.toLowerCase();
    const matchSearch =
      !q ||
      (r.from_city ?? '').toLowerCase().includes(q) ||
      (r.to_city ?? '').toLowerCase().includes(q) ||
      (r.airlines_name ?? '').toLowerCase().includes(q) ||
      (r.flight_number ?? '').toLowerCase().includes(q) ||
      String(r.trip_ID ?? '').includes(q) ||
      dep.includes(q);
    const matchType = typeFilter === 'All' || type.includes(typeFilter.toLowerCase());
    return matchSearch && matchType;
  });

  // Summary stats from full records (not filtered)
  const nextDep = records.length > 0 ? parseDate(records[0].departure_date) : null;
  const nextDays = nextDep ? daysUntil(nextDep) : null;
  const flightCount = records.filter(r => !(r.transport_type ?? '').toLowerCase().includes('train') && !(r.transport_type ?? '').toLowerCase().includes('bus')).length;
  const withTicket = records.filter(r => !!r.ticket_path).length;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Plane size={20} className="text-blue-500" />
            Upcoming Travel
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Travel booked in Koenig PMS for EMP-<span className="font-mono">{empCode}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-blue-600 gap-3">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm font-medium">Fetching travel from Koenig PMS…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-2 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Upcoming Trips',  value: records.length,   color: 'bg-blue-50 text-blue-700 border border-blue-100',   sub: 'from today onwards' },
            { label: 'Next Departure',  value: nextDays !== null ? daysLabel(nextDays) : '—', color: 'bg-purple-50 text-purple-700 border border-purple-100', sub: nextDep ? fmtDate(nextDep) : '' },
            { label: 'Flights / Air',   value: flightCount,      color: 'bg-teal-50 text-teal-700 border border-teal-100',   sub: `${records.length - flightCount} other mode(s)` },
            { label: 'With Ticket',     value: withTicket,       color: 'bg-green-50 text-green-700 border border-green-100', sub: `${records.length - withTicket} pending` },
          ].map(c => (
            <div key={c.label} className={`rounded-xl px-4 py-3 ${c.color}`}>
              <p className="text-xs font-medium opacity-70">{c.label}</p>
              <p className="text-xl font-bold mt-0.5">{c.value}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {!loading && records.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by city, airline, flight no, trip ID…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white"
            >
              {typeOptions.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* No results after filter */}
      {!loading && records.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Search size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No records match your search / filter.</p>
          <button type="button" onClick={() => { setSearch(''); setTypeFilter('All'); }}
            className="mt-2 text-xs text-blue-500 underline">Clear filters</button>
        </div>
      )}

      {/* Empty state — no upcoming at all */}
      {!loading && !error && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
          <Plane size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No upcoming travel found</p>
          <p className="text-xs mt-1 opacity-70">Travel booked in Koenig PMS will appear here automatically</p>
          <p className="text-xs mt-1 opacity-50">EMP-{empCode}</p>
        </div>
      )}

      {/* Travel cards */}
      <div className="space-y-3">
        {filtered.map((r, idx) => {
          const key       = String(r.trip_ID ?? `${r.flight_number ?? idx}-${parseDate(r.departure_date)}`);
          const isExpanded = expanded === key;
          const depDate   = parseDate(r.departure_date);
          const arrDate   = parseDate(r.arrival_date);
          const days      = depDate ? daysUntil(depDate) : null;
          const type      = r.transport_type ?? 'Flight';
          const ticketUrl = buildUrl(r.ticket_path);
          const insureUrl = buildUrl(r.insurance_path);
          const isUrgent  = days !== null && days <= 3;

          return (
            <div key={key}
              className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${isUrgent ? 'border-amber-300' : 'border-gray-200'}`}
            >
              {/* Urgency ribbon */}
              {isUrgent && days !== null && (
                <div className="px-4 py-1 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                  <Clock size={11} />
                  {daysLabel(days)} — departure is near
                </div>
              )}

              {/* Card header (always visible) */}
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : key)}
                className="w-full text-left px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Transport icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${transportColor(r.transport_type)}`}>
                      {transportIcon(r.transport_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Route */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">
                          {r.from_city ?? '?'} → {r.to_city ?? '?'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${transportColor(r.transport_type)}`}>
                          {type}
                        </span>
                        {r.airlines_name && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                            {r.airlines_name}
                          </span>
                        )}
                        {r.flight_number && (
                          <span className="text-xs text-gray-400 font-mono">{r.flight_number}</span>
                        )}
                      </div>
                      {/* Departure row */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          <span className="font-medium text-gray-700">{depDate ? fmtDate(depDate) : '—'}</span>
                          {r.departure_time && <span className="text-gray-400">{fmtTime(r.departure_time)}</span>}
                        </span>
                        {arrDate && (
                          <span className="flex items-center gap-1">
                            <span className="text-gray-300">→</span>
                            <span>{fmtDate(arrDate)}</span>
                            {r.arrival_time && <span className="text-gray-400">{fmtTime(r.arrival_time)}</span>}
                          </span>
                        )}
                        {days !== null && (
                          <span className={`flex items-center gap-1 font-medium ${
                            days <= 1 ? 'text-red-500' : days <= 3 ? 'text-amber-600' : 'text-blue-500'
                          }`}>
                            <Clock size={11} /> {daysLabel(days)}
                          </span>
                        )}
                      </div>
                      {/* Document pills */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {ticketUrl
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold"><CheckCircle2 size={9} /> Ticket</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px]"><X size={9} /> No Ticket</span>}
                        {insureUrl
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold"><CheckCircle2 size={9} /> Insurance</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px]"><X size={9} /> No Insurance</span>}
                        {r.trip_ID != null && (
                          <span className="text-[10px] text-gray-400 font-mono">Trip #{r.trip_ID}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`flex-shrink-0 text-gray-400 mt-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Trip ID</p>
                      <p className="text-sm font-mono font-medium text-gray-700">{r.trip_ID ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Transport Type</p>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        {transportIcon(r.transport_type)} {type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Airline / Carrier</p>
                      <p className="text-sm font-medium text-gray-700">{r.airlines_name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Flight Number</p>
                      <p className="text-sm font-mono font-medium text-gray-700">{r.flight_number ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Departure</p>
                      <p className="text-sm font-medium text-gray-700">
                        {depDate ? fmtDate(depDate) : '—'}
                        {r.departure_time && <span className="ml-1 text-gray-500 font-normal">{fmtTime(r.departure_time)}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Arrival</p>
                      <p className="text-sm font-medium text-gray-700">
                        {arrDate ? fmtDate(arrDate) : '—'}
                        {r.arrival_time && <span className="ml-1 text-gray-500 font-normal">{fmtTime(r.arrival_time)}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">From</p>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1"><MapPin size={11} className="text-gray-400" />{r.from_city ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">To</p>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1"><MapPin size={11} className="text-blue-400" />{r.to_city ?? '—'}</p>
                    </div>
                    {r.connecting_flight_id != null && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Connecting Flight</p>
                        <p className="text-sm font-mono font-medium text-gray-700">#{r.connecting_flight_id}</p>
                      </div>
                    )}
                  </div>

                  {/* Documents */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ticketUrl
                      ? <a href={ticketUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
                          <FileText size={12} /> View Ticket
                          <ExternalLink size={10} />
                        </a>
                      : <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 text-xs">
                          <FileText size={12} /> Ticket not available
                        </span>}
                    {insureUrl
                      ? <a href={insureUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors">
                          <Shield size={12} /> View Insurance
                          <ExternalLink size={10} />
                        </a>
                      : <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 text-xs">
                          <Shield size={12} /> Insurance not available
                        </span>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => navigate('/claims/new')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Create TA/DA Bill <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
