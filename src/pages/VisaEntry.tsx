import { useState, useEffect, useRef } from 'react';
import type { User } from '../types';

// All currencies the app can actually convert to INR (matches lib/currencyRates.ts's
// FALLBACK_RATES) — keeping this list in sync with that one so every option here always has a
// real conversion rate, live or offline, rather than just decoration in the dropdown.
const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'INR', label: 'INR ₹' },
  { code: 'USD', label: 'USD' },
  { code: 'AED', label: 'AED' },
  { code: 'EUR', label: 'EUR' },
  { code: 'GBP', label: 'GBP' },
  { code: 'SGD', label: 'SGD' },
  { code: 'AUD', label: 'AUD' },
  { code: 'CAD', label: 'CAD' },
  { code: 'JPY', label: 'JPY' },
  { code: 'SAR', label: 'SAR' },
  { code: 'QAR', label: 'QAR' },
  { code: 'KWD', label: 'KWD' },
  { code: 'BHD', label: 'BHD' },
  { code: 'OMR', label: 'OMR' },
  { code: 'MYR', label: 'MYR' },
  { code: 'THB', label: 'THB' },
  { code: 'ZAR', label: 'ZAR' },
  { code: 'NPR', label: 'NPR' },
  { code: 'BDT', label: 'BDT' },
  { code: 'LKR', label: 'LKR' },
];

// ── Location autocomplete (OpenStreetMap Nominatim via the app's existing /api/turso?type=geo
// proxy — no Google Maps API key configured in this project). Deliberately a self-contained
// copy rather than importing CreateTADABill.tsx's internal component, per the instruction to
// keep this page independent of the bill-creation flow. ─────────────────────────────────────
interface LocSuggestion { display_name: string; lat: string; lon: string; }

function LocationAutocomplete({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<LocSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInput(v: string) {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/turso?type=geo&q=${encodeURIComponent(v)}`);
        const json = await res.json();
        const data: LocSuggestion[] = (json.results || []).map((r: { lat: number; lon: number; display_name: string }) => ({
          display_name: r.display_name, lat: String(r.lat), lon: String(r.lon),
        }));
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 350);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 pr-7"
          placeholder={placeholder ?? 'Search location…'}
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && <span className="absolute right-2.5 top-2.5 text-[10px] text-blue-400 animate-pulse">…</span>}
        {!loading && value && (
          <button type="button" onClick={() => { onChange(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-start gap-2"
              onMouseDown={() => {
                onChange(s.display_name);
                setSuggestions([]);
                setOpen(false);
              }}
            >
              <span className="text-blue-500 flex-shrink-0">📍</span>
              <span className="line-clamp-2 text-gray-700">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Self-contained flight fetch (mirrors CreateTADABill.tsx's fetchTrainerFlights) ──────────
// Deliberately duplicated rather than imported — this page must stay fully independent of the
// bill-creation flow / Select Date Range page per explicit instruction.
interface FlightRecord {
  trip_ID?: number;
  flight_number: string | null;
  from_city: string | null;
  to_city: string | null;
  departure_date: string | null;
  departure_time: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  Is_cancelled: string | null;
  airlines_name: string | null;
  transport_type: string | null;
  [key: string]: unknown;
}

async function fetchTrainerFlights(empCode: string, email?: string): Promise<FlightRecord[]> {
  const clean = empCode.replace(/^EMP-/i, '').trim();
  const params = new URLSearchParams({ empCode: clean });
  if (email) params.set('email', email);
  const res = await fetch(`/api/flights?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Flights fetch HTTP ${res.status}`);
  return Array.isArray(data.flights) ? data.flights : [];
}

function parseDT(dt: string | null): string {
  if (!dt) return '';
  return dt.trim().slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface TravelExpenseEntry {
  id: string;
  date: string;
  travelType: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  receiptData?: string;
  receiptName?: string;
  submitted?: boolean; // false = staged locally, not yet sent to HR Admin
}

interface MiscExpenseEntry {
  id: string;
  date: string;
  expenseType: string;
  amount: number;
  currency: string;
  remarks: string;
  receiptData?: string;
  receiptName?: string;
  submitted?: boolean; // false = staged locally, not yet sent to HR Admin
}

// Shape persisted to /api/turso?type=visa — visible to HR Admin under "Visa Fees Submission".
interface VisaDbRecord {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  entryType: 'travel' | 'misc';
  submittedAt: string;
  fromDate: string;
  toDate: string;
  data: TravelExpenseEntry | MiscExpenseEntry;
}

interface VisaEntryProps {
  currentUser: User;
}

export default function VisaEntry({ currentUser }: VisaEntryProps) {
  const empCode = (currentUser?.trainerId ?? '').replace(/^EMP-/i, '').trim();
  const email = currentUser?.email ?? '';
  const trainerName = currentUser?.name ?? '';

  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState('');

  // Load this trainer's previously saved entries from the database on mount.
  useEffect(() => {
    if (!empCode) return;
    setEntriesLoading(true);
    setEntriesError('');
    fetch(`/api/turso?type=visa&empCode=${encodeURIComponent(empCode)}`)
      .then(r => r.json())
      .then(d => {
        const all: VisaDbRecord[] = Array.isArray(d.entries) ? d.entries : [];
        setTravelEntries(all.filter(e => e.entryType === 'travel').map(e => ({ ...(e.data as TravelExpenseEntry), submitted: true })));
        setMiscEntries(all.filter(e => e.entryType === 'misc').map(e => ({ ...(e.data as MiscExpenseEntry), submitted: true })));
      })
      .catch(err => setEntriesError(err instanceof Error ? err.message : 'Failed to load saved entries'))
      .finally(() => setEntriesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empCode]);

  // ── Date range ──────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Flight details (fetched from PMS, read-only) ───────────────────────────
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState('');
  const [flightsFetched, setFlightsFetched] = useState(false);

  async function fetchFlights() {
    if (!empCode) { setFlightsError('No employee code found for this login.'); return; }
    setFlightsLoading(true);
    setFlightsError('');
    try {
      const raw = await fetchTrainerFlights(empCode, email);
      setFlights(raw);
      setFlightsFetched(true);
    } catch (err) {
      setFlightsError(err instanceof Error ? err.message : 'Failed to fetch flights');
    } finally {
      setFlightsLoading(false);
    }
  }

  const visibleFlights = flights.filter(f => {
    const d = parseDT(f.departure_date);
    if (!d) return false;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  // ── Travel expense — persisted to the database so HR Admin can see it under
  // "Visa Fees Submission" ────────────────────────────────────────────────────
  const [travelEntries, setTravelEntries] = useState<TravelExpenseEntry[]>([]);
  const [travelDraft, setTravelDraft] = useState<Omit<TravelExpenseEntry, 'id'>>({
    date: '', travelType: 'Cab', from: '', to: '', amount: 0, currency: 'INR',
  });

  async function deleteVisaRecord(id: string) {
    await fetch(`/api/turso?type=visa&id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }

  // "Add" only stages an entry locally — it does NOT reach HR Admin yet. Only the
  // "Submit Visa Fees Entry" button (below) actually sends staged entries to the database.
  // Bug fixed 2026-08-10: the button silently did nothing when a required field was missing
  // (most commonly Amount, since a blank/invalid number input parses to 0 and looks filled in),
  // leaving trainers with zero staged entries and a permanently-disabled Submit button with no
  // explanation. Now shows exactly what's missing instead of failing silently.
  const [travelAddError, setTravelAddError] = useState('');
  function addTravelEntry() {
    const missing: string[] = [];
    if (!travelDraft.date) missing.push('Date');
    if (!travelDraft.from) missing.push('From Location');
    if (!travelDraft.to) missing.push('To Location');
    if (!travelDraft.amount) missing.push('Amount (must be greater than 0)');
    if (!travelDraft.receiptData) missing.push('Receipt');
    if (missing.length > 0) {
      setTravelAddError(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    setTravelAddError('');
    const entry: TravelExpenseEntry = { ...travelDraft, id: `TRV-${Date.now()}`, submitted: false };
    setTravelEntries([entry, ...travelEntries]);
    setTravelDraft({ date: '', travelType: 'Cab', from: '', to: '', amount: 0, currency: 'INR' });
  }

  function removeTravelEntry(id: string) {
    const entry = travelEntries.find(e => e.id === id);
    setTravelEntries(travelEntries.filter(e => e.id !== id));
    if (entry?.submitted) deleteVisaRecord(id);
  }

  // ── Misc expense — staged locally until "Submit Visa Fees Entry" is clicked ───────────────
  const [miscEntries, setMiscEntries] = useState<MiscExpenseEntry[]>([]);
  const [miscDraft, setMiscDraft] = useState<Omit<MiscExpenseEntry, 'id'>>({
    date: '', expenseType: 'Other', amount: 0, currency: 'INR', remarks: '',
  });

  const [miscAddError, setMiscAddError] = useState('');
  function addMiscEntry() {
    const missing: string[] = [];
    if (!miscDraft.date) missing.push('Date');
    if (!miscDraft.amount) missing.push('Amount (must be greater than 0)');
    if (!miscDraft.receiptData) missing.push('Receipt');
    if (missing.length > 0) {
      setMiscAddError(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    setMiscAddError('');
    const entry: MiscExpenseEntry = { ...miscDraft, id: `MISC-${Date.now()}`, submitted: false };
    setMiscEntries([entry, ...miscEntries]);
    setMiscDraft({ date: '', expenseType: 'Other', amount: 0, currency: 'INR', remarks: '' });
  }

  function removeMiscEntry(id: string) {
    const entry = miscEntries.find(e => e.id === id);
    setMiscEntries(miscEntries.filter(e => e.id !== id));
    if (entry?.submitted) deleteVisaRecord(id);
  }

  // ── Submit staged entries to HR Admin ──────────────────────────────────────
  const pendingCount = travelEntries.filter(e => !e.submitted).length + miscEntries.filter(e => !e.submitted).length;
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  // Upload a receipt to Vercel Blob and swap the base64 for the returned URL — keeps the
  // `visa` table row small (raw base64 was bloating Turso storage and the bandwidth HR
  // Admin's dashboard uses fetching this table on every load). Falls back to the base64
  // itself if the upload fails, so nothing is lost.
  async function uploadReceiptIfNeeded<T extends { receiptData?: string; receiptName?: string; id: string }>(entry: T): Promise<T> {
    if (!entry.receiptData || !entry.receiptData.startsWith('data:')) return entry;
    try {
      const contentType = entry.receiptData.match(/^data:([^;]+);/)?.[1] ?? 'application/octet-stream';
      const r = await fetch('/api/turso?type=upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: entry.receiptData, filename: entry.receiptName || entry.id, contentType }),
      });
      if (r.ok) {
        const { url } = await r.json() as { url?: string };
        if (url) return { ...entry, receiptData: url };
      }
    } catch { /* keep base64 as fallback */ }
    return entry;
  }

  async function submitVisaFeesEntry() {
    if (pendingCount === 0) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const pendingTravel = await Promise.all(travelEntries.filter(e => !e.submitted).map(uploadReceiptIfNeeded));
      const pendingMisc = await Promise.all(miscEntries.filter(e => !e.submitted).map(uploadReceiptIfNeeded));
      const submittedAt = new Date().toISOString();

      const requests = [
        ...pendingTravel.map(entry => {
          const record: VisaDbRecord = {
            id: entry.id, trainerId: empCode, trainerName, trainerEmail: email,
            entryType: 'travel', submittedAt, fromDate, toDate, data: entry,
          };
          return fetch('/api/turso?type=visa', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
          });
        }),
        ...pendingMisc.map(entry => {
          const record: VisaDbRecord = {
            id: entry.id, trainerId: empCode, trainerName, trainerEmail: email,
            entryType: 'misc', submittedAt, fromDate, toDate, data: entry,
          };
          return fetch('/api/turso?type=visa', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
          });
        }),
      ];

      const results = await Promise.all(requests);
      if (results.some(r => !r.ok)) throw new Error('Some entries failed to save');

      setTravelEntries(travelEntries.map(e => (e.submitted ? e : { ...e, submitted: true })));
      setMiscEntries(miscEntries.map(e => (e.submitted ? e : { ...e, submitted: true })));
      setSubmitMsg('✅ Submitted to HR Admin');
    } catch (err) {
      setSubmitMsg(`❌ ${err instanceof Error ? err.message : 'Submit failed'}`);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMsg(''), 6000);
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelCls = 'block text-xs text-gray-500 mb-1 font-semibold';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Visa Fees Entry</h1>
        <p className="text-sm text-gray-500">
          A log for a visa-related trip — date range, flight details, travel expenses, and
          miscellaneous expenses. This is not a DA calculation. Entries you add here are visible
          to HR Admin under Visa Fees Submission.
        </p>
        {entriesLoading && <p className="text-xs text-gray-400 mt-1">Loading your saved entries…</p>}
        {entriesError && <p className="text-xs text-red-600 mt-1">{entriesError}</p>}
      </div>

      {/* ── Date Range ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Select Date Range</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── Flight Details ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Flight Details</h2>
          <button
            onClick={fetchFlights}
            disabled={flightsLoading}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {flightsLoading ? 'Fetching…' : 'Fetch Flight Details'}
          </button>
        </div>
        {flightsError && <p className="text-xs text-red-600 mb-3">{flightsError}</p>}
        {!flightsFetched ? (
          <p className="text-sm text-gray-400">Click "Fetch Flight Details" to load flights from PMS.</p>
        ) : visibleFlights.length === 0 ? (
          <p className="text-sm text-gray-400">No flights found{fromDate || toDate ? ' for the selected date range' : ''}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Flight No.', 'Airline', 'From', 'To', 'Departure', 'Arrival', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleFlights.map((f, i) => (
                  <tr key={i} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2 whitespace-nowrap">{f.flight_number || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.airlines_name || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.from_city || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.to_city || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(parseDT(f.departure_date))} {(f.departure_time || '').substring(0, 5)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(parseDT(f.arrival_date))} {(f.arrival_time || '').substring(0, 5)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {f.Is_cancelled === 'Yes'
                        ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">Cancelled</span>
                        : <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">Active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Travel Expense ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Travel Expense</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={travelDraft.date} onChange={e => setTravelDraft(v => ({ ...v, date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Travel Type</label>
            <select value={travelDraft.travelType} onChange={e => setTravelDraft(v => ({ ...v, travelType: e.target.value }))} className={inputCls}>
              <option value="Cab">Cab</option>
              <option value="Metro">Metro</option>
              <option value="Auto">Auto</option>
              <option value="Train">Train</option>
              <option value="Flight">Flight</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            <select value={travelDraft.currency} onChange={e => setTravelDraft(v => ({ ...v, currency: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
              {CURRENCY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
            <input type="number" min={0} value={travelDraft.amount || ''} onChange={e => setTravelDraft(v => ({ ...v, amount: Number(e.target.value) }))} placeholder="Amount" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>From Location</label>
            <LocationAutocomplete value={travelDraft.from} onChange={v => setTravelDraft(d => ({ ...d, from: v }))} placeholder="From" />
          </div>
          <div>
            <label className={labelCls}>To Location</label>
            <LocationAutocomplete value={travelDraft.to} onChange={v => setTravelDraft(d => ({ ...d, to: v }))} placeholder="To" />
          </div>
          <div>
            <label className="block text-xs text-red-600 mb-1 font-semibold">Receipt * (required to add expense)</label>
            <input type="file" accept="image/*,.pdf" onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const data = await fileToBase64(file);
              setTravelDraft(v => ({ ...v, receiptData: data, receiptName: file.name }));
            }} className="w-full text-xs text-gray-500" />
            {travelDraft.receiptName && <p className="text-xs text-green-600 mt-1">✓ {travelDraft.receiptName}</p>}
          </div>
        </div>
        <button
          onClick={addTravelEntry}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          + Add Travel Expense
        </button>
        {travelAddError && <p className="mt-2 text-xs text-red-600 font-medium">{travelAddError}</p>}

        {travelEntries.length > 0 && (
          <div className="mt-5 overflow-x-auto border-t border-gray-100 pt-4">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Type', 'From', 'To', 'Amount', 'Receipt', 'Status', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {travelEntries.map(e => (
                  <tr key={e.id} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.travelType}</td>
                    <td className="px-3 py-2">{e.from}</td>
                    <td className="px-3 py-2">{e.to}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">{e.currency} {e.amount}</td>
                    <td className="px-3 py-2">
                      {e.receiptData
                        ? <a href={e.receiptData} download={e.receiptName || 'receipt'} className="text-blue-600 hover:underline">View</a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.submitted
                        ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">Submitted</span>
                        : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Pending</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeTravelEntry(e.id)} className="text-red-500 hover:text-red-700 font-medium">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Misc Expense ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Miscellaneous Expense</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={miscDraft.date} onChange={e => setMiscDraft(v => ({ ...v, date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Expense Type</label>
            <input type="text" value={miscDraft.expenseType} onChange={e => setMiscDraft(v => ({ ...v, expenseType: e.target.value }))} placeholder="e.g. Visa Fee, Internet, Tips" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <select value={miscDraft.currency} onChange={e => setMiscDraft(v => ({ ...v, currency: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
              {CURRENCY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
            <input type="number" min={0} value={miscDraft.amount || ''} onChange={e => setMiscDraft(v => ({ ...v, amount: Number(e.target.value) }))} placeholder="Amount" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Remarks</label>
            <input type="text" value={miscDraft.remarks} onChange={e => setMiscDraft(v => ({ ...v, remarks: e.target.value }))} placeholder="Brief description" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-red-600 mb-1 font-semibold">Receipt * (required to add expense)</label>
            <input type="file" accept="image/*,.pdf" onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const data = await fileToBase64(file);
              setMiscDraft(v => ({ ...v, receiptData: data, receiptName: file.name }));
            }} className="w-full text-xs text-gray-500" />
            {miscDraft.receiptName && <p className="text-xs text-green-600 mt-1">✓ {miscDraft.receiptName}</p>}
          </div>
        </div>
        <button
          onClick={addMiscEntry}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          + Add Misc Expense
        </button>
        {miscAddError && <p className="mt-2 text-xs text-red-600 font-medium">{miscAddError}</p>}

        {miscEntries.length > 0 && (
          <div className="mt-5 overflow-x-auto border-t border-gray-100 pt-4">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Type', 'Amount', 'Remarks', 'Receipt', 'Status', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {miscEntries.map(e => (
                  <tr key={e.id} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2">{e.expenseType}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">{e.currency} {e.amount}</td>
                    <td className="px-3 py-2">{e.remarks || '—'}</td>
                    <td className="px-3 py-2">
                      {e.receiptData
                        ? <a href={e.receiptData} download={e.receiptName || 'receipt'} className="text-blue-600 hover:underline">View</a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.submitted
                        ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">Submitted</span>
                        : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Pending</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeMiscEntry(e.id)} className="text-red-500 hover:text-red-700 font-medium">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Submit to HR Admin ── */}
      <div className="bg-white border-2 border-blue-200 rounded-xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Submit Visa Fees Entry</p>
          <p className="text-xs text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} pending entr${pendingCount === 1 ? 'y' : 'ies'} will be sent to HR Admin.`
              : 'No pending entries to submit.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {submitMsg && (
            <span className={`text-xs font-medium ${submitMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {submitMsg}
            </span>
          )}
          <button
            onClick={submitVisaFeesEntry}
            disabled={submitting || pendingCount === 0}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : `Submit to HR Admin${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
