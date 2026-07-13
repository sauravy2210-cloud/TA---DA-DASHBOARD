import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveClaim, saveLineItems } from '../services/storageService';
import type { ClaimHeader, ClaimLineItem } from '../types';
import {
  Calendar, MapPin, Hotel, Building2, Ruler, Info,
  Plus, Trash2, Download, Upload, Send, Save,
  CheckCircle2, Loader2, AlertCircle, Search, X,
  Edit3, ChevronDown, ChevronUp, Plane, ExternalLink, DollarSign, MessageSquare,
} from 'lucide-react';
import type { User } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(iso: string) {
  if (!iso) return '—';
  // Parse as LOCAL date (not UTC) to avoid timezone shift in IST
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dayName(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' });
}

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Get Trainer Assignment Details API (api_key=258) ─────────────────────────
// Replaces the old apikey=208 fetch. Includes city_of_training and training_venue
// directly, so the secondary apikey=190 lookup is no longer needed.

interface RawTrainerAssignment {
  // Identity
  AssignmentId:          number | null;
  BatchId?:              number | string | null;
  batch_id?:             number | string | null;
  // Course / Client
  CourseName:            string | null;
  course_name?:          string | null;
  ClientName?:           string | null;
  client_name?:          string | null;
  // Trainer
  TrainerName:           string | null;
  trainer_name?:         string | null;
  TrainerEmail:          string | null;
  trainer_email?:        string | null;
  trainer_emp_code:      number | string | null;
  // Batch type — apikey=208 returns "Batch_type"; apikey=258 returns "batch_delivery_mode"
  batch_delivery_mode:   string | null;
  BatchDeliveryMode?:    string | null;
  Batch_type?:           string | null;   // apikey=208 field (capital B and T)
  // New fields from apikey=208
  TotalPax?:             number | string | null;
  Manager?:              string | null;
  ManagerEmail?:         string | null;
  // Dates — combined string (most common)
  training_dates:        string | null;
  TrainingDates?:        string | null;
  // Dates — separate fields (all known Koenig API naming conventions)
  StarDate?:              string | null;  // apikey=208 typo for "StartDate"
  start_date?:            string | null;
  StartDate?:             string | null;
  AssignmentStartDate?:   string | null;
  assignment_start_date?: string | null;
  BatchStartDate?:        string | null;
  batch_start_date?:      string | null;
  TrainingStartDate?:     string | null;
  training_start_date?:   string | null;
  BatchFromDate?:         string | null;
  batch_from_date?:       string | null;
  FromDate?:              string | null;
  From_Date?:             string | null;
  from_date?:             string | null;
  DateFrom?:              string | null;
  date_from?:             string | null;
  BatchFrom?:             string | null;
  batch_from?:            string | null;
  AssignmentFrom?:        string | null;
  assignment_from?:       string | null;
  end_date?:              string | null;
  EndDate?:               string | null;
  AssignmentEndDate?:     string | null;
  assignment_end_date?:   string | null;
  BatchEndDate?:          string | null;
  batch_end_date?:        string | null;
  TrainingEndDate?:       string | null;
  training_end_date?:     string | null;
  BatchToDate?:           string | null;
  batch_to_date?:         string | null;
  ToDate?:                string | null;
  To_Date?:               string | null;
  to_date?:               string | null;
  DateTo?:                string | null;
  date_to?:               string | null;
  BatchTo?:               string | null;
  batch_to?:              string | null;
  AssignmentTo?:          string | null;
  assignment_to?:         string | null;
  // Location
  city_of_training:      string | null;
  CityOfTraining?:       string | null;
  City?:                 string | null;
  city?:                 string | null;
  Country?:              string | null;
  country?:              string | null;
  CountryName?:          string | null;
  country_name?:         string | null;
  training_venue:        string | null;
  TrainingVenue?:        string | null;
  [key: string]: unknown;
}

// Pick the first non-empty string value from a list of field names on a raw record
function pickStr(r: RawTrainerAssignment, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null') {
      return String(v).trim();
    }
  }
  return '';
}

// Pick a parsed ISO date (YYYY-MM-DD) from the first resolvable date field
function pickDate(r: RawTrainerAssignment, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k] as string | null;
    if (!v) continue;
    const parsed = parseApiDate(String(v));
    if (parsed) return parsed;
  }
  return '';
}

// Parse "23-Feb-2026" or "23-Jul-2026" → "2026-02-23"
const MONTH_MAP: Record<string, string> = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
};
function parseApiDate(raw: string | null): string {
  if (!raw) return '';
  const s = raw.trim();
  if (!s || s === 'null' || s === 'undefined') return '';

  // ISO: "2026-07-23" or "2026-07-23T..."
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Helper: normalise a 2- or 4-digit year string → 4-digit
  function fullYear(y: string): string {
    return /^\d{2}$/.test(y) ? `20${y}` : y;
  }
  // Helper: month abbreviation → zero-padded number
  function monToMM(mon: string): string {
    const key = mon.charAt(0).toUpperCase() + mon.slice(1, 3).toLowerCase();
    return MONTH_MAP[key] ?? MONTH_MAP[mon] ?? '';
  }

  // "DD-Mon-YYYY" or "DD-Mon-YY"  e.g. "23-Jul-2026", "23-Jul-26"
  const dashParts = s.split('-');
  if (dashParts.length === 3) {
    const [dd, mon, yy] = dashParts;
    if (/^\d{1,2}$/.test(dd.trim()) && /^\d{2,4}$/.test(yy.trim())) {
      const mm = monToMM(mon.trim());
      if (mm) return `${fullYear(yy.trim())}-${mm}-${dd.trim().padStart(2, '0')}`;
    }
  }

  // "DD/MM/YYYY" or "DD/MM/YY"
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, dd, mm, yy] = slashMatch;
    return `${fullYear(yy)}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // "DD Mon YYYY" or "D Mon YYYY"  e.g. "23 Jul 2026"
  const spaceMatch = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (spaceMatch) {
    const [, dd, mon, yy] = spaceMatch;
    const mm = monToMM(mon);
    if (mm) return `${fullYear(yy)}-${mm}-${dd.padStart(2, '0')}`;
  }

  // "Mon DD, YYYY" or "Mon DD YYYY"  e.g. "Jul 23, 2026"
  const monDayMatch = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monDayMatch) {
    const [, mon, dd, yy] = monDayMatch;
    const mm = monToMM(mon);
    if (mm) return `${fullYear(yy)}-${mm}-${dd.padStart(2, '0')}`;
  }

  // "YYYY/MM/DD"
  const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    const [, yyyy, mm, dd] = ymdSlash;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return ''; // unrecognised format — return empty rather than a garbage slice
}

// Parse training_dates field, e.g.:
//   "23-Jul-2026 to 30-Jul-2026"
//   "2026-07-23 to 2026-07-30"
//   "23-Jul-2026 - 30-Jul-2026"
//   "23-Jul-2026"   (single date)
function parseTrainingDates(raw: string | null): { startDate: string; endDate: string } {
  if (!raw) return { startDate: '', endDate: '' };
  const s = raw.trim();

  // Try multi-char separators first (order matters — " - " before "-")
  const separators = [' to ', ' TO ', ' - ', ' / ', ' | ', ' ~ '];
  for (const sep of separators) {
    if (s.includes(sep)) {
      const idx = s.indexOf(sep);
      const left  = s.slice(0, idx).trim();
      const right = s.slice(idx + sep.length).trim();
      const startDate = parseApiDate(left);
      const endDate   = parseApiDate(right);
      if (startDate || endDate) return { startDate, endDate };
    }
  }

  // Comma-separated with same-month shorthand: "Jul 23, 30 2026" → skip (too ambiguous)
  // Just try parsing the whole string as a single date
  const single = parseApiDate(s);
  return { startDate: single, endDate: single };
}

// Normalize an emp code: strip leading zeros so "01234" and "1234" match the same trainer
function normalizeEmpCode(c: string | number | null | undefined): string {
  if (c == null) return '';
  const s = String(c).trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s.toLowerCase();
}

// Filter raw records to only this trainer by checking every possible emp-code field name
function filterByEmpCode(raw: RawTrainerAssignment[], empCode: string): RawTrainerAssignment[] {
  const userNorm = normalizeEmpCode(empCode);
  return raw.filter((r: RawTrainerAssignment) => {
    const rec = r as Record<string, unknown>;
    const apiRaw =
      rec['trainer_emp_code'] ??
      rec['TrainerEmpCode']   ??
      rec['trainerEmpCode']   ??
      rec['emp_code']         ??
      rec['EmpCode']          ??
      rec['empCode']          ??
      rec['EmployeeCode']     ??
      rec['employee_code']    ??
      null;
    if (apiRaw == null) return true; // no emp-code field — trust API already filtered
    return normalizeEmpCode(apiRaw as string | number) === userNorm;
  });
}

function logApiRecords(apiLabel: string, raw: RawTrainerAssignment[], fromDate: string, toDate: string) {
  if (raw.length > 0) {
    console.group(`[${apiLabel}] ${raw.length} record(s) for ${fromDate} → ${toDate}`);
    console.log('Fields:', Object.keys(raw[0]));
    raw.forEach((r: RawTrainerAssignment, i: number) => {
      const rec = r as Record<string, unknown>;
      const dates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (/date|star|start|end|from|to|training/i.test(k)) dates[k] = v;
      }
      console.log(
        `[${i}] id=${r.AssignmentId} emp=${r.trainer_emp_code}` +
        ` course=${r.CourseName} Batch_type=${r.Batch_type} bdm=${r.batch_delivery_mode}`,
        dates,
      );
    });
    console.groupEnd();
  } else {
    console.warn(`[${apiLabel}] Empty response for ${fromDate} → ${toDate}`);
  }
}

async function fetchTrainerAssignments(
  fromDate: string,
  toDate: string,
  empCode: string,
): Promise<RawTrainerAssignment[]> {
  const clean = empCode.replace(/^EMP-/i, '').trim();
  const params = new URLSearchParams({ empCode: clean, from: fromDate, to: toDate });
  const res = await fetch(`/api/assignments?${params}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Assignments HTTP ${res.status}`);
  let raw: RawTrainerAssignment[] = Array.isArray(data.assignments) ? data.assignments : [];
  logApiRecords(`API ${data.source}`, raw, fromDate, toDate);
  raw = filterByEmpCode(raw, empCode);
  console.log(`[API ${data.source}] After emp-code filter (${clean}): ${raw.length} record(s)`);
  return raw;
}

// ── Employee Leave Details API (api_key=237) ─────────────────────────────────

interface LeaveRecord {
  // Primary fields (camelCase variants used by older backend versions)
  emp_name: string | null;
  emp_code: string | null;
  from_date: string | null;
  from_time: string | null;
  to_date: string | null;
  to_time: string | null;
  leave_status: string | null;
  leave_approval_date: string | null;
  leave_type: string | null;
  // Alternate casing variants returned by some API versions
  Emp_Name?: string | null;
  Emp_Code?: string | null;
  From_Date?: string | null;
  To_Date?: string | null;
  Leave_Status?: string | null;
  Leave_Type?: string | null;
  Leave_Approval_Date?: string | null;
  // Half-day / duration fields
  half_day?: string | null;
  is_half_day?: boolean | null;
  duration?: string | null;
  no_of_days?: number | null;
  [key: string]: unknown;
}

// Normalise a LeaveRecord so downstream code can always use lowercase field names
function normalizeLeaveRecord(r: LeaveRecord): LeaveRecord {
  return {
    emp_name:            r.emp_name  ?? r.Emp_Name  ?? null,
    emp_code:            r.emp_code  ?? r.Emp_Code  ?? null,
    from_date:           r.from_date ?? r.From_Date ?? null,
    from_time:           r.from_time ?? null,
    to_date:             r.to_date   ?? r.To_Date   ?? null,
    to_time:             r.to_time   ?? null,
    leave_status:        r.leave_status ?? r.Leave_Status ?? null,
    leave_approval_date: r.leave_approval_date ?? r.Leave_Approval_Date ?? null,
    leave_type:          r.leave_type ?? r.Leave_Type ?? null,
    half_day:            r.half_day  ?? null,
    is_half_day:         r.is_half_day ?? null,
    duration:            r.duration  ?? null,
    no_of_days:          r.no_of_days ?? null,
  };
}

// Parse "DD-Mon-YYYY", "DD/MM/YYYY", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DD"
function parseLeaveDate(raw: string | null): string {
  if (!raw) return '';
  const s = raw.trim();
  if (!s || s === 'null') return '';
  // ISO: 2026-07-01... or 2026-07-01T00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  // DD-Mon-YYYY  e.g. "01-Jul-2026"
  const monMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const [, dd, mon, yyyy] = monMatch;
    const mm = MONTH_MAP[mon] ?? MONTH_MAP[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
}

// Returns true if a leave_status string represents an approved/accepted leave
function isApprovedLeave(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return (
    s.includes('approv') ||
    s.includes('sanction') ||
    s.includes('accept') ||
    s.includes('granted') ||
    s === 'approved' ||
    s === 'sanctioned' ||
    s === 'accepted'
  );
}

// Returns true if leave is pending/in-review
function isPendingLeave(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s.includes('pending') || s.includes('review') || s.includes('submitted');
}

// Returns true if leave was cancelled/revoked/rejected
function isCancelledLeave(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return (
    s.includes('cancel') ||
    s.includes('revok') ||
    s.includes('reject') ||
    s.includes('withdraw') ||
    s.includes('denied') ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'rejected' ||
    s === 'revoked'
  );
}

async function fetchEmployeeLeaves(
  empCode: string,
  fromDate: string,
  toDate: string,
): Promise<LeaveRecord[]> {
  // Use the local Vite middleware (or Vercel serverless on prod) — credentials never in browser
  const clean = empCode.replace(/^EMP-/i, '').trim();
  const res = await fetch(`/api/leaves?empCode=${encodeURIComponent(clean)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error || `Leave API HTTP ${res.status}`);
  }
  const data = await res.json() as { leaves?: LeaveRecord[]; error?: string };
  if (data.error) throw new Error(data.error);

  let leaves = data.leaves ?? [];

  // Client-side date filter — API returns all leaves, we filter to the selected range
  if ((fromDate || toDate) && leaves.length > 0) {
    leaves = leaves.filter((l) => {
      const lFrom = (l.from_date || '').slice(0, 10);
      const lTo   = (l.to_date   || '').slice(0, 10);
      if (fromDate && lTo   && lTo   < fromDate) return false;
      if (toDate   && lFrom && lFrom > toDate)   return false;
      return true;
    });
  }

  return leaves.map(normalizeLeaveRecord);
}

// ── Get Trainer Flight & Travel Details API (apikey=256) ─────────────────────
// Replaces apikey=108 (email-based). Now uses emp_code, same as assignments.

interface FlightRecord {
  trip_ID: number | null;
  flight_number: string | null;
  from_city: string | null;
  to_city: string | null;
  departure_date: string | null;   // "2026-07-04T00:00:00" or "04-Jul-2026"
  departure_time: string | null;   // "16:00:00"
  arrival_date: string | null;
  arrival_time: string | null;
  connecting_flight_id: number | null;
  Is_cancelled: string | null;     // "Yes" | "No" | null
  ticket_path: string | null;
  insurance_path: string | null;
  airlines_name: string | null;
  transport_type: string | null;   // "Flight" | "Train" | "Bus" | etc.
  [key: string]: unknown;
}

async function fetchTrainerFlights(empCode: string, email?: string): Promise<FlightRecord[]> {
  const clean = empCode.replace(/^EMP-/i, '').trim();
  const params = new URLSearchParams({ empCode: clean });
  if (email) params.set('email', email);
  const res = await fetch(`/api/flights?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Flights fetch HTTP ${res.status}`);
  const raw = Array.isArray(data.flights) ? data.flights : [];
  if (raw.length > 0) {
    console.log('[API flights] records:', raw.length, '| sample:', JSON.stringify(raw[0], null, 2));
  }
  return raw;
}

// Robust date parser — handles ISO, DD-Mon-YYYY, DD/MM/YYYY
function parseDT(dt: string | null): string {
  if (!dt) return '';
  const s = dt.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const monMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const [, dd, mon, yyyy] = monMatch;
    const mm = MONTH_MAP[mon] ?? MONTH_MAP[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  const slashMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
}

function parseTM(t: string | null): string {
  if (!t) return '';
  // "16:00:00" → "16:00"  |  "4:00 PM" → keep as-is
  return t.length >= 5 ? t.slice(0, 5) : t;
}

// ── Trainer Accommodation API (api_key=120) ───────────────────────────────────

// ── Get Trainer Accommodation Details API (apikey=257) ────────────────────────
// Replaces apikey=120 (email-based). Now uses emp_code, same as assignments.

interface AccommodationRecord {
  EmpId: number | null;
  TrainerName: string | null;
  RoomNo: string | null;
  AccommodationName: string | null;
  CityName: string | null;
  CheckInDate: string | null;    // "2026-07-04T00:00:00"
  CheckOutDate: string | null;
  Nights: number | null;
  StayDates: string | null;      // e.g. "04-Jul-2026 to 06-Jul-2026"
  Is_caneclled: string | number | null;   // "0"/0 = active, "1"/1 = cancelled (note: API spelling)
  AccommodationPDF: string | null;
  [key: string]: unknown;
}

async function fetchTrainerAccommodation(empCode: string): Promise<AccommodationRecord[]> {
  const clean = empCode.replace(/^EMP-/i, '').trim();
  const res = await fetch(`/api/accommodation?empCode=${encodeURIComponent(clean)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Accommodation fetch HTTP ${res.status}`);
  const raw = Array.isArray(data.accommodation) ? data.accommodation : [];
  if (raw.length > 0) {
    console.log('[API 257] records:', raw.length, '| sample:', JSON.stringify(raw[0], null, 2));
  }
  return raw;
}

function accomDT(dt: string | null): string {
  if (!dt) return '';
  const s = dt.trim();
  // ISO: "2026-07-04" or "2026-07-04T00:00:00"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD-Mon-YYYY e.g. "04-Jul-2026"
  const monMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const [, dd, mon, yyyy] = monMatch;
    const mm = MONTH_MAP[mon] ?? MONTH_MAP[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  // DD/MM/YYYY
  const slashMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  // fallback — take first 10 chars (works for plain ISO)
  return s.slice(0, 10);
}

// ── Country List API (apikey=223) ────────────────────────────────────────────

interface KoenigCountry { CountryId: number | null; CountryName: string | null; }

async function fetchCountryList(): Promise<KoenigCountry[]> {
  const res = await fetch('/api/countries');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Country list HTTP ${res.status}`);
  return Array.isArray(data.countries) ? (data.countries as KoenigCountry[]) : [];
}

// ── Employee Advance List API (apikey=259) ────────────────────────────────────

interface RawAdvanceRecord {
  AdvanceId:     number | null;
  EmpId:         number | string | null;
  EmpName:       string | null;
  AdvanceAmount: number | null;
  AdvanceDate:   string | null;
  Purpose:       string | null;
  VoucherNo:     string | null;
  Status:        string | null;
  Currency:      string | null;
  [key: string]: unknown;
}

async function fetchEmployeeAdvances(empCode: string): Promise<RawAdvanceRecord[]> {
  const clean = empCode.replace(/^EMP-/i, '').trim();
  const res = await fetch(`/api/advances?empCode=${encodeURIComponent(clean)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Advances fetch HTTP ${res.status}`);
  const raw = Array.isArray(data.advances) ? data.advances : [];
  if (raw.length > 0) {
    console.log('[API 259] records:', raw.length, '| sample:', JSON.stringify(raw[0], null, 2));
  }
  return raw as RawAdvanceRecord[];
}

// ── Lodging entry (hotel stay in this page) ───────────────────────────────────

interface LodgingEntry {
  id: string;
  hotelName: string;
  city: string;
  roomNo: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  ratePerNight: number;
  receipt: string;
  source: 'pms' | 'manual';
}

// ── Assignment model ──────────────────────────────────────────────────────────

interface Assignment {
  id: string;
  courseName: string;
  clientName: string;
  city: string;
  country: string;
  hotelName: string;
  venueName: string;
  distanceKm: string;
  startDate: string;
  endDate: string;
  assignmentId: string;
  batchId?: string;
  source: 'api' | 'manual';
  // Fields from apikey=258
  trainerName?: string;
  trainerEmail?: string;
  trainingVenue?: string;   // training_venue from API
  trainingDates?: string | null;  // raw training_dates from API; null = inferred from date range
  manager?: string;
  totalPax?: string;
  batchType?: string;       // batch_delivery_mode: ILO | ILT | FMAT
  batchCategory?: string;
  deliveryMode?: string;    // derived: Online | Offline | Hybrid
}

function deriveDeliveryMode(bdm: string): string {
  const v = bdm.toUpperCase().trim();
  // ILO → Online (Instructor-Led Online)
  if (v === 'ILO' || v.startsWith('ILO')) return 'Online';
  // FMAT → Offline (Face-to-face)
  if (v === 'FMAT' || v.startsWith('FMAT')) return 'Offline';
  // ILT → Offline (Instructor-Led Training)
  if (v === 'ILT' || v.startsWith('ILT')) return 'Offline';
  return 'Offline'; // unknown → treat as Offline (eligible for TA/DA)
}

// City → Country lookup for apikey=258 (which returns city_of_training but no country)
const CITY_COUNTRY_MAP: Record<string, string> = {
  // India
  'delhi': 'India', 'new delhi': 'India', 'noida': 'India', 'gurgaon': 'India',
  'gurugram': 'India', 'mumbai': 'India', 'bombay': 'India', 'bangalore': 'India',
  'bengaluru': 'India', 'hyderabad': 'India', 'chennai': 'India', 'madras': 'India',
  'pune': 'India', 'kolkata': 'India', 'calcutta': 'India', 'ahmedabad': 'India',
  'jaipur': 'India', 'chandigarh': 'India', 'kochi': 'India', 'cochin': 'India',
  'lucknow': 'India', 'bhopal': 'India', 'indore': 'India', 'nagpur': 'India',
  'coimbatore': 'India', 'surat': 'India', 'vadodara': 'India', 'baroda': 'India',
  'agra': 'India', 'varanasi': 'India', 'patna': 'India', 'ranchi': 'India',
  'bhubaneswar': 'India', 'visakhapatnam': 'India', 'vijayawada': 'India',
  'thiruvananthapuram': 'India', 'trivandrum': 'India', 'mysore': 'India',
  'mysuru': 'India', 'srinagar': 'India', 'amritsar': 'India', 'dehradun': 'India',
  'goa': 'India', 'panaji': 'India', 'faridabad': 'India', 'meerut': 'India',
  'nashik': 'India', 'aurangabad': 'India', 'rajkot': 'India', 'jabalpur': 'India',
  'raipur': 'India', 'jodhpur': 'India', 'madurai': 'India', 'mangalore': 'India',
  'mangaluru': 'India', 'hubli': 'India', 'dharwad': 'India', 'guwahati': 'India',
  // UAE
  'dubai': 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates',
  'sharjah': 'United Arab Emirates', 'ajman': 'United Arab Emirates',
  'ras al khaimah': 'United Arab Emirates', 'fujairah': 'United Arab Emirates',
  'uae': 'United Arab Emirates',
  // UK
  'london': 'UK', 'manchester': 'UK', 'birmingham': 'UK', 'edinburgh': 'UK',
  'glasgow': 'UK', 'bristol': 'UK', 'leeds': 'UK', 'liverpool': 'UK',
  // USA
  'new york': 'USA', 'los angeles': 'USA', 'chicago': 'USA', 'houston': 'USA',
  'san francisco': 'USA', 'seattle': 'USA', 'boston': 'USA', 'dallas': 'USA',
  'austin': 'USA', 'denver': 'USA', 'atlanta': 'USA', 'miami': 'USA',
  'washington': 'USA', 'phoenix': 'USA', 'las vegas': 'USA',
  // Singapore
  'singapore': 'Singapore',
  // Saudi Arabia
  'riyadh': 'Saudi Arabia', 'jeddah': 'Saudi Arabia', 'mecca': 'Saudi Arabia',
  'medina': 'Saudi Arabia', 'dammam': 'Saudi Arabia', 'khobar': 'Saudi Arabia',
  // Qatar
  'doha': 'Qatar',
  // Bahrain
  'manama': 'Bahrain',
  // Kuwait
  'kuwait city': 'Kuwait', 'kuwait': 'Kuwait',
  // Australia
  'sydney': 'Australia', 'melbourne': 'Australia', 'brisbane': 'Australia',
  'perth': 'Australia', 'adelaide': 'Australia', 'canberra': 'Australia',
  // Canada
  'toronto': 'Canada', 'vancouver': 'Canada', 'calgary': 'Canada',
  'ottawa': 'Canada', 'montreal': 'Canada', 'edmonton': 'Canada',
  // Germany
  'frankfurt': 'Germany', 'munich': 'Germany', 'berlin': 'Germany',
  'hamburg': 'Germany', 'düsseldorf': 'Germany', 'cologne': 'Germany',
  // Netherlands
  'amsterdam': 'Netherlands', 'rotterdam': 'Netherlands', 'the hague': 'Netherlands',
  // France
  'paris': 'France', 'lyon': 'France', 'marseille': 'France',
  // Switzerland
  'zurich': 'Switzerland', 'geneva': 'Switzerland', 'bern': 'Switzerland',
  // Belgium
  'brussels': 'Belgium', 'antwerp': 'Belgium',
  // Sweden
  'stockholm': 'Sweden', 'gothenburg': 'Sweden',
  // Japan
  'tokyo': 'Japan', 'osaka': 'Japan', 'kyoto': 'Japan', 'nagoya': 'Japan',
  // South Korea
  'seoul': 'South Korea', 'busan': 'South Korea',
  // Hong Kong
  'hong kong': 'Hong Kong',
  // China
  'beijing': 'China', 'shanghai': 'China', 'shenzhen': 'China',
  'guangzhou': 'China', 'chengdu': 'China',
  // Malaysia
  'kuala lumpur': 'Malaysia', 'penang': 'Malaysia', 'johor bahru': 'Malaysia',
  // Thailand
  'bangkok': 'Thailand', 'phuket': 'Thailand', 'chiang mai': 'Thailand',
  // Philippines
  'manila': 'Philippines', 'cebu': 'Philippines',
  // Indonesia
  'jakarta': 'Indonesia', 'bali': 'Indonesia', 'surabaya': 'Indonesia',
  // Vietnam
  'hanoi': 'Vietnam', 'ho chi minh': 'Vietnam', 'ho chi minh city': 'Vietnam',
  // Nepal
  'kathmandu': 'Nepal', 'pokhara': 'Nepal',
  // Bangladesh
  'dhaka': 'Bangladesh', 'chittagong': 'Bangladesh',
  // Sri Lanka
  'colombo': 'Sri Lanka', 'kandy': 'Sri Lanka',
  // Pakistan
  'karachi': 'Pakistan', 'lahore': 'Pakistan', 'islamabad': 'Pakistan',
  // Egypt
  'cairo': 'Egypt', 'alexandria': 'Egypt',
  // South Africa
  'johannesburg': 'South Africa', 'cape town': 'South Africa', 'durban': 'South Africa',
  // Kenya
  'nairobi': 'Kenya', 'mombasa': 'Kenya',
  // Nigeria
  'lagos': 'Nigeria', 'abuja': 'Nigeria',
  // Turkey
  'istanbul': 'Turkey', 'ankara': 'Turkey',
  // Israel
  'tel aviv': 'Israel', 'jerusalem': 'Israel',
  // Jordan
  'amman': 'Jordan',
  // New Zealand
  'auckland': 'New Zealand', 'wellington': 'New Zealand', 'christchurch': 'New Zealand',
  // Russia
  'moscow': 'Russia', 'st. petersburg': 'Russia',
  // Oman
  'muscat': 'Oman',
};

function inferCountryFromCity(city: string): string {
  if (!city) return 'India'; // Koenig default — most domestic
  const lower = city.toLowerCase().trim();
  // Direct match
  if (CITY_COUNTRY_MAP[lower]) return CITY_COUNTRY_MAP[lower];
  // Check if the value itself is already a country name in DA_POLICY
  const directCountry = Object.keys(DA_POLICY).find(k => k.toLowerCase() === lower);
  if (directCountry) return directCountry;
  // Partial match — city string contains a known city key
  for (const [key, country] of Object.entries(CITY_COUNTRY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return country;
  }
  // Default: assume India for unrecognised cities (most Koenig domestic training)
  return 'India';
}

function mapRawToAssignment(r: RawTrainerAssignment, fallbackFromDate = '', fallbackToDate = ''): Assignment {
  // ── Batch type & delivery mode ──────────────────────────────────────────────
  // apikey=258 (primary) returns "batch_delivery_mode"; apikey=208 (fallback) returns "Batch_type"
  const rawBdm    = pickStr(r, 'batch_delivery_mode', 'BatchDeliveryMode', 'Batch_type');
  const batchType = rawBdm || undefined;
  const deliveryMode = batchType ? deriveDeliveryMode(batchType) : undefined;

  // ── Course & client ─────────────────────────────────────────────────────────
  const courseName  = pickStr(r, 'CourseName', 'course_name') || 'Assignment';
  const clientName  = pickStr(r, 'ClientName', 'client_name');
  const trainerName = pickStr(r, 'TrainerName', 'trainer_name');
  const trainerEmail= pickStr(r, 'TrainerEmail', 'trainer_email');
  const batchId     = pickStr(r, 'BatchId', 'batch_id');
  // apikey=208 new fields
  const manager     = pickStr(r, 'Manager', 'manager', 'manager_name', 'ManagerName');
  const totalPax    = pickStr(r, 'TotalPax', 'total_pax', 'totalPax', 'pax');

  // ── Location ─────────────────────────────────────────────────────────────────
  const city    = pickStr(r, 'city_of_training', 'CityOfTraining', 'City', 'city');
  const rawCountry = pickStr(r, 'Country', 'country', 'CountryName', 'country_name');
  const country = rawCountry || inferCountryFromCity(city);

  const trainingVenue = pickStr(r, 'training_venue', 'TrainingVenue');

  // ── Dates ────────────────────────────────────────────────────────────────────
  // Priority 1: separate start/end date fields (exhaustive Koenig API variant list)
  // Note: apikey=208 returns "StarDate" (typo for StartDate) — must be first
  let startDate = pickDate(r,
    'StarDate', 'start_date', 'StartDate',
    'AssignmentStartDate', 'assignment_start_date',
    'BatchStartDate', 'batch_start_date',
    'TrainingStartDate', 'training_start_date',
    'BatchFromDate', 'batch_from_date',
    'From_Date', 'from_date', 'FromDate',
    'DateFrom', 'date_from',
    'BatchFrom', 'batch_from',
    'AssignmentFrom', 'assignment_from',
  );
  let endDate = pickDate(r,
    'end_date', 'EndDate',
    'AssignmentEndDate', 'assignment_end_date',
    'BatchEndDate', 'batch_end_date',
    'TrainingEndDate', 'training_end_date',
    'BatchToDate', 'batch_to_date',
    'To_Date', 'to_date', 'ToDate',
    'DateTo', 'date_to',
    'BatchTo', 'batch_to',
    'AssignmentTo', 'assignment_to',
  );

  // Priority 2: parse combined training_dates string  e.g. "23-Jul-2026 to 30-Jul-2026"
  const rawTrainingDates = pickStr(r, 'training_dates', 'TrainingDates');
  if (rawTrainingDates) {
    const parsed = parseTrainingDates(rawTrainingDates);
    if (!startDate && parsed.startDate) startDate = parsed.startDate;
    if (!endDate   && parsed.endDate)   endDate   = parsed.endDate;
  }

  // Priority 3: fall back to selected date range (shown as "inferred" in UI)
  if (!startDate && fallbackFromDate) startDate = fallbackFromDate;
  if (!endDate   && fallbackToDate)   endDate   = fallbackToDate;

  // trainingDates = raw API string if present; null = inferred (UI shows amber label)
  const trainingDates: string | null = rawTrainingDates || null;

  return {
    id:            uid(),
    assignmentId:  r.AssignmentId != null ? String(r.AssignmentId) : '',
    batchId,
    courseName,
    clientName,
    city,
    country,
    hotelName:     '',
    venueName:     trainingVenue,
    distanceKm:    '',
    startDate,
    endDate,
    source:        'api',
    trainerName,
    trainerEmail,
    trainingVenue,
    trainingDates,
    manager,
    totalPax,
    batchType,
    batchCategory: undefined,
    deliveryMode,
  } as Assignment;
}

const COUNTRIES = ['India', 'United Arab Emirates', 'Dubai', 'USA', 'UK', 'Singapore', 'Australia', 'Canada', 'Germany', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Bhutan', 'Myanmar', 'Japan', 'France', 'Italy', 'Switzerland', 'Netherlands', 'Belgium', 'Sweden', 'Spain', 'Portugal', 'Ireland', 'Russia', 'China', 'South Korea', 'Hong Kong', 'Taiwan', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Pakistan', 'Egypt', 'South Africa', 'Kenya', 'Nigeria', 'Ghana', 'Turkey', 'Israel', 'Jordan', 'Oman', 'Yemen', 'Iran', 'Iraq', 'Lebanon', 'New Zealand', 'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru'];
const CITIES_IN = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Noida', 'Gurgaon'];

// ── DA Policy table (as per official DA Policy document) ──────────────────────
// currency: 'INR' | 'AED' | 'USD'
// rate: amount in that currency per day

interface DaPolicy { rate: number; currency: string; }

const DA_POLICY: Record<string, DaPolicy> = {
  // India & Neighboring Countries (INR)
  'India': { rate: 950, currency: 'INR' },
  'Nepal': { rate: 1100, currency: 'INR' },
  'Bangladesh': { rate: 1100, currency: 'INR' },
  'Myanmar': { rate: 1100, currency: 'INR' },
  'Burma': { rate: 1100, currency: 'INR' },
  'Bhutan': { rate: 1100, currency: 'INR' },
  'Sri Lanka': { rate: 1100, currency: 'INR' },
  // Dubai / UAE (AED)
  'Dubai': { rate: 75, currency: 'AED' },
  'United Arab Emirates': { rate: 75, currency: 'AED' },
  'UAE': { rate: 75, currency: 'AED' },
  // All international (USD)
  'UK': { rate: 50, currency: 'USD' },
  'Singapore': { rate: 50, currency: 'USD' },
  'Maldives': { rate: 40, currency: 'USD' },
  'USA': { rate: 50, currency: 'USD' },
  'United States': { rate: 50, currency: 'USD' },
  'South Africa': { rate: 40, currency: 'USD' },
  'Australia': { rate: 50, currency: 'USD' },
  'Thailand': { rate: 30, currency: 'USD' },
  'Saudi Arabia': { rate: 30, currency: 'USD' },
  'Malaysia': { rate: 30, currency: 'USD' },
  'Philippines': { rate: 30, currency: 'USD' },
  'Canada': { rate: 50, currency: 'USD' },
  'Egypt': { rate: 25, currency: 'USD' },
  'Denmark': { rate: 50, currency: 'USD' },
  'Namibia': { rate: 30, currency: 'USD' },
  'Indonesia': { rate: 30, currency: 'USD' },
  'Tanzania': { rate: 25, currency: 'USD' },
  'Vietnam': { rate: 20, currency: 'USD' },
  'Kenya': { rate: 25, currency: 'USD' },
  'Sudan': { rate: 25, currency: 'USD' },
  'Zimbabwe': { rate: 30, currency: 'USD' },
  'Laos': { rate: 20, currency: 'USD' },
  'Mexico': { rate: 20, currency: 'USD' },
  'Mozambique': { rate: 25, currency: 'USD' },
  'Djibouti': { rate: 20, currency: 'USD' },
  'Dijbouti': { rate: 20, currency: 'USD' },
  'Burundi': { rate: 20, currency: 'USD' },
  'Ghana': { rate: 30, currency: 'USD' },
  'Kazakhstan': { rate: 30, currency: 'USD' },
  'Iraq': { rate: 40, currency: 'USD' },
  'Ethiopia': { rate: 30, currency: 'USD' },
  'Pakistan': { rate: 20, currency: 'USD' },
  'Oman': { rate: 40, currency: 'USD' },
  'Yemen': { rate: 20, currency: 'USD' },
  'Gabon': { rate: 30, currency: 'USD' },
  'Lebanon': { rate: 20, currency: 'USD' },
  'Mauritius': { rate: 30, currency: 'USD' },
  'Mongolia': { rate: 20, currency: 'USD' },
  'Zambia': { rate: 25, currency: 'USD' },
  'Spain': { rate: 50, currency: 'USD' },
  'Malawi': { rate: 20, currency: 'USD' },
  'Angola': { rate: 30, currency: 'USD' },
  'Iran': { rate: 30, currency: 'USD' },
  'Israel': { rate: 50, currency: 'USD' },
  'Nigeria': { rate: 20, currency: 'USD' },
  'Turkey': { rate: 30, currency: 'USD' },
  'Hong Kong': { rate: 40, currency: 'USD' },
  'New Caledonia': { rate: 30, currency: 'USD' },
  'Rwanda': { rate: 25, currency: 'USD' },
  'East Timor': { rate: 20, currency: 'USD' },
  'Timor-Leste': { rate: 20, currency: 'USD' },
  'Equatorial Guinea': { rate: 20, currency: 'USD' },
  'Seychelles': { rate: 30, currency: 'USD' },
  'Germany': { rate: 50, currency: 'USD' },
  'Cyprus': { rate: 50, currency: 'USD' },
  'Poland': { rate: 40, currency: 'USD' },
  'Georgia': { rate: 40, currency: 'USD' },
  'Kuwait': { rate: 30, currency: 'USD' },
  'Vatican City': { rate: 50, currency: 'USD' },
  'Jordan': { rate: 30, currency: 'USD' },
  'Antigua and Barbuda': { rate: 30, currency: 'USD' },
  'Qatar': { rate: 30, currency: 'USD' },
  'Bahamas': { rate: 30, currency: 'USD' },
  'Cambodia': { rate: 20, currency: 'USD' },
  'Barbados': { rate: 30, currency: 'USD' },
  'Somalia': { rate: 20, currency: 'USD' },
  'Belize': { rate: 30, currency: 'USD' },
  'Senegal': { rate: 25, currency: 'USD' },
  'Costa Rica': { rate: 30, currency: 'USD' },
  'Afghanistan': { rate: 20, currency: 'USD' },
  'Cuba': { rate: 30, currency: 'USD' },
  'New Zealand': { rate: 40, currency: 'USD' },
  'Dominica': { rate: 30, currency: 'USD' },
  'Dominican Republic': { rate: 30, currency: 'USD' },
  'Guatemala': { rate: 30, currency: 'USD' },
  'Uzbekistan': { rate: 30, currency: 'USD' },
  'El Salvador': { rate: 30, currency: 'USD' },
  'Libya': { rate: 20, currency: 'USD' },
  'Grenada': { rate: 30, currency: 'USD' },
  'Azerbaijan': { rate: 30, currency: 'USD' },
  'Papua New Guinea': { rate: 20, currency: 'USD' },
  'Haiti': { rate: 30, currency: 'USD' },
  'Amsterdam': { rate: 50, currency: 'USD' },
  'Honduras': { rate: 30, currency: 'USD' },
  'Syria': { rate: 30, currency: 'USD' },
  'Jamaica': { rate: 30, currency: 'USD' },
  'Gambia': { rate: 30, currency: 'USD' },
  'Nicaragua': { rate: 30, currency: 'USD' },
  'Brunei': { rate: 30, currency: 'USD' },
  'Panama': { rate: 30, currency: 'USD' },
  'Taiwan': { rate: 40, currency: 'USD' },
  'Saint Kitts and Nevis': { rate: 30, currency: 'USD' },
  'Cameroon': { rate: 20, currency: 'USD' },
  'Saint Lucia': { rate: 30, currency: 'USD' },
  'Palestinian Territory': { rate: 20, currency: 'USD' },
  'Palestine': { rate: 30, currency: 'USD' },
  'Saint Vincent and the Grenadines': { rate: 30, currency: 'USD' },
  'Lesotho': { rate: 20, currency: 'USD' },
  'Trinidad and Tobago': { rate: 30, currency: 'USD' },
  'Eswatini': { rate: 25, currency: 'USD' },
  'Fiji': { rate: 30, currency: 'USD' },
  'Ireland': { rate: 40, currency: 'USD' },
  'Kiribati': { rate: 30, currency: 'USD' },
  'Portugal': { rate: 40, currency: 'USD' },
  'Marshall Islands': { rate: 30, currency: 'USD' },
  'Belgium': { rate: 50, currency: 'USD' },
  'Micronesia': { rate: 30, currency: 'USD' },
  'Sweden': { rate: 50, currency: 'USD' },
  'Nauru': { rate: 30, currency: 'USD' },
  'Solomon Islands': { rate: 30, currency: 'USD' },
  'Palau': { rate: 30, currency: 'USD' },
  'Russia': { rate: 40, currency: 'USD' },
  'Samoa': { rate: 30, currency: 'USD' },
  'Italy': { rate: 50, currency: 'USD' },
  'Tonga': { rate: 30, currency: 'USD' },
  'Switzerland': { rate: 50, currency: 'USD' },
  'Tuvalu': { rate: 30, currency: 'USD' },
  'Sierra Leone': { rate: 50, currency: 'USD' },
  'Vanuatu': { rate: 30, currency: 'USD' },
  'Algeria': { rate: 25, currency: 'USD' },
  'Argentina': { rate: 30, currency: 'USD' },
  'Benin': { rate: 20, currency: 'USD' },
  'Bolivia': { rate: 30, currency: 'USD' },
  'Botswana': { rate: 25, currency: 'USD' },
  'Brazil': { rate: 30, currency: 'USD' },
  'Burkina Faso': { rate: 20, currency: 'USD' },
  'Chile': { rate: 30, currency: 'USD' },
  'Cabo Verde': { rate: 20, currency: 'USD' },
  'Cape Verde': { rate: 20, currency: 'USD' },
  'Colombia': { rate: 30, currency: 'USD' },
  'Central African Republic': { rate: 20, currency: 'USD' },
  'Ecuador': { rate: 30, currency: 'USD' },
  'Chad': { rate: 20, currency: 'USD' },
  'Guyana': { rate: 30, currency: 'USD' },
  'Comoros': { rate: 20, currency: 'USD' },
  'Paraguay': { rate: 30, currency: 'USD' },
  'Republic of Congo': { rate: 20, currency: 'USD' },
  'Congo': { rate: 20, currency: 'USD' },
  'Peru': { rate: 30, currency: 'USD' },
  'Democratic Republic of the Congo': { rate: 25, currency: 'USD' },
  'DRC': { rate: 25, currency: 'USD' },
  'Suriname': { rate: 30, currency: 'USD' },
  'Japan': { rate: 40, currency: 'USD' },
  'Uruguay': { rate: 30, currency: 'USD' },
  'Venezuela': { rate: 30, currency: 'USD' },
  'South Korea': { rate: 40, currency: 'USD' },
  'Korea': { rate: 40, currency: 'USD' },
  'North Korea': { rate: 40, currency: 'USD' },
  'Tunisia': { rate: 20, currency: 'USD' },
  'Gibraltar': { rate: 40, currency: 'USD' },
  'China': { rate: 40, currency: 'USD' },
  'Eritrea': { rate: 20, currency: 'USD' },
  'Guinea': { rate: 20, currency: 'USD' },
  'Guinea-Bissau': { rate: 20, currency: 'USD' },
  'Ivory Coast': { rate: 25, currency: 'USD' },
  "Côte d'Ivoire": { rate: 25, currency: 'USD' },
  'Liberia': { rate: 20, currency: 'USD' },
  'Madagascar': { rate: 20, currency: 'USD' },
  'Mali': { rate: 20, currency: 'USD' },
  'Mauritania': { rate: 20, currency: 'USD' },
  'Niger': { rate: 20, currency: 'USD' },
  'Sao Tome and Principe': { rate: 20, currency: 'USD' },
  'Togo': { rate: 20, currency: 'USD' },
  'Armenia': { rate: 30, currency: 'USD' },
  'Kyrgyzstan': { rate: 30, currency: 'USD' },
  'Tajikistan': { rate: 30, currency: 'USD' },
  'Turkmenistan': { rate: 30, currency: 'USD' },
  'Bahrain': { rate: 30, currency: 'USD' },
  // European countries (USD)
  'Albania': { rate: 40, currency: 'USD' },
  'Andorra': { rate: 40, currency: 'USD' },
  'Austria': { rate: 50, currency: 'USD' },
  'Belarus': { rate: 40, currency: 'USD' },
  'Bosnia and Herzegovina': { rate: 40, currency: 'USD' },
  'Bulgaria': { rate: 40, currency: 'USD' },
  'Croatia': { rate: 40, currency: 'USD' },
  'Czech Republic': { rate: 40, currency: 'USD' },
  'Czechia': { rate: 40, currency: 'USD' },
  'Estonia': { rate: 40, currency: 'USD' },
  'Finland': { rate: 50, currency: 'USD' },
  'France': { rate: 50, currency: 'USD' },
  'Greece': { rate: 50, currency: 'USD' },
  'Hungary': { rate: 40, currency: 'USD' },
  'Iceland': { rate: 50, currency: 'USD' },
  'Kosovo': { rate: 40, currency: 'USD' },
  'Latvia': { rate: 50, currency: 'USD' },
  'Liechtenstein': { rate: 50, currency: 'USD' },
  'Lithuania': { rate: 50, currency: 'USD' },
  'Luxembourg': { rate: 50, currency: 'USD' },
  'North Macedonia': { rate: 40, currency: 'USD' },
  'Macedonia': { rate: 40, currency: 'USD' },
  'Moldova': { rate: 40, currency: 'USD' },
  'Monaco': { rate: 50, currency: 'USD' },
  'Montenegro': { rate: 40, currency: 'USD' },
  'Netherlands': { rate: 50, currency: 'USD' },
  'Romania': { rate: 40, currency: 'USD' },
  'San Marino': { rate: 50, currency: 'USD' },
  'Serbia': { rate: 40, currency: 'USD' },
  'Slovakia': { rate: 40, currency: 'USD' },
  'Slovenia': { rate: 40, currency: 'USD' },
  'Ukraine': { rate: 40, currency: 'USD' },
  'Uganda': { rate: 25, currency: 'USD' },
};

// Common country name variants returned by Koenig APIs that differ from DA_POLICY keys
const COUNTRY_ALIASES: Record<string, string> = {
  // UK variants
  'united kingdom': 'UK', 'great britain': 'UK', 'england': 'UK', 'britain': 'UK', 'gb': 'UK',
  'northern ireland': 'UK', 'wales': 'UK', 'scotland': 'UK',
  // USA variants
  'us': 'USA', 'america': 'USA', 'united states of america': 'USA', 'united states': 'USA',
  // UAE variants
  'uae': 'United Arab Emirates', 'emirates': 'United Arab Emirates', 'arab emirates': 'United Arab Emirates',
  // Asia
  'viet nam': 'Vietnam', 'vn': 'Vietnam',
  'republic of korea': 'South Korea', 'korea, south': 'South Korea', 'rok': 'South Korea',
  'dprk': 'North Korea', 'korea, north': 'North Korea',
  'holland': 'Netherlands',
  'czech republic': 'Czechia',
  'ivory coast': "Côte d'Ivoire", "cote d'ivoire": "Côte d'Ivoire", 'cote divoire': "Côte d'Ivoire",
  // Africa
  'dr congo': 'Democratic Republic of the Congo', 'drc': 'Democratic Republic of the Congo',
  'congo, democratic republic': 'Democratic Republic of the Congo',
  'congo, republic': 'Republic of Congo',
  'eswatini': 'Eswatini', 'swaziland': 'Eswatini',
  'cabo verde': 'Cabo Verde', 'cape verde': 'Cabo Verde',
  // Europe
  'north macedonia': 'North Macedonia', 'fyrom': 'North Macedonia',
  'bosnia': 'Bosnia and Herzegovina',
  'slovak republic': 'Slovakia',
  // Americas
  'dominican rep': 'Dominican Republic',
  'st kitts': 'Saint Kitts and Nevis',
  'st lucia': 'Saint Lucia',
  'st vincent': 'Saint Vincent and the Grenadines',
  'trinidad': 'Trinidad and Tobago',
  // Oceania
  'timor leste': 'East Timor', 'east timor': 'East Timor',
  // General
  'kingdom of saudi arabia': 'Saudi Arabia', 'ksa': 'Saudi Arabia',
  'kingdom of bahrain': 'Bahrain',
  'sultanate of oman': 'Oman',
  'state of qatar': 'Qatar',
  'state of kuwait': 'Kuwait',
  'new guinea': 'Papua New Guinea',
};

// Cities in Delhi-NCR where No DA is applicable per travel policy
const DELHI_NCR_CITIES = new Set([
  'delhi', 'new delhi', 'noida', 'greater noida', 'gurgaon', 'gurugram',
  'faridabad', 'ghaziabad', 'manesar', 'bahadurgarh', 'sonipat', 'rohtak',
  'dwarka', 'south delhi', 'north delhi', 'east delhi', 'west delhi',
  'central delhi', 'delhi ncr', 'ncr', 'ncr delhi',
]);

function getDaInfo(country: string, city?: string): DaPolicy & { allowed: boolean } {
  const norm = country.trim();

  // Direct lookup
  if (norm && DA_POLICY[norm]) return { ...DA_POLICY[norm], allowed: true };

  // Case-insensitive lookup
  if (norm) {
    const key = Object.keys(DA_POLICY).find(k => k.toLowerCase() === norm.toLowerCase());
    if (key) return { ...DA_POLICY[key], allowed: true };
  }

  // Common country name variants (e.g. "United Kingdom" → "UK")
  if (norm) {
    const aliasTarget = COUNTRY_ALIASES[norm.toLowerCase()];
    if (aliasTarget && DA_POLICY[aliasTarget]) return { ...DA_POLICY[aliasTarget], allowed: true };
  }

  // Fallback: try city name (handles city-as-key entries like 'Amsterdam', or when city was put in country field)
  if (city) {
    const cityNorm = city.trim();
    if (DA_POLICY[cityNorm]) return { ...DA_POLICY[cityNorm], allowed: true };
    const cityKey = Object.keys(DA_POLICY).find(k => k.toLowerCase() === cityNorm.toLowerCase());
    if (cityKey) return { ...DA_POLICY[cityKey], allowed: true };
    // Infer country from city name and retry
    const inferredCountry = inferCountryFromCity(cityNorm);
    if (inferredCountry && DA_POLICY[inferredCountry]) return { ...DA_POLICY[inferredCountry], allowed: true };
  }

  return { rate: 0, currency: 'USD', allowed: false };
}

function formatDaCurrency(amount: number, currency: string): string {
  if (currency === 'INR') return `₹ ${amount.toLocaleString('en-IN')}`;
  if (currency === 'AED') return `AED ${amount}`;
  return `USD ${amount}`;
}

// ── Location autocomplete (OpenStreetMap Nominatim — no API key needed) ────────

interface LocSuggestion { display_name: string; lat: string; lon: string; }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function LocationAutocomplete({
  value, onChange, onSelect, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (name: string, lat: number, lon: number) => void;
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
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=6&addressdetails=0`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data: LocSuggestion[] = await res.json();
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
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
          placeholder={placeholder ?? 'Search location…'}
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && <Loader2 size={13} className="absolute right-2.5 top-2.5 animate-spin text-blue-400" />}
        {!loading && value && (
          <button type="button" onClick={() => { onChange(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
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
                onSelect(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
                onChange(s.display_name);
                setSuggestions([]);
                setOpen(false);
              }}
            >
              <MapPin size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2 text-gray-700">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Currency list (all major world currencies) ─────────────────────────────────
const CURRENCIES = [
  // Most used first
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee' },
  { code: 'USD', symbol: '$',    name: 'US Dollar' },
  { code: 'EUR', symbol: '€',    name: 'Euro' },
  { code: 'GBP', symbol: '£',    name: 'British Pound' },
  { code: 'AED', symbol: 'AED',  name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen' },
  { code: 'SAR', symbol: 'SAR',  name: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'QAR',  name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'KWD',  name: 'Kuwaiti Dinar' },
  { code: 'BHD', symbol: 'BHD',  name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'OMR',  name: 'Omani Rial' },
  { code: 'MYR', symbol: 'RM',   name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',    name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp',   name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱',    name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫',    name: 'Vietnamese Dong' },
  { code: 'KRW', symbol: '₩',    name: 'South Korean Won' },
  { code: 'CNY', symbol: '¥',    name: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$',  name: 'Hong Kong Dollar' },
  { code: 'TWD', symbol: 'NT$',  name: 'Taiwan Dollar' },
  { code: 'NZD', symbol: 'NZ$',  name: 'New Zealand Dollar' },
  { code: 'CHF', symbol: 'Fr',   name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr',   name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr',   name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr',   name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł',   name: 'Polish Zloty' },
  { code: 'CZK', symbol: 'Kč',   name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft',   name: 'Hungarian Forint' },
  { code: 'RON', symbol: 'lei',  name: 'Romanian Leu' },
  { code: 'BGN', symbol: 'лв',   name: 'Bulgarian Lev' },
  { code: 'HRK', symbol: 'kn',   name: 'Croatian Kuna' },
  { code: 'RUB', symbol: '₽',    name: 'Russian Ruble' },
  { code: 'UAH', symbol: '₴',    name: 'Ukrainian Hryvnia' },
  { code: 'TRY', symbol: '₺',    name: 'Turkish Lira' },
  { code: 'ILS', symbol: '₪',    name: 'Israeli Shekel' },
  { code: 'EGP', symbol: 'E£',   name: 'Egyptian Pound' },
  { code: 'ZAR', symbol: 'R',    name: 'South African Rand' },
  { code: 'NGN', symbol: '₦',    name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'Ksh',  name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: 'GH₵',  name: 'Ghanaian Cedi' },
  { code: 'MAD', symbol: 'MAD',  name: 'Moroccan Dirham' },
  { code: 'TZS', symbol: 'TSh',  name: 'Tanzanian Shilling' },
  { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$',  name: 'Mexican Peso' },
  { code: 'ARS', symbol: '$',    name: 'Argentine Peso' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/.',  name: 'Peruvian Sol' },
  { code: 'PKR', symbol: '₨',    name: 'Pakistani Rupee' },
  { code: 'BDT', symbol: '৳',    name: 'Bangladeshi Taka' },
  { code: 'LKR', symbol: 'Rs',   name: 'Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'Rs',   name: 'Nepalese Rupee' },
  { code: 'MMK', symbol: 'K',    name: 'Myanmar Kyat' },
  { code: 'KHR', symbol: '៛',    name: 'Cambodian Riel' },
  { code: 'LAK', symbol: '₭',    name: 'Lao Kip' },
  { code: 'MNT', symbol: '₮',    name: 'Mongolian Tugrik' },
  { code: 'JOD', symbol: 'JOD',  name: 'Jordanian Dinar' },
  { code: 'LBP', symbol: 'LBP',  name: 'Lebanese Pound' },
  { code: 'IQD', symbol: 'IQD',  name: 'Iraqi Dinar' },
  { code: 'IRR', symbol: '﷼',    name: 'Iranian Rial' },
  { code: 'AFN', symbol: '؋',    name: 'Afghan Afghani' },
  { code: 'GEL', symbol: '₾',    name: 'Georgian Lari' },
  { code: 'AMD', symbol: '֏',    name: 'Armenian Dram' },
  { code: 'AZN', symbol: '₼',    name: 'Azerbaijani Manat' },
  { code: 'KZT', symbol: '₸',    name: 'Kazakhstani Tenge' },
  { code: 'UZS', symbol: 'сум',  name: 'Uzbekistani Som' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface TravelBill {
  id: string;
  date: string;
  journeyType: string;
  travelType: string;
  from: string;
  fromLat?: number;
  fromLon?: number;
  to: string;
  toLat?: number;
  toLon?: number;
  distance: string;
  amount: number;
  currency: string;
  receipt: string;
}

const JOURNEY_TYPES = [
  { value: '', label: '— Select Journey Type —' },
  { value: 'Home → Venue',             label: 'Home → Venue' },
  { value: 'Venue → Home',             label: 'Venue → Home' },
  { value: 'Venue → Accommodation',    label: 'Venue → Accommodation' },
  { value: 'Accommodation → Venue',    label: 'Accommodation → Venue' },
  { value: 'Accommodation → Airport',  label: 'Accommodation → Airport' },
  { value: 'Airport → Accommodation',  label: 'Airport → Accommodation' },
  { value: 'Airport → Venue',          label: 'Airport → Venue' },
  { value: 'Venue → Airport',          label: 'Venue → Airport' },
];

// Valid journey types per date position in an assignment
const VALID_JOURNEY_BY_POSITION: Record<string, string[]> = {
  departure:  ['Home → Venue', 'Home → Airport', 'Venue → Airport', 'Airport → Accommodation', 'Airport → Venue'],
  first:      ['Airport → Accommodation', 'Airport → Venue', 'Home → Venue', 'Venue → Accommodation'],
  mid:        ['Venue → Accommodation', 'Accommodation → Venue'],
  last:       ['Venue → Airport', 'Accommodation → Airport', 'Venue → Accommodation', 'Accommodation → Venue'],
  returnDay:  ['Venue → Home', 'Accommodation → Airport', 'Airport → Accommodation', 'Venue → Airport'],
};

// ── Auto-fill From/To based on journey type ───────────────────────────────────
// Derives suggested from/to location strings from Step 2 (venue), Step 5 (airport),
// Step 6 (accommodation) and the trainer profile (home).
function deriveJourneyLocations(
  journeyType: string,
  date: string,
  assignments: Assignment[],
  lodgingEntries: LodgingEntry[],
  pmsFlights: FlightRecord[],
  pmsDetails: import('../types').PmsEmployeeDetails | null | undefined,
): { from: string; to: string; fromSource: string; toSource: string } {

  // Venue: assignment covering the date, else first assignment
  function getVenue(): { loc: string; src: string } {
    const asgn = date
      ? assignments.find(a => a.startDate && a.endDate && date >= a.startDate && date <= a.endDate)
      : assignments[0];
    if (!asgn) return { loc: '', src: '' };
    const venue = [asgn.trainingVenue || asgn.venueName, asgn.city].filter(Boolean).join(', ');
    return { loc: venue, src: 'Step 2 — Assignment Venue' };
  }

  // Accommodation: lodging entry covering the date, else first entry
  function getAccommodation(): { loc: string; src: string } {
    const entry = date
      ? lodgingEntries.find(l => l.checkIn && l.checkOut && date >= l.checkIn && date <= l.checkOut)
      : lodgingEntries[0];
    if (!entry) return { loc: '', src: '' };
    const loc = [entry.hotelName, entry.city].filter(Boolean).join(', ');
    return { loc, src: 'Step 6 — Accommodation' };
  }

  // Airport: flight on or nearest to the travel date
  // Departing TO airport (Venue/Accom → Airport): use from_city of that outbound flight
  // Arriving FROM airport (Airport → Venue/Accom): use to_city of that inbound flight
  function getAirport(direction: 'arriving' | 'departing'): { loc: string; src: string } {
    if (!pmsFlights.length) return { loc: '', src: '' };
    // Prefer a flight on the exact travel date
    let flight = date ? pmsFlights.find(f => parseDT(f.departure_date) === date) : undefined;
    if (!flight) {
      // Fall back to nearest flight chronologically
      const withDate = pmsFlights.filter(f => parseDT(f.departure_date));
      if (direction === 'arriving') {
        // Arriving: find most recent flight before or on the date
        flight = withDate.filter(f => !date || parseDT(f.departure_date) <= date)
          .sort((a, b) => parseDT(b.departure_date).localeCompare(parseDT(a.departure_date)))[0];
      } else {
        // Departing: find next flight on or after the date
        flight = withDate.filter(f => !date || parseDT(f.departure_date) >= date)
          .sort((a, b) => parseDT(a.departure_date).localeCompare(parseDT(b.departure_date)))[0];
      }
    }
    if (!flight) return { loc: '', src: '' };
    // Arriving at destination airport: to_city; departing from home airport: from_city
    const city = direction === 'arriving' ? flight.to_city : flight.from_city;
    const airline = flight.airlines_name ? ` (${flight.airlines_name})` : '';
    return {
      loc: city ? `${city} Airport${airline}` : '',
      src: 'Step 5 — Flight & Travel Details',
    };
  }

  // Home: from PMS profile city/state
  function getHome(): { loc: string; src: string } {
    if (!pmsDetails) return { loc: '', src: '' };
    const parts = [pmsDetails.city_name, pmsDetails.state_name]
      .filter(v => v && String(v).trim() && String(v).trim().toLowerCase() !== 'null')
      .map(v => String(v!).trim());
    return { loc: parts.join(', '), src: 'Profile — Home City' };
  }

  const venue  = getVenue();
  const accom  = getAccommodation();
  const home   = getHome();

  switch (journeyType) {
    case 'Home → Venue': {
      const airport = getAirport('departing');
      return { from: home.loc, to: venue.loc, fromSource: home.src, toSource: venue.src || airport.src };
    }
    case 'Venue → Home': {
      const airport = getAirport('arriving');
      return { from: venue.loc, to: home.loc, fromSource: venue.src, toSource: home.src || airport.src };
    }
    case 'Venue → Accommodation':
      return { from: venue.loc, to: accom.loc, fromSource: venue.src, toSource: accom.src };
    case 'Accommodation → Venue':
      return { from: accom.loc, to: venue.loc, fromSource: accom.src, toSource: venue.src };
    case 'Accommodation → Airport': {
      const airport = getAirport('departing');
      return { from: accom.loc, to: airport.loc, fromSource: accom.src, toSource: airport.src };
    }
    case 'Airport → Accommodation': {
      const airport = getAirport('arriving');
      return { from: airport.loc, to: accom.loc, fromSource: airport.src, toSource: accom.src };
    }
    case 'Airport → Venue': {
      const airport = getAirport('arriving');
      return { from: airport.loc, to: venue.loc, fromSource: airport.src, toSource: venue.src };
    }
    case 'Venue → Airport': {
      const airport = getAirport('departing');
      return { from: venue.loc, to: airport.loc, fromSource: venue.src, toSource: airport.src };
    }
    default:
      return { from: '', to: '', fromSource: '', toSource: '' };
  }
}

function validateJourneyType(
  journeyType: string,
  date: string,
  assignments: Assignment[],
): { valid: boolean; blocked: boolean; message: string; dateContext: string } {
  if (!date || !journeyType) return { valid: true, blocked: false, message: '', dateContext: '' };

  const coreAsgn = assignments.find(
    a => a.startDate && a.endDate && date >= a.startDate && date <= a.endDate,
  );
  const depAsgn = !coreAsgn
    ? assignments.find(a => a.startDate && addDays(a.startDate, -1) === date)
    : null;
  const retAsgn = !coreAsgn && !depAsgn
    ? assignments.find(a => a.endDate && addDays(a.endDate, +1) === date)
    : null;

  if (!coreAsgn && !depAsgn && !retAsgn) {
    return {
      valid: false,
      blocked: true,
      message: 'No assignment covers this date. Travel bills can only be added for dates within an assignment range.',
      dateContext: 'no assignment',
    };
  }

  let position = '';
  if (depAsgn)                                                        position = 'departure';
  else if (retAsgn)                                                   position = 'returnDay';
  else if (coreAsgn && date === coreAsgn.startDate)                  position = 'first';
  else if (coreAsgn && date === coreAsgn.endDate)                    position = 'last';
  else                                                                position = 'mid';

  const dateLabels: Record<string, string> = {
    departure:  'departure day (day before assignment starts)',
    first:      'first day of assignment (arrival)',
    mid:        'mid-assignment day',
    last:       'last day of assignment (departure)',
    returnDay:  'return day (day after assignment ends)',
  };
  const dateContext = dateLabels[position] ?? position;

  const allowed = VALID_JOURNEY_BY_POSITION[position] ?? [];
  if (!allowed.includes(journeyType)) {
    return {
      valid: false,
      blocked: true,
      message: `"${journeyType}" is not valid for a ${dateContext}. Allowed: ${allowed.filter(j => JOURNEY_TYPES.find(jt => jt.value === j)).join(', ')}.`,
      dateContext,
    };
  }

  return { valid: true, blocked: false, message: `✓ Valid for ${dateContext}`, dateContext };
}

interface MiscExpense {
  id: string;
  expenseType: string;
  date: string;
  amount: number;
  currency: string;
  remarks: string;
  receipt: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white';
const selectCls = inputCls;

function SectionTitle({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-blue-700">{children}</h3>
      {badge}
    </div>
  );
}

// ── Add/Edit Assignment Modal ──────────────────────────────────────────────────

interface AssignmentModalProps {
  open: boolean;
  initial?: Partial<Assignment>;
  fromDate: string;
  toDate: string;
  koenigCountries: KoenigCountry[];
  countriesLoading: boolean;
  onSave: (a: Assignment) => void;
  onClose: () => void;
}

function AssignmentModal({ open, initial, fromDate, toDate, koenigCountries, countriesLoading, onSave, onClose }: AssignmentModalProps) {
  const [form, setForm] = useState<Partial<Assignment>>({
    courseName: '', clientName: '', city: '', country: 'India',
    hotelName: '', venueName: '', trainingVenue: '', distanceKm: '',
    startDate: fromDate, endDate: toDate, assignmentId: '',
    batchType: '', batchCategory: '', deliveryMode: '',
    trainerName: '', trainerEmail: '',
    ...initial,
  });

  useEffect(() => {
    setForm({
      courseName: '', clientName: '', city: '', country: 'India',
      hotelName: '', venueName: '', trainingVenue: '', distanceKm: '',
      startDate: fromDate, endDate: toDate, assignmentId: '',
      batchType: '', batchCategory: '', deliveryMode: '',
      trainerName: '', trainerEmail: '',
      ...initial,
    });
  }, [open, initial, fromDate, toDate]);

  if (!open) return null;

  function save() {
    if (!form.courseName && !form.clientName) return;
    onSave({
      id: initial?.id ?? uid(),
      source: initial?.source ?? 'manual',
      courseName: form.courseName || '',
      clientName: form.clientName || '',
      city: form.city || '',
      country: form.country || 'India',
      hotelName: form.hotelName || '',
      venueName: form.venueName || form.trainingVenue || form.city || '',
      trainingVenue: form.trainingVenue || form.venueName || '',
      distanceKm: form.distanceKm || '',
      startDate: form.startDate || fromDate,
      endDate: form.endDate || toDate,
      assignmentId: form.assignmentId || '',
      batchType: form.batchType || '',
      batchCategory: form.batchCategory || '',
      deliveryMode: form.deliveryMode || '',
      trainerName: form.trainerName || '',
      trainerEmail: form.trainerEmail || '',
      manager: form.manager || '',
      totalPax: form.totalPax || '',
    });
    onClose();
  }

  function set(k: keyof Assignment, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">{initial?.id ? 'Edit Assignment' : 'Add Assignment'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Course / Training Name *</label>
              <input className={inputCls} placeholder="e.g. AWS Solutions Architect" value={form.courseName || ''}
                onChange={e => set('courseName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client / Company Name</label>
              <input className={inputCls} placeholder="e.g. TCS, Infosys" value={form.clientName || ''}
                onChange={e => set('clientName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assignment ID</label>
              <input className={inputCls} placeholder="e.g. KS-2026-001" value={form.assignmentId || ''}
                onChange={e => set('assignmentId', e.target.value)} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input type="date" className={inputCls} value={form.startDate || ''} min={fromDate} max={toDate}
                onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input type="date" className={inputCls} value={form.endDate || ''} min={form.startDate || fromDate} max={toDate}
                onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>

          {/* Row 3 - Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Country {countriesLoading && <span className="text-blue-400">(loading…)</span>}
              </label>
              <select className={selectCls} value={form.country || 'India'} onChange={e => set('country', e.target.value)}>
                {(koenigCountries.length > 0
                  ? koenigCountries.map(c => c.CountryName!)
                  : COUNTRIES
                ).map(c => (
                  <option key={c} value={c}>
                    {c}{DA_POLICY[c] ? ` — ${DA_POLICY[c].currency === 'INR' ? '₹' : DA_POLICY[c].currency} ${DA_POLICY[c].rate}/day` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
              {form.country === 'India' ? (
                <select className={selectCls} value={form.city || ''} onChange={e => set('city', e.target.value)}>
                  <option value="">Select city</option>
                  {CITIES_IN.map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input className={inputCls} placeholder="City name" value={form.city || ''} onChange={e => set('city', e.target.value)} />
              )}
            </div>
          </div>

          {/* Row 4 - Venue */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hotel / Accommodation</label>
              <input className={inputCls} placeholder="e.g. Hotel Lemon Tree" value={form.hotelName || ''}
                onChange={e => set('hotelName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Training Venue</label>
              <input className={inputCls} placeholder="e.g. Koenig Delhi Office" value={form.trainingVenue || ''}
                onChange={e => set('trainingVenue', e.target.value)} />
            </div>
          </div>

          <div className="w-1/2 pr-1.5">
            <label className="block text-xs font-medium text-gray-500 mb-1">Distance (Hotel → Venue)</label>
            <input className={inputCls} placeholder="e.g. 8.5 km" value={form.distanceKm || ''}
              onChange={e => set('distanceKm', e.target.value)} />
          </div>

          {/* Row 5 - Batch Type + Mode */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100 mt-1">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Batch Type</label>
              <select className={selectCls} value={form.batchType || ''} onChange={e => set('batchType', e.target.value)}>
                <option value="">— Select —</option>
                <option value="ILO">ILO — Instructor-Led Online</option>
                <option value="ILT">ILT — Instructor-Led Training (Offline)</option>
                <option value="FMAT">FMAT — Face-to-Face (Offline)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Mode</label>
              <select className={selectCls} value={form.deliveryMode || ''} onChange={e => set('deliveryMode', e.target.value)}>
                <option value="">— Select —</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={save}
            disabled={!form.courseName && !form.clientName}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg flex items-center gap-2">
            <CheckCircle2 size={14} />
            {initial?.id ? 'Update Assignment' : 'Add Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CreateTADABill({ currentUser }: { currentUser?: User }) {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fetched, setFetched] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'success' | 'empty' | 'error'>('idle');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filterBatchType, setFilterBatchType] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | undefined>();
  const [showAssignmentTable, setShowAssignmentTable] = useState(true);
  const today = todayISO();

  // Filtered view of assignments for the Step 2 table (does NOT affect DA calc)
  const filteredAssignments = assignments.filter(a => {
    if (filterBatchType && (a.batchType || '') !== filterBatchType) return false;
    if (filterMode && (a.deliveryMode || '') !== filterMode) return false;
    return true;
  });

  // Unique values for filter dropdowns (from loaded assignments)
  const batchTypeOptions = Array.from(new Set(assignments.map(a => a.batchType).filter(Boolean))) as string[];
  const modeOptions      = Array.from(new Set(assignments.map(a => a.deliveryMode).filter(Boolean))) as string[];

  // Travel bills
  const [travelBills, setTravelBills] = useState<TravelBill[]>([]);
  const [travelDraft, setTravelDraft] = useState<Partial<TravelBill>>({
    date: '', journeyType: '', travelType: 'Cab', from: '', to: '', distance: '', amount: 0, currency: 'INR', receipt: '',
  });
  const [distanceCalculating, setDistanceCalculating] = useState(false);
  // Always-fresh ref so geocode callbacks read latest state after debounce
  const travelDraftRef = useRef<Partial<TravelBill>>({});
  useEffect(() => { travelDraftRef.current = travelDraft; });

  // Auto-calculate distance whenever From or To text changes.
  // • If both lat/lon are already known (user picked from autocomplete): handled by onSelect.
  // • Otherwise geocode the missing endpoint(s) via Nominatim, then apply haversine.
  useEffect(() => {
    const from = (travelDraft.from || '').trim();
    const to   = (travelDraft.to   || '').trim();
    if (!from || !to) return;

    // Both coords already present — nothing to geocode (onSelect already computed distance)
    if (travelDraft.fromLat != null && travelDraft.fromLon != null &&
        travelDraft.toLat   != null && travelDraft.toLon   != null) return;

    // Geocode missing coord(s) after 700 ms debounce (handles rapid typing)
    let dead = false;
    const timer = setTimeout(async () => {
      const cur  = travelDraftRef.current;
      const curF = (cur.from || '').trim();
      const curT = (cur.to   || '').trim();
      if (!curF || !curT) return;

      // After debounce, user may have selected from dropdown — coords already available
      if (cur.fromLat != null && cur.fromLon != null &&
          cur.toLat   != null && cur.toLon   != null) {
        const dist = `${haversineKm(cur.fromLat, cur.fromLon, cur.toLat, cur.toLon).toFixed(1)} km`;
        setTravelDraft(p => p.distance === dist ? p : { ...p, distance: dist });
        return;
      }

      if (!dead) setDistanceCalculating(true);
      try {
        let fLat = cur.fromLat, fLon = cur.fromLon;
        let tLat = cur.toLat,   tLon = cur.toLon;

        if (fLat == null || fLon == null) {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(curF)}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'en' } },
          );
          const d: LocSuggestion[] = await r.json();
          if (d[0]) { fLat = parseFloat(d[0].lat); fLon = parseFloat(d[0].lon); }
        }

        if (!dead && (tLat == null || tLon == null)) {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(curT)}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'en' } },
          );
          const d: LocSuggestion[] = await r.json();
          if (d[0]) { tLat = parseFloat(d[0].lat); tLon = parseFloat(d[0].lon); }
        }

        if (!dead && fLat != null && fLon != null && tLat != null && tLon != null) {
          const dist = `${haversineKm(fLat, fLon, tLat, tLon).toFixed(1)} km`;
          setTravelDraft(p => ({
            ...p,
            fromLat: fLat ?? p.fromLat, fromLon: fLon ?? p.fromLon,
            toLat:   tLat ?? p.toLat,   toLon:   tLon ?? p.toLon,
            distance: dist,
          }));
        }
      } catch { /* ignore network errors / aborts */ }
      if (!dead) setDistanceCalculating(false);
    }, 700);

    return () => { dead = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelDraft.from, travelDraft.to]);

  // Misc expenses
  const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
  const [miscDraft, setMiscDraft] = useState<Partial<MiscExpense>>({
    expenseType: 'Other', date: '', amount: 0, currency: 'INR', remarks: '', receipt: '',
  });

  // Advance taken
  interface AdvanceTaken { id: string; date: string; amount: number; currency: string; purpose: string; reference: string; }
  const [advances, setAdvances] = useState<AdvanceTaken[]>([]);
  const [advanceDraft, setAdvanceDraft] = useState<Partial<AdvanceTaken>>({
    date: '', amount: 0, currency: 'INR', purpose: '', reference: '',
  });

  const [employeeRemarks, setEmployeeRemarks] = useState('');

  // Lodging state
  const [lodgingEntries, setLodgingEntries] = useState<LodgingEntry[]>([]);
  const [lodgingDraft, setLodgingDraft] = useState<Partial<LodgingEntry>>({
    hotelName: '', city: '', roomNo: '', checkIn: fromDate, checkOut: '', nights: 0, ratePerNight: 0, receipt: '',
  });
  const [pmsAccom, setPmsAccom] = useState<AccommodationRecord[]>([]);
  const [accomLoading, setAccomLoading] = useState(false);
  const [accomError, setAccomError] = useState('');
  const [importedAccom, setImportedAccom] = useState<Set<string>>(new Set());

  // Leave dates — trainer-marked leave days within the claim period
  const [leaveDates, setLeaveDates] = useState<Set<string>>(new Set());
  // PMS leave records (api_key=237)
  const [pmsLeaves, setPmsLeaves] = useState<LeaveRecord[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesError, setLeavesError] = useState('');

  function toggleLeaveDate(iso: string) {
    setLeaveDates(prev => {
      const next = new Set(prev);
      next.has(iso) ? next.delete(iso) : next.add(iso);
      return next;
    });
  }

  // Flight bills state (api_key=256)
  const [pmsFlights, setPmsFlights] = useState<FlightRecord[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState('');
  const [importedTripIds, setImportedTripIds] = useState<Set<string>>(new Set());

  // Country list from apikey=223
  const [koenigCountries, setKoenigCountries] = useState<KoenigCountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  // Advance list from apikey=259
  const [pmsAdvances, setPmsAdvances] = useState<RawAdvanceRecord[]>([]);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [advancesError, setAdvancesError] = useState('');
  const [importedAdvanceIds, setImportedAdvanceIds] = useState<Set<string>>(new Set());

  // Fetch country list once on mount (apikey=223)
  useEffect(() => {
    setCountriesLoading(true);
    fetchCountryList()
      .then(list => setKoenigCountries(list))
      .catch(() => {/* silent — fallback to hardcoded COUNTRIES */})
      .finally(() => setCountriesLoading(false));
  }, []);

  // Reset all PMS data whenever date range changes so stale data never shows
  useEffect(() => {
    setFetched(false);
    setFetchStatus('idle');
    setLeaveDates(new Set());
    setPmsLeaves([]); setLeavesError('');
    setFetchError('');
    setAssignments([]);
    setPmsFlights([]);
    setFlightsError('');
    setImportedTripIds(new Set());
    setPmsAccom([]);
    setAccomError('');
    setImportedAccom(new Set());
    setPmsAdvances([]);
    setAdvancesError('');
    setImportedAdvanceIds(new Set());
  }, [fromDate, toDate]);

  // ── Fetch handler — fires all three APIs in parallel ─────────────────────────

  const handleFetch = useCallback(async () => {
    if (!fromDate || !toDate || toDate < fromDate) return;

    const empCode = (currentUser?.trainerId ?? '').replace(/^EMP-/i, '').trim();

    // Reset everything before fetching
    setFetchLoading(true);
    setFetchError('');
    setFetched(false);
    setFetchStatus('idle');
    setAssignments([]);
    setPmsFlights([]);    setFlightsError('');    setImportedTripIds(new Set());
    setPmsAccom([]);      setAccomError('');      setImportedAccom(new Set());
    setPmsLeaves([]);     setLeavesError('');
    setPmsAdvances([]);   setAdvancesError('');   setImportedAdvanceIds(new Set());
    setLeaveDates(new Set());
    setFlightsLoading(true);
    setAccomLoading(true);
    setLeavesLoading(true);
    setAdvancesLoading(true);

    // Launch five API calls simultaneously
    const [assignResult, flightResult, accomResult, leavesResult, advancesResult] = await Promise.allSettled([
      fetchTrainerAssignments(fromDate, toDate, empCode),
      empCode ? fetchTrainerFlights(empCode, currentUser?.email) : Promise.resolve<FlightRecord[]>([]),
      empCode ? fetchTrainerAccommodation(empCode) : Promise.resolve<AccommodationRecord[]>([]),
      empCode ? fetchEmployeeLeaves(empCode, fromDate, toDate) : Promise.resolve<LeaveRecord[]>([]),
      empCode ? fetchEmployeeAdvances(empCode) : Promise.resolve<RawAdvanceRecord[]>([]),
    ]);

    // ── Assignments ───────────────────────────────────────────────────────────
    if (assignResult.status === 'fulfilled') {
      const raw = assignResult.value;

      // Helper: extract best available dates from a raw record.
      // Priority order MUST match mapRawToAssignment so filtering and display use the same date.
      function resolveDates(r: RawTrainerAssignment): { startDate: string; endDate: string } {
        let startDate = '';
        let endDate = '';

        // Priority 1: known separate date fields — "StarDate" is apikey=208's typo for StartDate
        startDate = pickDate(r,
          'StarDate', 'start_date', 'StartDate',
          'AssignmentStartDate', 'assignment_start_date',
          'BatchStartDate', 'batch_start_date',
          'TrainingStartDate', 'training_start_date',
          'BatchFromDate', 'batch_from_date',
          'From_Date', 'from_date', 'FromDate',
          'DateFrom', 'date_from',
          'BatchFrom', 'batch_from',
          'AssignmentFrom', 'assignment_from',
        );
        endDate = pickDate(r,
          'end_date', 'EndDate',
          'AssignmentEndDate', 'assignment_end_date',
          'BatchEndDate', 'batch_end_date',
          'TrainingEndDate', 'training_end_date',
          'BatchToDate', 'batch_to_date',
          'To_Date', 'to_date', 'ToDate',
          'DateTo', 'date_to',
          'BatchTo', 'batch_to',
          'AssignmentTo', 'assignment_to',
        );

        // Priority 2: combined training_dates string (e.g. "23-Jul-2026 to 30-Jul-2026")
        if (!startDate || !endDate) {
          const td = (r.training_dates || r.TrainingDates) as string | null;
          if (td) {
            const parsed = parseTrainingDates(td);
            if (!startDate && parsed.startDate) startDate = parsed.startDate;
            if (!endDate   && parsed.endDate)   endDate   = parsed.endDate;
          }
        }

        // Priority 3: keyword scan ALL string fields — catches any unknown API field names
        if (!startDate || !endDate) {
          const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
          for (const [key, val] of Object.entries(r)) {
            if (!val) continue;
            const k   = key.toLowerCase();
            // Skip known combined-date fields (already handled above)
            if (k === 'training_dates' || k === 'trainingdates') continue;
            const strVal = typeof val === 'string' ? val : String(val);
            const parsed = parseApiDate(strVal);
            if (!parsed || !ISO_RE.test(parsed)) continue;
            if (!startDate && (k.includes('start') || k.includes('from') || k.includes('begin')))
              startDate = parsed;
            if (!endDate && (k.includes('end') || k.includes('to') || k.includes('finish') || k.includes('close')))
              endDate = parsed;
          }
        }

        return { startDate, endDate };
      }

      const filtered = raw.filter(r => {
        const { startDate, endDate } = resolveDates(r);
        // If no date info found in any field, exclude — we can't place it in any date range
        if (!startDate && !endDate) return false;
        const s = startDate || fromDate;
        const e = endDate   || toDate;
        // Overlap: assignment must intersect the selected date range
        return s <= toDate && e >= fromDate;
      });

      // Show only FMAT (Offline) and ILT (Offline) batch types in Step 2.
      // ILO (Online) is hidden until further instruction.
      const validBatch = filtered.filter(r => {
        const bdm = (pickStr(r, 'batch_delivery_mode', 'BatchDeliveryMode', 'Batch_type') || '').toUpperCase().trim();
        if (!bdm) return true; // no batch type info — keep and let display show blank
        return bdm === 'FMAT' || bdm.startsWith('FMAT')
          || bdm === 'ILT'  || bdm.startsWith('ILT');
      });

      // Map AFTER filtering — fallback dates only used for display, not for filtering
      const mapped = validBatch.map(r => mapRawToAssignment(r, fromDate, toDate));
      setAssignments(mapped);
      setFetchStatus(mapped.length > 0 ? 'success' : 'empty');
    } else {
      const msg = (assignResult.reason as Error)?.message || 'Assignment fetch failed';
      setFetchError(msg);
      setFetchStatus('error');
    }

    // ── Flights ───────────────────────────────────────────────────────────────
    if (flightResult.status === 'fulfilled') {
      const all = flightResult.value;
      // Keep only flights whose departure_date falls within [fromDate, toDate]
      // Include cancelled flights so user can see them (styled differently)
      const inRange = all.filter(f => {
        const dep = parseDT(f.departure_date);
        if (!dep) return false;
        return dep >= fromDate && dep <= toDate;
      });
      // Sort oldest → newest by departure date
      inRange.sort((a, b) => parseDT(a.departure_date).localeCompare(parseDT(b.departure_date)));
      setPmsFlights(inRange);
      if (all.length > 0 && inRange.length === 0) {
        setFlightsError(`${all.length} travel record(s) found in PMS but none depart within ${fmt(fromDate)} → ${fmt(toDate)}.`);
      }
    } else {
      const msg = (flightResult.reason as Error)?.message || 'Could not fetch flights';
      setFlightsError(msg);
    }

    // ── Accommodation ─────────────────────────────────────────────────────────
    if (accomResult.status === 'fulfilled') {
      const all = accomResult.value;
      // Keep only stays whose check-in date falls within [fromDate, toDate]
      const inRange = all.filter(r => {
        const ci = accomDT(r.CheckInDate);
        if (!ci) return false; // no parseable check-in — skip
        return ci >= fromDate && ci <= toDate;
      });
      // Sort oldest → newest by check-in date
      inRange.sort((a, b) => accomDT(a.CheckInDate).localeCompare(accomDT(b.CheckInDate)));
      setPmsAccom(inRange);
      if (all.length > 0 && inRange.length === 0) {
        setAccomError(`${all.length} stay(s) found in PMS but none have check-in within ${fmt(fromDate)} → ${fmt(toDate)}.`);
      }
    } else {
      const msg = (accomResult.reason as Error)?.message || 'Could not fetch accommodation';
      setAccomError(msg);
    }

    // ── Leaves (api_key=237) ──────────────────────────────────────────────────
    if (leavesResult.status === 'fulfilled') {
      const all = leavesResult.value;
      // Client-side safety filter: keep only leaves that overlap the selected range
      // (server already filters, but guard against stale/unfiltered responses)
      const inRange = all.filter(r => {
        const fd = parseLeaveDate(r.from_date);
        const td = parseLeaveDate(r.to_date) || fd;
        if (!fd) return false;
        // Overlap: leave starts before range end AND leave ends after range start
        return fd <= toDate && td >= fromDate;
      });
      inRange.sort((a, b) =>
        parseLeaveDate(a.from_date).localeCompare(parseLeaveDate(b.from_date))
      );
      setPmsLeaves(inRange);

      // Auto-mark approved/sanctioned leaves on the date grid
      const autoMarked = new Set<string>();
      inRange.forEach(r => {
        if (!isApprovedLeave(r.leave_status)) return;
        const fd = parseLeaveDate(r.from_date);
        const td = parseLeaveDate(r.to_date) || fd;
        if (!fd) return;
        // Expand every calendar day in [fd, td] that falls inside [fromDate, toDate].
        // Use date-only strings (no 'T00:00:00') so JS parses them as UTC, avoiding
        // timezone shift (e.g. IST midnight local → previous day UTC).
        const cur = new Date(fd);
        const end = new Date(td);
        while (cur <= end) {
          const iso = cur.toISOString().slice(0, 10);
          if (iso >= fromDate && iso <= toDate) autoMarked.add(iso);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      });
      if (autoMarked.size > 0) setLeaveDates(autoMarked);
    } else {
      const err = leavesResult.reason as Error;
      const msg = err?.message || 'Could not fetch leave records';
      // Surface HTTP errors clearly; silently ignore "no data" non-errors
      if (!msg.toLowerCase().includes('no record') && !msg.toLowerCase().includes('not found')) {
        setLeavesError(msg);
      }
    }

    // ── Advances (apikey=259) ─────────────────────────────────────────────────
    if (advancesResult.status === 'fulfilled') {
      const all = advancesResult.value;
      // Filter: keep advances whose AdvanceDate falls within [fromDate, toDate]
      // If date is missing, include the record so trainer can review
      const inRange = all.filter(r => {
        const d = parseDT(r.AdvanceDate);
        if (!d) return true; // no date — include for manual review
        return d >= fromDate && d <= toDate;
      });
      // Sort oldest → newest
      inRange.sort((a, b) => {
        const da = parseDT(a.AdvanceDate) || '';
        const db = parseDT(b.AdvanceDate) || '';
        return da.localeCompare(db);
      });
      setPmsAdvances(inRange);
      if (all.length > 0 && inRange.length === 0) {
        setAdvancesError(`${all.length} advance record(s) found in PMS but none fall within ${fmt(fromDate)} → ${fmt(toDate)}.`);
      }
    } else {
      const msg = (advancesResult.reason as Error)?.message || 'Could not fetch advance records';
      if (!msg.toLowerCase().includes('no record') && !msg.toLowerCase().includes('not found')) {
        setAdvancesError(msg);
      }
    }

    setFetched(true);
    setFetchLoading(false);
    setFlightsLoading(false);
    setAccomLoading(false);
    setLeavesLoading(false);
    setAdvancesLoading(false);
  }, [fromDate, toDate, currentUser]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const primaryCountry = assignments[0]?.country || 'India';

  const assignmentDates = useMemo(() => {
    if (!fetched || !fromDate || !toDate) return [];
    return isoRange(fromDate, toDate);
  }, [fetched, fromDate, toDate]);

  const daRows = useMemo(() => {
    if (!fetched || !fromDate || !toDate) return [];

    // ── Flight-aware departure / return day resolution ──────────────────────────
    // Rule: use the actual flight departure_date as the travel day.
    // • If the outbound flight departs the day BEFORE assignment start → that day gets Departure DA
    // • If the outbound flight departs ON assignment start (after-midnight flight) → no extra departure day
    // • If no flight found → fall back to startDate − 1 (default assumption)
    // Same logic applies in reverse for return flights.
    const flightDepDay = new Map<string, string>(); // startDate → actual departure ISO date
    const flightRetDay = new Map<string, string>(); // endDate   → actual return ISO date

    // Travel-day DA time-based eligibility (policy rules):
    //   Departure day gets DA only if departure is before 17:00
    //   Return day gets DA only if arrival is after 12:00
    const flightDepEligible = new Map<string, boolean>(); // startDate → departure before 17:00?
    const flightRetEligible = new Map<string, boolean>(); // endDate   → arrival after 12:00?
    const flightDepTime     = new Map<string, string>();  // startDate → "HH:MM" for remarks
    const flightArrTime     = new Map<string, string>();  // endDate   → "HH:MM" for remarks

    // Long-term stay detection (≥ 30 days → DA not applicable per policy)
    const longTermAsgnIds = new Set<string>();
    // OB (On-Bench) assignment detection (DA not applicable)
    const obAsgnIds = new Set<string>();

    assignments.forEach(a => {
      const start = a.startDate || fromDate;
      const end   = a.endDate   || toDate;

      // Long-term stay: ≥ 30 days duration → mark as non-applicable
      const spanDays = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
      if (spanDays >= 30 && a.assignmentId) longTermAsgnIds.add(a.assignmentId);

      // OB check: batchType or batchCategory contains OB / On-Bench
      const bt = (a.batchType || '').toUpperCase();
      const bc = (a.batchCategory || '').toUpperCase();
      if ((bt === 'OB' || bt.includes('BENCH') || bc.includes('OB') || bc.includes('BENCH')) && a.assignmentId) {
        obAsgnIds.add(a.assignmentId);
      }

      // Outbound: find flight departing within 2 days before the assignment start date
      const outbound = pmsFlights.find(f => {
        const fd = parseDT(f.departure_date);
        return fd ? fd >= addDays(start, -2) && fd <= start : false;
      });
      if (outbound) {
        const fd = parseDT(outbound.departure_date);
        if (fd && fd < start) {
          // Flight departs before the assignment starts → that date is the travel day
          flightDepDay.set(start, fd);
        }
        // If fd === start: flight is on start day (after-midnight or same-day) — no extra dep day
        // Time eligibility: departure must be before 17:00
        const rawDepTime = (outbound.departure_time || '').trim();
        const depHHMM    = rawDepTime.substring(0, 5); // "HH:MM"
        flightDepTime.set(start, depHHMM);
        // Eligible if no time data (default allow) or time < "17:00"
        flightDepEligible.set(start, !rawDepTime || rawDepTime.substring(0, 5) < '17:00');
      } else {
        // No flight data → standard: day before start; default eligible
        flightDepDay.set(start, addDays(start, -1));
        flightDepEligible.set(start, true);
      }

      // Return: find flight departing on or within 2 days after assignment end
      const returnFlight = pmsFlights.find(f => {
        const fd = parseDT(f.departure_date);
        return fd ? fd >= end && fd <= addDays(end, 2) : false;
      });
      if (returnFlight) {
        const fd = parseDT(returnFlight.departure_date);
        if (fd && fd > end) {
          // Return flight departs after assignment ends → that date is the return travel day
          flightRetDay.set(end, fd);
        }
        // If fd === end: trainer departs on last day of assignment — no extra return day
        // Time eligibility for return: arrival at base must be after 12:00
        const rawArrTime = (returnFlight.arrival_time || '').trim();
        const arrHHMM    = rawArrTime.substring(0, 5);
        flightArrTime.set(end, arrHHMM);
        // Policy: return day eligible only if arrival at base is AFTER 12:00 (strictly)
        flightRetEligible.set(end, !rawArrTime || rawArrTime.substring(0, 5) > '12:00');
      } else {
        // No flight data → standard: day after end; default eligible
        flightRetDay.set(end, addDays(end, 1));
        flightRetEligible.set(end, true);
      }
    });

    // Build a set of all dates to show:
    // • Actual departure day (from flight or startDate − 1)
    // • all days within each assignment's startDate..endDate
    // • Actual return day (from flight or endDate + 1)
    // Constrained to ±1 day of the selected date range window.
    const rangeStart = addDays(fromDate, -1);
    const rangeEnd   = addDays(toDate,   +1);

    const dateSet = new Set<string>();

    if (assignments.length === 0) {
      // No assignments — just show the selected range with no-assignment status
      isoRange(fromDate, toDate).forEach(d => dateSet.add(d));
    } else {
      assignments.forEach(a => {
        const start  = a.startDate || fromDate;
        const end    = a.endDate   || toDate;
        const dep    = flightDepDay.get(start) || addDays(start, -1);
        const ret    = flightRetDay.get(end)   || addDays(end,   1);
        // Policy: include ALL days from departure to return — covers departure day,
        // pre-batch transit days, core assignment days, post-batch holding days, and return day.
        // (Policy example: 8PM departure on Day-2, batch Day0..Day4, return Day6 → DA eligible
        //  for Day-1 through Day5 i.e. all days the trainer is away.)
        const winFrom = dep > rangeStart ? dep : rangeStart;
        const winTo   = ret < rangeEnd   ? ret : rangeEnd;
        if (winFrom <= winTo) isoRange(winFrom, winTo).forEach(d => dateSet.add(d));
      });
    }

    const sortedDates = Array.from(dateSet).sort();

    return sortedDates.map(iso => {
      // Find the assignment whose core range (startDate..endDate) covers this date
      const coreAsgn = assignments.find(a =>
        a.startDate && a.endDate && iso >= a.startDate && iso <= a.endDate,
      );

      // Check if this is a departure travel day (actual flight date before assignment start)
      const depAsgn = !coreAsgn
        ? assignments.find(a => {
            const depDay = flightDepDay.get(a.startDate || fromDate);
            return depDay === iso;
          })
        : null;

      // Check if this is a return travel day (actual flight date after assignment end)
      const retAsgn = !coreAsgn && !depAsgn
        ? assignments.find(a => {
            const retDay = flightRetDay.get(a.endDate || toDate);
            return retDay === iso;
          })
        : null;

      // Policy: days between the departure flight and assignment start (pre-batch transit),
      // or between assignment end and return flight (post-batch holding), are eligible for DA
      // at the destination country rate — the trainer is abroad during these days.
      const interimAsgn = !coreAsgn && !depAsgn && !retAsgn
        ? assignments.find(a => {
            const aStart  = a.startDate || fromDate;
            const aEnd    = a.endDate   || toDate;
            const depDay  = flightDepDay.get(aStart) || addDays(aStart, -1);
            const retDay  = flightRetDay.get(aEnd)   || addDays(aEnd,   1);
            return (iso > depDay && iso < aStart) || (iso > aEnd && iso < retDay);
          })
        : null;

      const asgn = coreAsgn ?? depAsgn ?? retAsgn ?? interimAsgn ?? null;
      const isDeparture = !!depAsgn;
      const isReturn    = !!retAsgn;
      const isInterim   = !!interimAsgn;

      const destCountry = asgn?.country || primaryCountry;
      // On travel days for international assignments, the trainer departs from/arrives in
      // India, so India DA rate (₹950) applies — not the destination country rate.
      const isInternationalTravelDay = (isDeparture || isReturn) && destCountry !== 'India' && destCountry !== '';
      const country    = isInternationalTravelDay ? 'India' : destCountry;
      const asgnId     = asgn?.assignmentId || '';
      const asgnCourse = asgn?.courseName   || '';
      const daInfo     = getDaInfo(country, isInternationalTravelDay ? undefined : asgn?.city);
      const { rate, currency, allowed } = daInfo;

      const isFuture  = iso > today;
      const isToday   = iso === today;
      const asgnTag   = asgnId ? `Asgn #${asgnId}` : (asgnCourse || '—');

      let status: string;
      let statusClass: string;
      let amount: number;
      let remarks: string;

      // ILO / Online batches: DA not applicable per policy
      const isOnlineBatch = asgn &&
        (asgn.batchType === 'ILO' || asgn.deliveryMode === 'Online');

      // Delhi-NCR rule: "No DA, No taxi for travel within Delhi-NCR" (Travel Policy)
      // Applies when the assignment city is within Delhi-NCR and it's a domestic (India) day
      const isDelhiNcr = country === 'India' && !isInternationalTravelDay && asgn != null &&
        DELHI_NCR_CITIES.has((asgn.city || '').toLowerCase().trim());

      // Long-term stay and OB flags (new policy rules)
      const isLongTermStay = asgn?.assignmentId ? longTermAsgnIds.has(asgn.assignmentId) : false;
      const isOBAssignment = asgn?.assignmentId ? obAsgnIds.has(asgn.assignmentId) : false;

      // Travel-day time eligibility
      const depEligible = flightDepEligible.get(asgn?.startDate || '') ?? true;
      const retEligible = flightRetEligible.get(asgn?.endDate   || '') ?? true;
      const depTimeStr  = flightDepTime.get(asgn?.startDate || '') || '';
      const arrTimeStr  = flightArrTime.get(asgn?.endDate   || '') || '';

      if (!asgn) {
        // Date is in the window but no assignment covers it at all
        status      = 'No Assignment';
        statusClass = 'bg-gray-100 text-gray-500 border border-gray-200';
        amount      = 0;
        remarks     = 'No assignment covers this date';
      } else if (isOnlineBatch) {
        status      = 'Not Applicable — Online Batch (ILO)';
        statusClass = 'bg-red-100 text-red-600 border border-red-200';
        amount      = 0;
        remarks     = `${asgnTag} — ILO/Online batch, DA not eligible per policy`;
      } else if (isDelhiNcr) {
        status      = 'Not Applicable — Within Delhi-NCR';
        statusClass = 'bg-gray-100 text-gray-500 border border-gray-300';
        amount      = 0;
        remarks     = `${asgnTag} — No DA for travel within Delhi-NCR (per travel policy)`;
      } else if (isLongTermStay) {
        status      = 'Not Applicable — Long Term Stay (≥30 days)';
        statusClass = 'bg-gray-100 text-gray-500 border border-gray-300';
        amount      = 0;
        remarks     = `${asgnTag} — Long-term stay (≥30 days); TA/DA settled monthly per policy`;
      } else if (isOBAssignment) {
        status      = 'Not Applicable — OB Assignment';
        statusClass = 'bg-gray-100 text-gray-500 border border-gray-300';
        amount      = 0;
        remarks     = `${asgnTag} — On-bench assignment, DA not applicable per policy`;
      } else if (leaveDates.has(iso)) {
        status      = 'Leave Day — DA Not Eligible';
        statusClass = 'bg-orange-100 text-orange-700 border border-orange-200';
        amount      = 0;
        remarks     = 'Marked as leave';
      } else if (!allowed) {
        status      = 'Not Allowed — Mismatch';
        statusClass = 'bg-red-100 text-red-600 border border-red-200';
        amount      = 0;
        remarks     = `${asgnTag} — country not in DA policy`;
      } else if (isFuture) {
        status      = 'Not Allowed (Future Date)';
        statusClass = 'bg-red-100 text-red-600 border border-red-200';
        amount      = 0;
        remarks     = `${asgnTag} — future date`;
      } else if (isDeparture && !depEligible) {
        // Departure after 17:00 → travel day DA not applicable per policy
        status      = 'Not Eligible — Departure After 17:00';
        statusClass = 'bg-amber-50 text-amber-700 border border-amber-200';
        amount      = 0;
        remarks     = `${asgnTag} — flight departs at ${depTimeStr || '?'} (after 17:00); travel day DA not applicable per policy`;
      } else if (isReturn && !retEligible) {
        // Arrival before 12:00 → return day DA not applicable per policy
        status      = 'Not Eligible — Return Arrival Before 12:00';
        statusClass = 'bg-amber-50 text-amber-700 border border-amber-200';
        amount      = 0;
        remarks     = `${asgnTag} — arrives at ${arrTimeStr || '?'} (before 12:00); return day DA not applicable per policy`;
      } else if (isDeparture) {
        status      = 'Allowed (Travel Day)';
        statusClass = 'bg-blue-100 text-blue-700';
        amount      = rate;
        const depNote = depTimeStr ? `, departs ${depTimeStr} (before 17:00)` : '';
        remarks     = isInternationalTravelDay
          ? `${asgnTag} — departure from India to ${destCountry} (India rate applied${depNote})`
          : `${asgnTag} — departure day${depNote}`;
      } else if (isReturn) {
        status      = 'Allowed (Return Day)';
        statusClass = 'bg-blue-100 text-blue-700';
        amount      = rate;
        const arrNote = arrTimeStr ? `, arrives ${arrTimeStr} (after 12:00)` : '';
        remarks     = isInternationalTravelDay
          ? `${asgnTag} — return to India from ${destCountry} (India rate applied${arrNote})`
          : `${asgnTag} — return day${arrNote}`;
      } else if (isInterim) {
        // Policy: days between departure flight and batch start (pre-batch transit),
        // or between batch end and return flight (post-batch holding), are eligible for DA.
        // Trainer is abroad during these days → destination country rate applies.
        // (Delays are not considered per policy — scheduled times only.)
        const isPostBatch = iso > (asgn?.endDate || toDate);
        status      = isPostBatch ? 'Allowed (Post-Batch In-Country)' : 'Allowed (Pre-Batch In-Country)';
        statusClass = 'bg-teal-50 text-teal-700 border border-teal-200';
        amount      = rate;
        remarks     = isPostBatch
          ? `${asgnTag} — in ${destCountry} awaiting return flight (destination rate)`
          : `${asgnTag} — arrived in ${destCountry} before batch start (destination rate)`;
      } else if (isToday) {
        status      = 'Allowed (Today)';
        statusClass = 'bg-green-100 text-green-700';
        amount      = rate;
        remarks     = asgnTag;
      } else {
        status      = 'Allowed';
        statusClass = 'bg-green-100 text-green-700';
        amount      = rate;
        remarks     = asgnTag;
      }

      return { iso, day: dayName(iso), country, assignmentId: asgnId, courseName: asgnCourse, status, statusClass, rate, currency, amount, remarks };
    });
  }, [fetched, fromDate, toDate, today, assignments, primaryCountry, leaveDates, pmsFlights]);

  // Indicative FX rates for Grand Total conversion (updated periodically — for display only)
  const FX_TO_INR: Record<string, number> = { USD: 83.5, AED: 22.7 };

  // INR-only DA total (used in grandTotal and INR displays)
  const autoDATotal = useMemo(
    () => daRows.filter(r => r.currency === 'INR').reduce((s, r) => s + r.amount, 0),
    [daRows],
  );
  // Foreign currency DA totals keyed by currency code
  const foreignDAMap = useMemo<Record<string, number>>(
    () => daRows.filter(r => r.currency !== 'INR' && r.amount > 0).reduce<Record<string, number>>((acc, r) => {
      acc[r.currency] = (acc[r.currency] ?? 0) + r.amount;
      return acc;
    }, {}),
    [daRows],
  );
  // Foreign DA converted to INR equivalent (for grand total)
  const foreignDATotalINR = useMemo(
    () => Object.entries(foreignDAMap).reduce((sum, [cur, amt]) => sum + amt * (FX_TO_INR[cur] ?? 0), 0),
    [foreignDAMap],
  );
  const travelTotal = useMemo(() => travelBills.reduce((s, b) => s + b.amount, 0), [travelBills]);
  const miscTotal = useMemo(() => miscExpenses.reduce((s, e) => s + e.amount, 0), [miscExpenses]);
  const lodgingTotal = useMemo(() => lodgingEntries.reduce((s, l) => s + l.nights * l.ratePerNight, 0), [lodgingEntries]);
  // Grand total includes foreign DA converted to INR at indicative rates
  const grandTotal = autoDATotal + foreignDATotalINR + travelTotal + lodgingTotal + miscTotal;

  function addTravelBill() {
    if (!travelDraft.from || !travelDraft.to || !travelDraft.amount) return;
    if (!travelDraft.journeyType) return;
    const validation = validateJourneyType(travelDraft.journeyType, travelDraft.date || '', assignments);
    if (validation.blocked) return;
    setTravelBills(prev => [...prev, { ...travelDraft, id: uid() } as TravelBill]);
    setTravelDraft({ date: fromDate || '', journeyType: '', travelType: 'Cab', from: '', to: '', distance: '', amount: 0, currency: 'INR', receipt: '' });
  }

  function removeTravelBill(id: string) {
    setTravelBills(prev => prev.filter(b => b.id !== id));
  }

  const [submitSuccess, setSubmitSuccess] = useState(false);

  function handleSubmit() {
    const now = new Date().toISOString();
    const claimId = `CLAIM-${Date.now()}`;
    const billNo = `TADA-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    // Build ClaimHeader
    const claim: ClaimHeader = {
      claimId,
      billNo,
      trainerId: currentUser?.trainerId || currentUser?.id || '',
      trainerName: currentUser?.name || '',
      assignmentIds: assignments.map(a => a.assignmentId).filter(Boolean),
      batchIds: assignments.map(a => a.assignmentId).filter(Boolean),
      clientName: assignments[0]?.clientName || '',
      courseName: assignments[0]?.courseName || '',
      trainingLocation: assignments.map(a => a.city || a.country).filter(Boolean).join(', '),
      claimStartDate: fromDate,
      claimEndDate: toDate,
      baseCity: 'India',
      destinationCities: [...new Set(assignments.map(a => a.country).filter(Boolean))],
      status: 'Submitted',
      pendingWith: 'HR/Admin',
      submittedAt: now,
      lastActionAt: now,
      totalClaimedAmount: grandTotal,
      eligibleAmount: grandTotal,
      approvedAmount: 0,
      deductionAmount: 0,
      advanceAdjusted: advanceTotal,
      miscAdjustments: 0,
      recoverableAmount: 0,
      netPayable: grandTotal - advanceTotal,
      currency: 'INR',
      exceptionFlag: false,
      missingDocumentFlag: false,
      duplicateFlag: false,
      ledgerMismatchFlag: false,
      slaBreached: false,
      paymentStatus: 'Unpaid',
      agingDays: 0,
      adminRemark: employeeRemarks || undefined,
    };

    // Build ClaimLineItems
    const lineItems: ClaimLineItem[] = [];

    // DA rows
    daRows.filter(r => r.amount > 0).forEach(r => {
      lineItems.push({
        lineItemId: `LI-DA-${r.iso}`,
        claimId,
        expenseType: 'DA',
        expenseSubType: r.country,
        date: r.iso,
        description: `Daily Allowance — ${r.country} (${r.status})`,
        claimedAmount: r.amount,
        policyLimit: r.rate,
        eligibleAmount: r.amount,
        approvedAmount: 0,
        deductionAmount: 0,
        currency: r.currency,
        receiptRequired: false,
        receiptUploaded: false,
        exceptionRequired: false,
      });
    });

    // Travel bills
    travelBills.forEach(b => {
      lineItems.push({
        lineItemId: `LI-TA-${b.id}`,
        claimId,
        expenseType: 'TA',
        expenseSubType: b.travelType,
        date: b.date,
        fromLocation: b.from,
        toLocation: b.to,
        description: `${b.journeyType || b.travelType}: ${b.from} → ${b.to}${b.distance ? ` (${b.distance})` : ''}`,
        claimedAmount: b.amount,
        policyLimit: b.amount,
        eligibleAmount: b.amount,
        approvedAmount: 0,
        deductionAmount: 0,
        currency: b.currency || 'INR',
        receiptRequired: true,
        receiptUploaded: !!b.receipt,
        exceptionRequired: false,
      });
    });

    // Lodging
    lodgingEntries.forEach(l => {
      lineItems.push({
        lineItemId: `LI-LO-${l.id}`,
        claimId,
        expenseType: 'Lodging',
        date: l.checkIn,
        description: `Hotel: ${l.hotelName || 'Accommodation'}, ${l.city} (${l.nights} night${l.nights !== 1 ? 's' : ''})`,
        claimedAmount: l.nights * l.ratePerNight,
        policyLimit: l.nights * l.ratePerNight,
        eligibleAmount: l.nights * l.ratePerNight,
        approvedAmount: 0,
        deductionAmount: 0,
        currency: 'INR',
        receiptRequired: true,
        receiptUploaded: !!l.receipt,
        exceptionRequired: false,
      });
    });

    // Misc expenses
    miscExpenses.forEach(m => {
      lineItems.push({
        lineItemId: `LI-MI-${m.id}`,
        claimId,
        expenseType: 'Other',
        expenseSubType: m.expenseType,
        date: m.date,
        description: `${m.expenseType}${m.remarks ? ': ' + m.remarks : ''}`,
        claimedAmount: m.amount,
        policyLimit: m.amount,
        eligibleAmount: m.amount,
        approvedAmount: 0,
        deductionAmount: 0,
        currency: m.currency || 'INR',
        receiptRequired: true,
        receiptUploaded: !!m.receipt,
        exceptionRequired: false,
      });
    });

    saveClaim(claim);
    saveLineItems(lineItems);
    setSubmitSuccess(true);
    setTimeout(() => {
      navigate('/claims');
    }, 1800);
  }

  function addMiscExpense() {
    if (!miscDraft.amount) return;
    setMiscExpenses(prev => [...prev, { ...miscDraft, id: uid() } as MiscExpense]);
    setMiscDraft({ expenseType: 'Other', date: fromDate || '', amount: 0, currency: 'INR', remarks: '', receipt: '' });
  }

  function removeMiscExpense(id: string) {
    setMiscExpenses(prev => prev.filter(e => e.id !== id));
  }

  function addAdvance() {
    if (!advanceDraft.amount || !advanceDraft.date) return;
    setAdvances(prev => [...prev, { ...advanceDraft, id: uid() } as AdvanceTaken]);
    setAdvanceDraft({ date: fromDate || '', amount: 0, currency: 'INR', purpose: '', reference: '' });
  }
  function removeAdvance(id: string) { setAdvances(prev => prev.filter(a => a.id !== id)); }

  function importAdvance(r: RawAdvanceRecord) {
    const key = String(r.AdvanceId ?? `${r.EmpId}-${r.AdvanceDate}-${r.AdvanceAmount}`);
    if (importedAdvanceIds.has(key)) return;
    const entry: AdvanceTaken = {
      id: uid(),
      date: parseDT(r.AdvanceDate) || (fromDate || ''),
      amount: typeof r.AdvanceAmount === 'number' ? r.AdvanceAmount : Number(r.AdvanceAmount ?? 0),
      currency: r.Currency?.toUpperCase() || 'INR',
      purpose: r.Purpose || '',
      reference: r.VoucherNo || (r.AdvanceId ? `ADV-${r.AdvanceId}` : ''),
    };
    setAdvances(prev => [...prev, entry]);
    setImportedAdvanceIds(prev => new Set(prev).add(key));
  }

  const advancesInRange = advances.filter(a => a.date >= fromDate && a.date <= toDate);
  const advanceTotal = advancesInRange.filter(a => a.currency === 'INR').reduce((s, a) => s + a.amount, 0);

  // Filter PMS advance records: only those within the selected date range and with real data
  const pmsAdvancesInRange = pmsAdvances.filter(r => {
    // Skip completely blank rows — must have at least an amount or ID
    if (r.AdvanceId == null && (r.AdvanceAmount == null || r.AdvanceAmount === 0)) return false;
    // Date filter: if AdvanceDate is present, it must fall within the selected range
    const d = parseDT(r.AdvanceDate);
    if (d) return d >= fromDate && d <= toDate;
    // No date on the record — still show it (date may be missing from API) but don't hide
    return r.AdvanceAmount != null && r.AdvanceAmount !== 0;
  });

  function importFlightAsBill(f: FlightRecord) {
    const tripKey = String(f.trip_ID ?? `${f.flight_number}-${parseDT(f.departure_date)}`);
    if (importedTripIds.has(tripKey)) return;
    const bill: TravelBill = {
      id: uid(),
      date: parseDT(f.departure_date),
      journeyType: '',
      travelType: 'Flight',
      from: f.from_city ?? '',
      to: f.to_city ?? '',
      distance: '',
      amount: 0,
      currency: 'INR',
      receipt: f.ticket_path ?? '',
    };
    setTravelBills(prev => [...prev, bill]);
    setImportedTripIds(prev => new Set([...prev, tripKey]));
  }

  function calcNights(ci: string, co: string): number {
    if (!ci || !co) return 0;
    return Math.max(0, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000));
  }

  function addLodgingEntry() {
    if (!lodgingDraft.hotelName || !lodgingDraft.checkIn || !lodgingDraft.checkOut) return;
    const nights = calcNights(lodgingDraft.checkIn, lodgingDraft.checkOut);
    setLodgingEntries(prev => [...prev, {
      ...lodgingDraft,
      id: uid(),
      nights,
      ratePerNight: lodgingDraft.ratePerNight ?? 0,
      source: 'manual',
    } as LodgingEntry]);
    setLodgingDraft({ hotelName: '', city: '', roomNo: '', checkIn: fromDate, checkOut: '', nights: 0, ratePerNight: 0, receipt: '' });
  }

  function removeLodgingEntry(id: string) {
    setLodgingEntries(prev => prev.filter(l => l.id !== id));
  }

  function importAccomAsLodging(r: AccommodationRecord) {
    const key = `${r.AccommodationName}-${accomDT(r.CheckInDate)}`;
    if (importedAccom.has(key)) return;
    const ci = accomDT(r.CheckInDate);
    const co = accomDT(r.CheckOutDate);
    const nights = r.Nights ?? calcNights(ci, co);
    setLodgingEntries(prev => [...prev, {
      id: uid(),
      hotelName: r.AccommodationName ?? '',
      city: r.CityName ?? '',
      roomNo: r.RoomNo ?? '',
      checkIn: ci,
      checkOut: co,
      nights,
      ratePerNight: 0,
      receipt: r.AccommodationPDF ?? '',
      source: 'pms',
    }]);
    setImportedAccom(prev => new Set([...prev, key]));
  }

  function formatINR(n: number) {
    return `₹ ${n.toLocaleString('en-IN')}`;
  }

  function openAddModal() {
    setEditingAssignment(undefined);
    setModalOpen(true);
  }

  function openEditModal(a: Assignment) {
    setEditingAssignment(a);
    setModalOpen(true);
  }

  function saveAssignment(a: Assignment) {
    setAssignments(prev => {
      const idx = prev.findIndex(x => x.id === a.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = a;
        return next;
      }
      return [...prev, a];
    });
  }

  function removeAssignment(id: string) {
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  const isFutureRange = fromDate > today;
  const empCode = (currentUser?.trainerId ?? '').replace(/^EMP-/i, '').trim();

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <AssignmentModal
        open={modalOpen}
        initial={editingAssignment}
        fromDate={fromDate}
        toDate={toDate}
        koenigCountries={koenigCountries}
        countriesLoading={countriesLoading}
        onSave={saveAssignment}
        onClose={() => setModalOpen(false)}
      />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Select Date Range</h1>
            <p className="text-sm text-gray-500 mt-0.5">Select date range to fetch assignments and auto-calculate DA per policy</p>
          </div>
          {currentUser && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {currentUser.avatarInitials}
              </div>
              <div>
                <p className="font-semibold text-blue-800">{currentUser.name}</p>
                <p className="text-xs text-blue-500">
                  EMP-{empCode} · {currentUser.email}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 1: Date Range ──────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <SectionTitle>Step 1 — Select Date Range &amp; Fetch Assignments</SectionTitle>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <div className="relative">
                <input type="date" className={inputCls} value={fromDate} max={today}
                  onChange={e => { setFromDate(e.target.value); setFetched(false); setFetchStatus('idle'); }} />
                <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <div className="relative">
                <input type="date" className={inputCls} value={toDate} min={fromDate} max={today}
                  onChange={e => { setToDate(e.target.value); setFetched(false); setFetchStatus('idle'); }} />
                <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleFetch}
                disabled={fetchLoading || !fromDate || !toDate || toDate < fromDate}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {fetchLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Fetching…</>
                  : <><Search size={14} /> Fetch Assignments</>}
              </button>

              {fetched && (
                <button
                  type="button"
                  onClick={openAddModal}
                  disabled={!fromDate || !toDate}
                  className="px-4 py-2.5 rounded-lg border-2 border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-40 text-sm font-semibold flex items-center gap-2"
                >
                  <Plus size={14} /> Add Assignment
                </button>
              )}
            </div>
          </div>

          {/* Status messages */}
          <div className="mt-3 flex flex-wrap gap-2">
            {isFutureRange && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                <Info size={13} /> Future DA submission is not allowed.
              </div>
            )}
            {fetchStatus === 'success' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                <CheckCircle2 size={13} /> {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} fetched from Koenig PMS for EMP-{empCode}
              </div>
            )}
            {fetchStatus === 'empty' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                <AlertCircle size={13} />
                No assignments found in PMS for EMP-{empCode} in this period. Use <strong className="ml-1">+ Add Assignment</strong> to add manually.
              </div>
            )}
            {fetchStatus === 'error' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span>{fetchError}.</span>
                <button
                  type="button"
                  onClick={openAddModal}
                  disabled={!fromDate || !toDate}
                  className="ml-1 underline font-semibold hover:text-red-900 disabled:opacity-50 cursor-pointer"
                >
                  Add assignment manually →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Not fetched yet */}
        {!fetched && (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Select a date range and click <strong>Fetch Assignments</strong> to begin.</p>
            <p className="text-xs text-gray-400 mt-1">Assignment details, DA eligibility, and auto-calculation will appear here.</p>
          </div>
        )}

        {fetched && (
          <>
            {/* ── Section 2: Assignment Details ─────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div
                className="px-5 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none"
                onClick={() => setShowAssignmentTable(v => !v)}
              >
                <SectionTitle
                  badge={
                    <div className="flex items-center gap-2">
                      {assignments.length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full font-medium">
                          {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); openAddModal(); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 border border-blue-300 hover:bg-blue-50"
                      >
                        <Plus size={12} /> Add
                      </button>
                      <span className="text-gray-400">{showAssignmentTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                    </div>
                  }
                >
                  Step 2 — Assignment Details
                </SectionTitle>
              </div>

              {showAssignmentTable && (
                <>
                  {assignments.length === 0 ? (
                    <div className="px-5 pb-5">
                      {/* Empty state with prompt to add */}
                      <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                        <Building2 size={36} className="text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500 mb-1">No assignments added yet</p>
                        <p className="text-xs text-gray-400 mb-4">Add your assignment details so DA can be calculated accurately</p>
                        <button
                          type="button"
                          onClick={openAddModal}
                          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
                        >
                          <Plus size={14} /> Add Assignment
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {/* Active filter chips */}
                      {(filterBatchType || filterMode) && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                          <span className="text-xs text-blue-600 font-medium">Filters:</span>
                          {filterBatchType && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-semibold">
                              Batch: {filterBatchType}
                              <button type="button" onClick={() => setFilterBatchType('')} className="ml-1 hover:text-purple-900">×</button>
                            </span>
                          )}
                          {filterMode && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-semibold">
                              Mode: {filterMode}
                              <button type="button" onClick={() => setFilterMode('')} className="ml-1 hover:text-green-900">×</button>
                            </span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {filteredAssignments.length} of {assignments.length} assignments
                          </span>
                          <button type="button" onClick={() => { setFilterBatchType(''); setFilterMode(''); }}
                            className="text-xs text-red-500 hover:underline">Clear all</button>
                        </div>
                      )}
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 border-y border-gray-200">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Calendar size={11} />Assignment ID</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Calendar size={11} />Batch ID</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Building2 size={11} />Course Name</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Building2 size={11} />Client Name</span>
                            </th>
                            {/* Batch Type column with filter */}
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-1"><Calendar size={11} />Batch Type</span>
                                <select
                                  value={filterBatchType}
                                  onChange={e => setFilterBatchType(e.target.value)}
                                  className="text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-600 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[80px]"
                                >
                                  <option value="">All</option>
                                  {batchTypeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                              </div>
                            </th>
                            {/* Mode column with filter */}
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-1"><Building2 size={11} />Mode</span>
                                <select
                                  value={filterMode}
                                  onChange={e => setFilterMode(e.target.value)}
                                  className="text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-600 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[80px]"
                                >
                                  <option value="">All</option>
                                  {modeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                              </div>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Calendar size={11} />Start Date</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Calendar size={11} />End Date</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><MapPin size={11} />City of Training</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><MapPin size={11} />Country</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Building2 size={11} />Training Venue</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1"><Building2 size={11} />Trainer</span>
                            </th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">Source</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredAssignments.map(a => (
                            <tr key={a.id} className="hover:bg-blue-50/30">
                              {/* Assignment ID */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.assignmentId
                                  ? <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{a.assignmentId}</span>
                                  : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Batch ID */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.batchId
                                  ? <span className="font-mono text-[11px] text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded">{a.batchId}</span>
                                  : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Course Name */}
                              <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                                <div className="truncate text-[12px]" title={a.courseName}>{a.courseName || '—'}</div>
                              </td>
                              {/* Client Name */}
                              <td className="px-4 py-3 max-w-[160px]">
                                {a.clientName
                                  ? <div className="truncate text-[11px] text-gray-700" title={a.clientName}>{a.clientName}</div>
                                  : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Batch Type (batch_delivery_mode) */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.batchType ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 w-fit">
                                    {a.batchType}
                                  </span>
                                ) : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Delivery Mode */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.deliveryMode ? (() => {
                                  const isOnline = a.deliveryMode === 'Online';
                                  const isHybrid = a.deliveryMode === 'Hybrid';
                                  const colorCls = isOnline ? 'bg-green-100 text-green-700'
                                                 : isHybrid ? 'bg-blue-100 text-blue-700'
                                                 : 'bg-orange-100 text-orange-700';
                                  const dotCls   = isOnline ? 'bg-green-500'
                                                 : isHybrid ? 'bg-blue-500'
                                                 : 'bg-orange-500';
                                  return (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${colorCls}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                      {a.deliveryMode}
                                    </span>
                                  );
                                })() : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Start Date */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.startDate ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-[11px]">
                                      {fmt(a.startDate)}
                                    </span>
                                    {!a.trainingDates && (
                                      <span className="text-[9px] text-amber-500 font-medium px-1">inferred</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">—</span>
                                )}
                              </td>
                              {/* End Date */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.endDate ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-800 font-semibold text-[11px]">
                                      {fmt(a.endDate)}
                                    </span>
                                    {!a.trainingDates && (
                                      <span className="text-[9px] text-amber-500 font-medium px-1">inferred</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">—</span>
                                )}
                              </td>
                              {/* City of Training */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.city
                                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium text-[11px]">
                                      <MapPin size={9} />{a.city}
                                    </span>
                                  : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Country */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.country
                                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium text-[11px]">
                                      {a.country}
                                    </span>
                                  : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Training Venue */}
                              <td className="px-4 py-3 max-w-[180px]">
                                {(a.trainingVenue || a.venueName)
                                  ? <div className="truncate text-gray-700 text-[11px]" title={a.trainingVenue || a.venueName}>{a.trainingVenue || a.venueName}</div>
                                  : <span className="text-gray-400 text-[11px]">—</span>}
                              </td>
                              {/* Trainer */}
                              <td className="px-4 py-3 text-gray-700">
                                <div className="font-medium whitespace-nowrap">{a.trainerName || '—'}</div>
                                {a.trainerEmail && <div className="text-[10px] text-gray-400">{a.trainerEmail}</div>}
                              </td>
                              {/* Source badge */}
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${a.source === 'api' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {a.source === 'api' ? 'PMS' : 'Manual'}
                                </span>
                              </td>
                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => openEditModal(a)} className="text-blue-500 hover:text-blue-700">
                                    <Edit3 size={13} />
                                  </button>
                                  <button type="button" onClick={() => removeAssignment(a.id)} className="text-red-400 hover:text-red-600">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </>
              )}
            </div>

            {/* ── Section 3: Leave Dates ─────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2">
                    <Calendar size={15} className="text-orange-500" />
                    Step 3 — Leave Dates
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Leave records from Koenig PMS for{' '}
                    <span className="font-semibold text-gray-600">{fromDate ? fmt(fromDate) : '—'} → {toDate ? fmt(toDate) : '—'}</span>
                    {currentUser?.trainerId && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-mono text-[10px]">
                        EMP: {(currentUser.trainerId ?? '').replace(/^EMP-/i, '')}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {leavesLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-600">
                      <Loader2 size={13} className="animate-spin" /> Fetching…
                    </div>
                  )}
                  {leaveDates.size > 0 && (
                    <>
                      <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                        {leaveDates.size} leave day{leaveDates.size !== 1 ? 's' : ''} marked
                      </span>
                      <button type="button" onClick={() => setLeaveDates(new Set())}
                        className="text-xs text-gray-400 hover:text-red-500 underline transition-colors">
                        Clear all
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* API Error */}
              {leavesError && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{leavesError}</span>
                </div>
              )}

              {/* ── PMS Leave Records Table ── */}
              {!leavesLoading && pmsLeaves.length > 0 && (
                <>
                  {/* Summary mini-cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    {[
                      { label: 'Total Leaves',    value: pmsLeaves.length,
                        color: 'bg-orange-50 text-orange-700 border border-orange-100' },
                      { label: 'Approved',         value: pmsLeaves.filter(r => isApprovedLeave(r.leave_status)).length,
                        color: 'bg-green-50 text-green-700 border border-green-100' },
                      { label: 'Pending',          value: pmsLeaves.filter(r => isPendingLeave(r.leave_status)).length,
                        color: 'bg-amber-50 text-amber-700 border border-amber-100' },
                      { label: 'Cancelled',        value: pmsLeaves.filter(r => isCancelledLeave(r.leave_status)).length,
                        color: 'bg-red-50 text-red-700 border border-red-100' },
                      { label: 'Days Auto-Marked', value: leaveDates.size,
                        color: 'bg-purple-50 text-purple-700 border border-purple-100' },
                    ].map(c => (
                      <div key={c.label} className={`rounded-xl px-4 py-3 ${c.color}`}>
                        <p className="text-xs font-medium opacity-70">{c.label}</p>
                        <p className="text-2xl font-bold mt-0.5">{c.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Leave records table */}
                  <div className="mb-4 rounded-xl border border-orange-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-orange-50 border-b border-orange-200">
                      <div className="flex items-center gap-2 text-orange-800 text-xs font-semibold">
                        <Calendar size={13} />
                        {pmsLeaves.length} leave record{pmsLeaves.length !== 1 ? 's' : ''} from Koenig PMS
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 text-[10px]">
                          Approved leaves auto-marked on date grid
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['Emp Code','Name','Leave Type','From Date','From Time','To Date','To Time','Days','Status','Approval Date'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap text-[11px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {pmsLeaves.map((r, idx) => {
                            const approved   = isApprovedLeave(r.leave_status);
                            const pending    = isPendingLeave(r.leave_status);
                            const cancelled  = isCancelledLeave(r.leave_status);
                            const fd = parseLeaveDate(r.from_date);
                            const td = parseLeaveDate(r.to_date);
                            const days = r.no_of_days ?? (fd && td ? Math.max(1, Math.round((new Date(td + 'T00:00:00').getTime() - new Date(fd + 'T00:00:00').getTime()) / 86400000) + 1) : 1);
                            const halfDay = r.is_half_day || (r.half_day && r.half_day !== '0' && r.half_day !== 'false') || ((r.duration ?? '').toLowerCase().includes('half'));
                            return (
                              <tr key={idx} className={
                                cancelled  ? 'bg-red-50/30 opacity-70' :
                                approved   ? 'bg-orange-50/40' :
                                'bg-white hover:bg-gray-50'
                              }>
                                <td className={`px-3 py-2.5 text-gray-500 font-mono text-[11px] whitespace-nowrap ${cancelled ? 'line-through' : ''}`}>{r.emp_code ?? '—'}</td>
                                <td className={`px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap ${cancelled ? 'line-through' : ''}`}>{r.emp_name ?? '—'}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <div className="flex flex-col gap-0.5">
                                    {r.leave_type
                                      ? <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${cancelled ? 'bg-gray-100 text-gray-400 line-through' : 'bg-blue-100 text-blue-700'}`}>{r.leave_type}</span>
                                      : <span className="text-gray-400">—</span>}
                                    {halfDay && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-medium">Half Day</span>}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {fd ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${cancelled ? 'bg-gray-50 border border-gray-200 text-gray-400 line-through' : 'bg-orange-50 border border-orange-200 text-orange-800'}`}>{fmt(fd)}</span> : <span className="text-gray-400">—</span>}
                                </td>
                                <td className={`px-3 py-2.5 text-gray-500 whitespace-nowrap ${cancelled ? 'line-through' : ''}`}>{r.from_time ? String(r.from_time).slice(0,5) : '—'}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {td ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${cancelled ? 'bg-gray-50 border border-gray-200 text-gray-400 line-through' : 'bg-red-50 border border-red-200 text-red-800'}`}>{fmt(td)}</span> : <span className="text-gray-400">—</span>}
                                </td>
                                <td className={`px-3 py-2.5 text-gray-500 whitespace-nowrap ${cancelled ? 'line-through' : ''}`}>{r.to_time ? String(r.to_time).slice(0,5) : '—'}</td>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${cancelled ? 'bg-gray-100 text-gray-400 line-through' : 'bg-purple-100 text-purple-700'}`}>{days}d</span>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold
                                    ${cancelled  ? 'bg-red-100 text-red-600' :
                                      approved   ? 'bg-green-100 text-green-700' :
                                      pending    ? 'bg-amber-100 text-amber-700' :
                                                   'bg-gray-100 text-gray-600'}`}>
                                    {r.leave_status ?? '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                  {r.leave_approval_date ? fmt(parseLeaveDate(r.leave_approval_date)) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Empty state — no leaves in range */}
              {!leavesLoading && !leavesError && pmsLeaves.length === 0 && fetched && (
                <div className="mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Calendar size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-600">No leave records found in Koenig PMS</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Queried emp_code:{' '}
                        <span className="font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                          {(currentUser?.trainerId ?? '').replace(/^EMP-/i, '') || '—'}
                        </span>
                        {' '}for range{' '}
                        <span className="font-semibold">{fmt(fromDate)} → {fmt(toDate)}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        If your leave data is maintained in PMS, contact HR to verify your emp_code mapping. You can mark leave days manually below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Date grid (manual toggle) ── */}
              {assignmentDates.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    {pmsLeaves.length > 0 ? 'Adjust leave days manually (click to toggle):' : 'Mark leave days manually (click to toggle):'}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {assignmentDates.map(iso => {
                      const day = dayName(iso);
                      const isWeekend = day === 'Sun' || day === 'Sat';
                      // Find if this date has a PMS leave record
                      const pmsLeave = pmsLeaves.find(r => {
                        const fd = parseLeaveDate(r.from_date);
                        const td = parseLeaveDate(r.to_date) || fd;
                        return fd && iso >= fd && iso <= td;
                      });
                      const isCancelled = pmsLeave !== undefined && isCancelledLeave(pmsLeave.leave_status);
                      // Orange if manually toggled OR PMS leave is active (not cancelled)
                      const isLeave = leaveDates.has(iso) || (pmsLeave !== undefined && !isCancelled);
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => toggleLeaveDate(iso)}
                          title={
                            isCancelled
                              ? `Cancelled: ${pmsLeave!.leave_type ?? 'Leave'} — ${pmsLeave!.leave_status} (DA applicable)`
                              : pmsLeave
                                ? `${pmsLeave.leave_type ?? 'Leave'} — ${pmsLeave.leave_status}`
                                : isLeave ? 'Click to unmark' : 'Click to mark as leave'
                          }
                          className={`flex flex-col items-center px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all select-none min-w-[62px]
                            ${isCancelled
                              ? 'bg-gray-100 border-gray-300 text-gray-400 opacity-70'
                              : isLeave
                                ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-105'
                                : isWeekend
                                  ? 'bg-gray-50 border-gray-200 text-gray-400 hover:border-orange-300 hover:bg-orange-50'
                                  : 'bg-green-50 border-green-200 text-green-700 hover:border-orange-300 hover:bg-orange-50'
                            }`}
                        >
                          <span className="text-[10px] font-medium opacity-80">{day}</span>
                          <span className={`text-sm font-bold leading-tight ${isCancelled ? 'line-through' : ''}`}>
                            {new Date(iso + 'T00:00:00').getDate()}
                          </span>
                          <span className="text-[10px] opacity-70">
                            {new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                          </span>
                          {isCancelled && (
                            <span className="mt-0.5 text-[9px] font-bold tracking-wide uppercase opacity-80 text-red-400">
                              Cncld
                            </span>
                          )}
                          {!isCancelled && isLeave && (
                            <span className="mt-0.5 text-[9px] font-bold tracking-wide uppercase opacity-90">
                              {pmsLeave ? (pmsLeave.leave_type ?? 'Leave').slice(0, 6) : 'Leave'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" />
                      <span className="text-gray-500">Working ({assignmentDates.length - leaveDates.size})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                      <span className="text-gray-500">Leave — no DA ({leaveDates.size})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 inline-block" />
                      <span className="text-gray-500">Cancelled leave — DA applies ({pmsLeaves.filter(r => isCancelledLeave(r.leave_status)).length})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" />
                      <span className="text-gray-500">Weekend</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 py-6 justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs">
                  <Calendar size={18} className="opacity-40" />
                  Fetch data first to see leave dates
                </div>
              )}
            </div>

            {/* ── Section 4: DA Eligibility ──────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <SectionTitle>Step 4 — DA Eligibility &amp; Auto Calculation (As per Policy)</SectionTitle>
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Info size={11} />
                  DA rate is fetched per day from the assignment country set in Step 2. Set the correct country per assignment to get accurate rates.
                </p>
              </div>

              {/* Country DA Rate Summary — derived from Step 2 assignments */}
              {fetched && assignments.length > 0 && (() => {
                const uniqueCountries = Array.from(new Set(assignments.map(a => a.country).filter(Boolean)));
                return (
                  <div className="px-5 pb-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                      <Info size={11} className="text-blue-400" />
                      DA Rates for Countries in Your Assignments (Step 2)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uniqueCountries.map(country => {
                        const info = getDaInfo(country);
                        return (
                          <div key={country}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                              info.allowed
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                            <span className="font-semibold">{country}</span>
                            {info.allowed ? (
                              <span className="text-green-600">
                                {info.currency === 'INR' ? '₹' : info.currency} {info.rate}/day
                              </span>
                            ) : (
                              <span className="text-red-500">No DA policy</span>
                            )}
                          </div>
                        );
                      })}
                      {/* Countries from Koenig list with no DA policy warning */}
                      {koenigCountries.length > 0 && uniqueCountries.some(c => !getDaInfo(c).allowed) && (
                        <p className="w-full text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <Info size={11} />
                          Countries without DA policy — update assignments in Step 2 to set correct country, or contact HR to add the rate.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      {['Date', 'Day', 'Assignment ID', 'Country', 'DA Status', 'DA Rate', 'Amount', 'Remarks'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            {(h === 'DA Status' || h === 'DA Rate') && <Info size={11} className="text-gray-400" />}
                            {h}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {daRows.filter(r => !r.status.includes('Online Batch')).map(r => (
                      <tr key={r.iso} className={r.amount === 0 ? 'opacity-60' : 'hover:bg-blue-50/30'}>
                        <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{fmt(r.iso)}</td>
                        <td className="px-4 py-3 text-gray-600">{r.day}</td>
                        <td className="px-4 py-3 text-xs">
                          {r.assignmentId ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-semibold">#{r.assignmentId}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.country}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${r.statusClass}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.amount > 0 ? formatDaCurrency(r.rate, r.currency) : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {r.amount > 0 ? formatDaCurrency(r.amount, r.currency) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
                {(() => {
                  const totals = daRows.filter(r => r.amount > 0).reduce<Record<string, number>>((acc, r) => {
                    acc[r.currency] = (acc[r.currency] ?? 0) + r.amount;
                    return acc;
                  }, {});
                  const hasForeign = Object.keys(totals).some(c => c !== 'INR');
                  const combinedINR = Object.entries(totals).reduce((s, [c, a]) => s + (c === 'INR' ? a : a * (FX_TO_INR[c] ?? 0)), 0);
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Per-currency breakdown */}
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DA Breakdown:</span>
                        {Object.entries(totals).map(([cur, total]) => (
                          <span key={cur} className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold border border-green-200">
                            {formatDaCurrency(total, cur)}
                          </span>
                        ))}
                        {Object.keys(totals).length === 0 && <span className="text-gray-400 text-sm">—</span>}
                      </div>
                      {/* Combined INR total */}
                      {hasForeign ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-700 text-white">
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Total DA (INR equiv.)</span>
                          <span className="text-base font-extrabold">{formatINR(combinedINR)}</span>
                          <span className="text-[9px] opacity-60 ml-1">
                            @ {Object.keys(totals).filter(c => c !== 'INR').map(c => `${c}=₹${FX_TO_INR[c] ?? '?'}`).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto DA Total:</span>
                          <span className="text-base font-bold text-green-700">{formatINR(combinedINR)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Section 4: Flight & Travel Details ─────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                    <Plane size={15} className="text-blue-500" />
                    Step 5 — Flight &amp; Travel Details
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Travel booked in Koenig PMS for EMP-<span className="font-mono">{empCode}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-mono text-[10px]">
                      {fmt(fromDate)} → {fmt(toDate)}
                    </span>
                  </p>
                </div>
                {flightsLoading && (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 size={14} className="animate-spin" /> Fetching…
                  </div>
                )}
              </div>

              {/* ILO banner — flight not required when all assignments are online */}
              {(() => {
                const nonIlo = assignments.filter(a => a.batchType && a.batchType.toUpperCase() !== 'ILO');
                const iloOnly = assignments.length > 0 && nonIlo.length === 0;
                const hasIlo  = assignments.some(a => a.batchType?.toUpperCase() === 'ILO');
                if (iloOnly) return (
                  <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>No travel required</strong> — all assignments in Step 2 are <strong>ILO (Online)</strong>.
                      Flights are not applicable for online batches.
                    </span>
                  </div>
                );
                if (hasIlo && nonIlo.length > 0) return (
                  <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Note:</strong> {assignments.filter(a => a.batchType?.toUpperCase() === 'ILO').length} ILO (online) assignment(s) do not require travel.
                      Flights below apply to offline/hybrid assignments only.
                    </span>
                  </div>
                );
                return null;
              })()}

              {/* Error */}
              {flightsError && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle size={13} className="flex-shrink-0" /> {flightsError}
                </div>
              )}

              {/* Summary mini-cards */}
              {!flightsLoading && pmsFlights.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'In Range',      value: pmsFlights.length,
                      sub: `${fmt(fromDate)} → ${fmt(toDate)}`,
                      color: 'bg-blue-50 text-blue-700 border border-blue-100' },
                    { label: 'Active',        value: pmsFlights.filter(f => f.Is_cancelled !== 'Yes').length,
                      sub: `${pmsFlights.filter(f => f.Is_cancelled === 'Yes').length} cancelled`,
                      color: 'bg-green-50 text-green-700 border border-green-100' },
                    { label: 'With Ticket',   value: pmsFlights.filter(f => !!f.ticket_path).length,
                      sub: 'documents available',
                      color: 'bg-teal-50 text-teal-700 border border-teal-100' },
                    { label: 'Transport Types', value: new Set(pmsFlights.map(f => f.transport_type).filter(Boolean)).size || new Set(pmsFlights.map(f => f.airlines_name).filter(Boolean)).size,
                      sub: Array.from(new Set(pmsFlights.map(f => f.transport_type).filter(Boolean))).join(', ') || 'airlines',
                      color: 'bg-purple-50 text-purple-700 border border-purple-100' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-xl px-4 py-3 ${c.color}`}>
                      <p className="text-xs font-medium opacity-70">{c.label}</p>
                      <p className="text-2xl font-bold mt-0.5">{c.value}</p>
                      <p className="text-[10px] opacity-60 mt-0.5 truncate">{c.sub}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Flight / Travel table */}
              {!flightsLoading && !flightsError && pmsFlights.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                      <Plane size={12} />
                      {pmsFlights.filter(f => f.Is_cancelled !== 'Yes').length} active record(s) · sorted oldest → newest
                    </span>
                    <span className="text-[10px] text-blue-600">Departure date within {fmt(fromDate)} → {fmt(toDate)}</span>
                  </div>
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {[
                          'Trip ID', 'Type', 'Flight No.', 'Airline / Carrier',
                          'From', 'To',
                          'Departure', 'Dep. Time',
                          'Arrival', 'Arr. Time',
                          'Status', 'Ticket', 'Insurance', 'Action',
                        ].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap text-[11px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {pmsFlights.map((f, idx) => {
                        const tripKey = String(f.trip_ID ?? `${f.flight_number}-${parseDT(f.departure_date)}`);
                        const alreadyImported = importedTripIds.has(tripKey);
                        const isCancelled = f.Is_cancelled === 'Yes';
                        const depDate = parseDT(f.departure_date);
                        const arrDate = parseDT(f.arrival_date);
                        const transportType = f.transport_type ? String(f.transport_type).trim() : null;
                        const isAir = !transportType || transportType.toLowerCase().includes('flight') || transportType.toLowerCase().includes('air');
                        const typeColor = isAir ? 'bg-blue-100 text-blue-700'
                          : transportType?.toLowerCase().includes('train') ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700';
                        const ticketUrl = f.ticket_path
                          ? (String(f.ticket_path).startsWith('http') ? f.ticket_path as string
                            : `https://api.koenig-solutions.com${String(f.ticket_path).startsWith('/') ? '' : '/'}${f.ticket_path}`)
                          : null;
                        const insuranceUrl = f.insurance_path
                          ? (String(f.insurance_path).startsWith('http') ? f.insurance_path as string
                            : `https://api.koenig-solutions.com${String(f.insurance_path).startsWith('/') ? '' : '/'}${f.insurance_path}`)
                          : null;
                        return (
                          <tr key={idx} className={
                            isCancelled ? 'bg-red-50/50 opacity-70'
                            : alreadyImported ? 'bg-green-50'
                            : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/30'
                            : 'bg-gray-50/40 hover:bg-blue-50/30'
                          }>
                            {/* Trip ID */}
                            <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap font-mono text-[11px]">
                              {f.trip_ID ?? '—'}
                            </td>
                            {/* Transport Type */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {transportType
                                ? <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${typeColor}`}>{transportType}</span>
                                : <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-blue-100 text-blue-700">Flight</span>}
                            </td>
                            {/* Flight No */}
                            <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {f.flight_number ?? '—'}
                            </td>
                            {/* Airline */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {f.airlines_name
                                ? <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700'}`}>{f.airlines_name}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            {/* From */}
                            <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${isCancelled ? 'text-gray-400' : 'text-gray-800'}`}>
                              {f.from_city ?? '—'}
                            </td>
                            {/* To */}
                            <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${isCancelled ? 'text-gray-400' : 'text-gray-800'}`}>
                              {f.to_city ?? '—'}
                            </td>
                            {/* Departure Date */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {depDate
                                ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-teal-50 border border-teal-200 text-teal-800'}`}>{fmt(depDate)}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            {/* Dep Time */}
                            <td className={`px-3 py-2.5 whitespace-nowrap ${isCancelled ? 'text-gray-400' : 'text-gray-600'}`}>
                              {f.departure_time ? parseTM(f.departure_time) : '—'}
                            </td>
                            {/* Arrival Date */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {arrDate
                                ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 border border-orange-200 text-orange-800'}`}>{fmt(arrDate)}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            {/* Arr Time */}
                            <td className={`px-3 py-2.5 whitespace-nowrap ${isCancelled ? 'text-gray-400' : 'text-gray-600'}`}>
                              {f.arrival_time ? parseTM(f.arrival_time) : '—'}
                            </td>
                            {/* Status */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {isCancelled
                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold text-[10px]"><X size={9} /> Cancelled</span>
                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]"><CheckCircle2 size={9} /> Active</span>}
                            </td>
                            {/* Ticket */}
                            <td className="px-3 py-2.5">
                              {ticketUrl
                                ? <a href={ticketUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-medium transition-colors">
                                    <ExternalLink size={10} /> View
                                  </a>
                                : <span className="text-gray-300 text-[11px]">—</span>}
                            </td>
                            {/* Insurance */}
                            <td className="px-3 py-2.5">
                              {insuranceUrl
                                ? <a href={insuranceUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-600 text-[11px] font-medium transition-colors">
                                    <ExternalLink size={10} /> View
                                  </a>
                                : <span className="text-gray-300 text-[11px]">—</span>}
                            </td>
                            {/* Action */}
                            <td className="px-3 py-2.5">
                              {isCancelled
                                ? <span className="text-red-400 text-[11px] font-medium">Cancelled</span>
                                : alreadyImported
                                  ? <span className="inline-flex items-center gap-1 text-green-600 text-[11px] font-medium whitespace-nowrap"><CheckCircle2 size={11} /> Added</span>
                                  : <button type="button" onClick={() => importFlightAsBill(f)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors whitespace-nowrap">
                                      <Plus size={10} /> Add to Bill
                                    </button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!flightsLoading && !flightsError && pmsFlights.length === 0 && fetched && (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  <Plane size={32} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No travel records found for this date range</p>
                  <p className="text-xs mt-1 opacity-60">EMP-<span className="font-mono">{empCode}</span> · {fmt(fromDate)} → {fmt(toDate)}</p>
                  <p className="text-xs mt-1 opacity-50">Travel booked in Koenig PMS will appear here automatically</p>
                </div>
              )}
            </div>

            {/* ── Section 5: Lodging / Hotel Stays ──────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                    <Hotel size={15} className="text-blue-500" />
                    Step 6 — Lodging / Hotel Stays
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Koenig PMS accommodation for{' '}
                    <span className="font-semibold text-gray-600">{fromDate ? fmt(fromDate) : '—'}</span>
                    {' '}→{' '}
                    <span className="font-semibold text-gray-600">{toDate ? fmt(toDate) : '—'}</span>
                    {currentUser?.email && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-100 font-mono text-[10px]">
                        {currentUser.email}
                      </span>
                    )}
                  </p>
                </div>
                {accomLoading && (
                  <div className="flex items-center gap-2 text-xs text-teal-600">
                    <Loader2 size={14} className="animate-spin" />
                    Fetching for {currentUser?.email ?? 'trainer'}…
                  </div>
                )}
              </div>

              {/* API Error */}
              {accomError && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{accomError}</span>
                </div>
              )}

              {/* ── Summary mini-cards ── */}
              {!accomLoading && pmsAccom.length > 0 && (() => {
                const activeStays    = pmsAccom.filter(r => r.Is_caneclled !== '1' && r.Is_caneclled !== 1);
                const cancelledCount = pmsAccom.length - activeStays.length;
                const totalNights    = activeStays.reduce((s, r) => s + (r.Nights ?? 0), 0);
                const cities         = new Set(pmsAccom.map(r => r.CityName).filter(Boolean)).size;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Stays in Range',  value: pmsAccom.length,
                        sub: `${fmt(fromDate)} → ${fmt(toDate)}`,
                        color: 'bg-teal-50 text-teal-700 border border-teal-100' },
                      { label: 'Active Stays',    value: activeStays.length,
                        sub: `${cancelledCount} cancelled`,
                        color: 'bg-green-50 text-green-700 border border-green-100' },
                      { label: 'Total Nights',    value: totalNights,
                        sub: 'active stays only',
                        color: 'bg-blue-50 text-blue-700 border border-blue-100' },
                      { label: 'Cities',          value: cities,
                        sub: 'unique cities',
                        color: 'bg-purple-50 text-purple-700 border border-purple-100' },
                    ].map(c => (
                      <div key={c.label} className={`rounded-xl px-4 py-3 ${c.color}`}>
                        <p className="text-xs font-medium opacity-70">{c.label}</p>
                        <p className="text-2xl font-bold mt-0.5">{c.value}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{c.sub}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Full PMS Accommodation Table (already date-range filtered at fetch time) ── */}
              {!accomLoading && pmsAccom.length > 0 && (() => {
                const rangeRows = pmsAccom; // already filtered and sorted at fetch time
                return (
                  <div className="mb-4 rounded-xl border border-teal-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-teal-50 border-b border-teal-200">
                      <div className="flex items-center gap-2 text-teal-800 text-xs font-semibold">
                        <Hotel size={13} />
                        {rangeRows.length} stay{rangeRows.length !== 1 ? 's' : ''} in range · <span className="font-mono font-normal">{fmt(fromDate)} → {fmt(toDate)}</span>
                      </div>
                      <span className="text-[10px] text-teal-600">Click &quot;+ Import&quot; to add to this bill</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['Emp ID','Trainer','Accommodation','City','Room No','Check-In','Check-Out','Nights','Stay Dates','Status','PDF','Action'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap text-[11px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {rangeRows.map((r, idx) => {
                            const key = `${r.AccommodationName}-${accomDT(r.CheckInDate)}`;
                            const imported = importedAccom.has(key);
                            const ci = accomDT(r.CheckInDate);
                            const co = accomDT(r.CheckOutDate);
                            // Is_caneclled: "1" or 1 = cancelled; "0" or 0 or null = active
                            const isCancelled = r.Is_caneclled === '1' || r.Is_caneclled === 1;
                            const pdfUrl = r.AccommodationPDF
                              ? (String(r.AccommodationPDF).startsWith('http')
                                  ? r.AccommodationPDF as string
                                  : `https://api.koenig-solutions.com${String(r.AccommodationPDF).startsWith('/') ? '' : '/'}${r.AccommodationPDF}`)
                              : null;
                            return (
                              <tr key={idx} className={
                                isCancelled ? 'bg-red-50/60 opacity-70'
                                : imported ? 'bg-green-50'
                                : idx % 2 === 0 ? 'bg-white hover:bg-teal-50/30'
                                : 'bg-gray-50/40 hover:bg-teal-50/30'
                              }>
                                {/* Emp ID */}
                                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap text-[11px] font-mono">{r.EmpId ?? '—'}</td>
                                {/* Trainer Name */}
                                <td className={`px-3 py-2.5 whitespace-nowrap font-medium ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                  {r.TrainerName ?? '—'}
                                </td>
                                {/* Accommodation Name */}
                                <td className="px-3 py-2.5 max-w-[200px]">
                                  <div className={`font-semibold truncate ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`} title={r.AccommodationName ?? ''}>
                                    {r.AccommodationName ?? '—'}
                                  </div>
                                </td>
                                {/* City */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {r.CityName
                                    ? <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-purple-100 text-purple-700'}`}>{r.CityName}</span>
                                    : '—'}
                                </td>
                                {/* Room No */}
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  {r.RoomNo ? <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">{r.RoomNo}</span> : '—'}
                                </td>
                                {/* Check-In */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {ci
                                    ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-teal-50 border border-teal-200 text-teal-800'}`}>{fmt(ci)}</span>
                                    : <span className="text-red-400 font-medium">—</span>}
                                </td>
                                {/* Check-Out */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {co
                                    ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 border border-orange-200 text-orange-800'}`}>{fmt(co)}</span>
                                    : <span className="text-red-400 font-medium">—</span>}
                                </td>
                                {/* Nights */}
                                <td className="px-3 py-2.5 text-center">
                                  {r.Nights != null
                                    ? <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-teal-100 text-teal-700'}`}>{r.Nights}</span>
                                    : '—'}
                                </td>
                                {/* Stay Dates */}
                                <td className="px-3 py-2.5 text-gray-500 max-w-[150px]">
                                  <div className={`truncate text-[11px] ${isCancelled ? 'line-through text-gray-400' : ''}`} title={r.StayDates ?? ''}>
                                    {r.StayDates || (ci && co ? `${fmt(ci)} → ${fmt(co)}` : '—')}
                                  </div>
                                </td>
                                {/* Status (Is_caneclled) */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {isCancelled
                                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold text-[10px]">
                                        <X size={9} /> Cancelled
                                      </span>
                                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">
                                        <CheckCircle2 size={9} /> Active
                                      </span>}
                                </td>
                                {/* PDF */}
                                <td className="px-3 py-2.5">
                                  {pdfUrl
                                    ? <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold transition-colors">
                                        <ExternalLink size={10} /> PDF
                                      </a>
                                    : <span className="text-gray-300 text-[11px]">No PDF</span>}
                                </td>
                                {/* Action */}
                                <td className="px-3 py-2.5">
                                  {isCancelled
                                    ? <span className="text-red-400 text-[11px] font-medium whitespace-nowrap">Cancelled</span>
                                    : imported
                                      ? <span className="inline-flex items-center gap-1 text-green-600 text-[11px] font-medium whitespace-nowrap"><CheckCircle2 size={11} /> Imported</span>
                                      : <button type="button" onClick={() => importAccomAsLodging(r)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold transition-colors whitespace-nowrap">
                                          <Plus size={10} /> Import
                                        </button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Empty state — no PMS data at all */}
              {!accomLoading && !accomError && pmsAccom.length === 0 && fetched && (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 mb-4">
                  <Hotel size={32} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No accommodation records found in PMS</p>
                  <p className="text-xs mt-1 opacity-60">Searched with EMP-<span className="font-mono">{empCode}</span></p>
                  <p className="text-xs mt-2 opacity-50">Add stays manually using the form below</p>
                </div>
              )}

              {/* Manual Entry Form — hidden per product decision */}
              {false && <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">Add Hotel Stay Manually</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Hotel / Accommodation Name *</label>
                    <input className={inputCls} placeholder="e.g. Hotel Lemon Tree" value={lodgingDraft.hotelName || ''}
                      onChange={e => setLodgingDraft(p => ({ ...p, hotelName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">City</label>
                    <input className={inputCls} placeholder="e.g. Bangalore" value={lodgingDraft.city || ''}
                      onChange={e => setLodgingDraft(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Room No.</label>
                    <input className={inputCls} placeholder="e.g. 204" value={lodgingDraft.roomNo || ''}
                      onChange={e => setLodgingDraft(p => ({ ...p, roomNo: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check-In Date</label>
                    <input type="date" className={inputCls} value={lodgingDraft.checkIn || ''}
                      min={fromDate} max={toDate}
                      onChange={e => setLodgingDraft(p => ({ ...p, checkIn: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check-Out Date</label>
                    <input type="date" className={inputCls} value={lodgingDraft.checkOut || ''}
                      min={lodgingDraft.checkIn || fromDate} max={toDate}
                      onChange={e => setLodgingDraft(p => ({ ...p, checkOut: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Rate / Night (INR)</label>
                    <input type="number" className={inputCls} placeholder="₹ 2500" value={lodgingDraft.ratePerNight || ''}
                      onChange={e => setLodgingDraft(p => ({ ...p, ratePerNight: Number(e.target.value) }))} />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-semibold">
                      {calcNights(lodgingDraft.checkIn ?? '', lodgingDraft.checkOut ?? '')} nights
                      {lodgingDraft.ratePerNight ? ` · ₹ ${(calcNights(lodgingDraft.checkIn ?? '', lodgingDraft.checkOut ?? '') * (lodgingDraft.ratePerNight ?? 0)).toLocaleString('en-IN')}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Upload Invoice</label>
                    <label className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload size={12} className="text-gray-400" />
                      <span className="text-gray-500 truncate max-w-[140px]">{lodgingDraft.receipt || 'Choose File'}</span>
                      <input type="file" className="hidden" onChange={e => setLodgingDraft(p => ({ ...p, receipt: e.target.files?.[0]?.name || '' }))} />
                    </label>
                  </div>
                  <button type="button" onClick={addLodgingEntry}
                    disabled={!lodgingDraft.hotelName || !lodgingDraft.checkIn || !lodgingDraft.checkOut}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold mt-4 self-end">
                    <Plus size={13} /> Add Stay
                  </button>
                </div>
              </div>}

              {/* Lodging Entries List */}
              {lodgingEntries.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-xs divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Hotel / Accommodation', 'City', 'Check-In', 'Check-Out', 'Nights', 'Rate/Night', 'Total', 'Source', 'Invoice', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {lodgingEntries.slice().sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || '')).map(l => (
                        <tr key={l.id}>
                          <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[160px]">
                            <div className="truncate">{l.hotelName || '—'}</div>
                            {l.roomNo && <div className="text-[10px] text-gray-400">Room {l.roomNo}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.city || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {l.checkIn
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-[11px]">{fmt(l.checkIn)}</span>
                              : <span className="text-red-400 font-medium">—</span>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {l.checkOut
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 font-semibold text-[11px]">{fmt(l.checkOut)}</span>
                              : <span className="text-red-400 font-medium">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{l.nights}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                            {l.ratePerNight > 0 ? formatINR(l.ratePerNight) : <span className="text-amber-500 text-[11px]">Enter rate</span>}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-green-700 whitespace-nowrap">
                            {l.ratePerNight > 0 ? formatINR(l.nights * l.ratePerNight) : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${l.source === 'pms' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {l.source === 'pms' ? 'PMS' : 'Manual'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {l.receipt
                              ? (l.receipt.startsWith('http')
                                  ? <a href={l.receipt} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-blue-600 hover:underline">
                                      <ExternalLink size={11} /> View
                                    </a>
                                  : <span className="flex items-center gap-1 text-blue-600"><Download size={11} />{l.receipt}</span>)
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <button type="button" onClick={() => removeLodgingEntry(l.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-3 flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-700">Total Lodging</span>
                <span className="text-sm font-bold text-green-700">{formatINR(lodgingTotal)}</span>
              </div>
            </div>

            {/* ── Section 4 & 6: Travel Bills + Misc Expenses ───────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Travel Bills */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-bold text-blue-700">Step 7 — Travel Bills</h3>
                    <p className="text-xs text-gray-400">Booked flights auto-fetched from PMS · add other expenses manually</p>
                  </div>
                  {flightsLoading && <Loader2 size={15} className="animate-spin text-blue-500 flex-shrink-0" />}
                </div>

                {/* ── PMS Flights Panel ─────────────────────────────────────── */}
                {flightsError && (
                  <div className="flex items-center gap-2 mt-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    <span>{flightsError}</span>
                  </div>
                )}

                {!flightsLoading && !flightsError && pmsFlights.length > 0 && (
                  <div className="mt-3 mb-4 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-100 border-b border-blue-200">
                      <div className="flex items-center gap-2 text-blue-800 text-xs font-semibold">
                        <Plane size={13} />
                        Booked Flights from PMS ({pmsFlights.length} flight{pmsFlights.length !== 1 ? 's' : ''} in this date range)
                      </div>
                      <span className="text-[10px] text-blue-600">Click &quot;+ Import&quot; to add a flight as a travel bill</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-blue-200">
                            {['Flight', 'Airline', 'From → To', 'Departure', 'Arrival', 'Ticket', 'Action'].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-blue-700 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100">
                          {pmsFlights.map((f, idx) => {
                            const tripKey = String(f.trip_ID ?? `${f.flight_number}-${parseDT(f.departure_date)}`);
                            const alreadyImported = importedTripIds.has(tripKey);
                            return (
                              <tr key={idx} className={alreadyImported ? 'opacity-50 bg-blue-50' : 'hover:bg-white'}>
                                <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                                  {f.flight_number ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                  {f.airlines_name ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                                  <span className="font-medium">{f.from_city ?? '—'}</span>
                                  <span className="text-gray-400 mx-1">→</span>
                                  <span className="font-medium">{f.to_city ?? '—'}</span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                  {parseDT(f.departure_date) ? fmt(parseDT(f.departure_date)) : '—'}
                                  {f.departure_time && <span className="text-gray-400 ml-1">· {parseTM(f.departure_time)}</span>}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                  {parseDT(f.arrival_date) ? fmt(parseDT(f.arrival_date)) : '—'}
                                  {f.arrival_time && <span className="text-gray-400 ml-1">· {parseTM(f.arrival_time)}</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                  {f.ticket_path
                                    ? <a href={f.ticket_path} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-blue-600 hover:underline text-[11px]">
                                        <ExternalLink size={10} /> View
                                      </a>
                                    : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                  {alreadyImported
                                    ? <span className="flex items-center gap-1 text-green-600 text-[11px] font-medium">
                                        <CheckCircle2 size={11} /> Imported
                                      </span>
                                    : <button
                                        type="button"
                                        onClick={() => importFlightAsBill(f)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors"
                                      >
                                        <Plus size={10} /> Import
                                      </button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!flightsLoading && !flightsError && pmsFlights.length === 0 && fetched && (
                  <div className="mt-3 mb-4 flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                    <Plane size={13} className="text-gray-400 flex-shrink-0" />
                    No booked flights found in PMS for this date range. Add travel expenses manually below.
                  </div>
                )}

                {/* ── Manual Entry Form ─────────────────────────────────────── */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Add Travel Expense Manually</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date</label>
                        <input type="date" className={inputCls} value={travelDraft.date || ''}
                          min={fromDate} max={toDate}
                          onChange={e => {
                            const newDate = e.target.value;
                            setTravelDraft(p => {
                              if (p.journeyType) {
                                const locs = deriveJourneyLocations(p.journeyType, newDate, assignments, lodgingEntries, pmsFlights, currentUser?.pmsDetails);
                                return { ...p, date: newDate, from: locs.from || p.from, to: locs.to || p.to, fromLat: undefined, fromLon: undefined, toLat: undefined, toLon: undefined, distance: '' };
                              }
                              return { ...p, date: newDate };
                            });
                          }} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Travel Type</label>
                        <select className={selectCls} value={travelDraft.travelType}
                          onChange={e => setTravelDraft(p => ({ ...p, travelType: e.target.value }))}>
                          {['Cab', 'Flight', 'Train', 'Bus', 'Own Vehicle', 'Metro'].map(t => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {/* Journey Type */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1 font-semibold">Journey Type</label>
                        <select
                          className={`${selectCls} ${
                            travelDraft.journeyType && travelDraft.date
                              ? validateJourneyType(travelDraft.journeyType, travelDraft.date, assignments).blocked
                                ? 'border-red-400 bg-red-50 focus:ring-red-300'
                                : 'border-green-400 bg-green-50 focus:ring-green-300'
                              : ''
                          }`}
                          value={travelDraft.journeyType || ''}
                          onChange={e => {
                            const jt = e.target.value;
                            const locs = jt
                              ? deriveJourneyLocations(jt, travelDraft.date || '', assignments, lodgingEntries, pmsFlights, currentUser?.pmsDetails)
                              : { from: '', to: '', fromSource: '', toSource: '' };
                            setTravelDraft(p => ({ ...p, journeyType: jt, from: locs.from, to: locs.to, fromLat: undefined, fromLon: undefined, toLat: undefined, toLon: undefined, distance: '' }));
                          }}
                        >
                          {JOURNEY_TYPES.map(jt => (
                            <option key={jt.value} value={jt.value}>{jt.label}</option>
                          ))}
                        </select>

                        {/* Validation feedback */}
                        {travelDraft.journeyType && travelDraft.date && (() => {
                          const v = validateJourneyType(travelDraft.journeyType, travelDraft.date, assignments);
                          return v.blocked ? (
                            <div className="mt-1.5 flex items-start gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                              <span>{v.message}</span>
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                              <CheckCircle2 size={12} className="flex-shrink-0" />
                              <span>{v.message}</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* From — auto-filled + Google Maps style autocomplete */}
                      <div className={`col-span-2 ${(!travelDraft.journeyType || (travelDraft.date && validateJourneyType(travelDraft.journeyType, travelDraft.date, assignments).blocked)) ? 'opacity-40 pointer-events-none' : ''}`}>
                        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin size={11} className="text-blue-500" /> From Location
                        </label>
                        <LocationAutocomplete
                          value={travelDraft.from || ''}
                          onChange={v => setTravelDraft(p => ({ ...p, from: v, fromLat: undefined, fromLon: undefined, distance: '' }))}
                          onSelect={(name, lat, lon) => {
                            setTravelDraft(p => {
                              const toLat = p.toLat, toLon = p.toLon;
                              const dist = (toLat != null && toLon != null)
                                ? `${haversineKm(lat, lon, toLat, toLon).toFixed(1)} km` : '';
                              return { ...p, from: name, fromLat: lat, fromLon: lon, distance: dist };
                            });
                          }}
                          placeholder="Search pickup location…"
                        />
                        {travelDraft.journeyType && travelDraft.from && (() => {
                          const locs = deriveJourneyLocations(travelDraft.journeyType, travelDraft.date || '', assignments, lodgingEntries, pmsFlights, currentUser?.pmsDetails);
                          return locs.fromSource ? (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                              <Info size={10} /> Auto-filled from: {locs.fromSource}
                            </p>
                          ) : null;
                        })()}
                      </div>

                      {/* To — auto-filled + Google Maps style autocomplete */}
                      <div className={`col-span-2 ${(!travelDraft.journeyType || (travelDraft.date && validateJourneyType(travelDraft.journeyType, travelDraft.date, assignments).blocked)) ? 'opacity-40 pointer-events-none' : ''}`}>
                        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin size={11} className="text-red-500" /> To Location
                        </label>
                        <LocationAutocomplete
                          value={travelDraft.to || ''}
                          onChange={v => setTravelDraft(p => ({ ...p, to: v, toLat: undefined, toLon: undefined, distance: '' }))}
                          onSelect={(name, lat, lon) => {
                            setTravelDraft(p => {
                              const fromLat = p.fromLat, fromLon = p.fromLon;
                              const dist = (fromLat != null && fromLon != null)
                                ? `${haversineKm(fromLat, fromLon, lat, lon).toFixed(1)} km` : '';
                              return { ...p, to: name, toLat: lat, toLon: lon, distance: dist };
                            });
                          }}
                          placeholder="Search destination…"
                        />
                        {travelDraft.journeyType && travelDraft.to && (() => {
                          const locs = deriveJourneyLocations(travelDraft.journeyType, travelDraft.date || '', assignments, lodgingEntries, pmsFlights, currentUser?.pmsDetails);
                          return locs.toSource ? (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-red-600 font-medium">
                              <Info size={10} /> Auto-filled from: {locs.toSource}
                            </p>
                          ) : null;
                        })()}
                      </div>

                      {/* Distance — auto-calculated from From/To */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <Ruler size={11} className="text-gray-400" /> Distance
                          {distanceCalculating && (
                            <span className="ml-1 flex items-center gap-1 text-blue-500">
                              <Loader2 size={10} className="animate-spin" /> Calculating…
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            className={`${inputCls} ${travelDraft.distance ? 'bg-green-50 border-green-300 font-semibold text-green-800' : ''}`}
                            placeholder={distanceCalculating ? 'Calculating…' : 'Auto-calculated from locations above'}
                            readOnly={distanceCalculating}
                            value={travelDraft.distance || ''}
                            onChange={e => setTravelDraft(p => ({ ...p, distance: e.target.value }))}
                          />
                          {distanceCalculating && (
                            <Loader2 size={13} className="absolute right-2.5 top-2.5 animate-spin text-blue-400 pointer-events-none" />
                          )}
                        </div>
                        {travelDraft.distance && !distanceCalculating && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-green-600 font-medium">
                            <CheckCircle2 size={10} /> Auto-calculated · edit manually if needed
                          </p>
                        )}
                      </div>

                      {/* Amount + Currency */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <DollarSign size={11} className="text-green-500" /> Amount
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            className="px-2 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[72px]"
                            value={travelDraft.currency || 'INR'}
                            onChange={e => setTravelDraft(p => ({ ...p, currency: e.target.value }))}>
                            {CURRENCIES.map(c => (
                              <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                            ))}
                          </select>
                          <input type="number" className={inputCls} placeholder="0.00"
                            value={travelDraft.amount || ''}
                            onChange={e => setTravelDraft(p => ({ ...p, amount: Number(e.target.value) }))} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Upload Receipt</label>
                        <label className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                          <Upload size={12} className="text-gray-400" />
                          <span className="text-gray-500 truncate max-w-[150px]">{travelDraft.receipt || 'Choose File'}</span>
                          <input type="file" className="hidden" onChange={e => setTravelDraft(p => ({ ...p, receipt: e.target.files?.[0]?.name || '' }))} />
                        </label>
                      </div>
                      <button type="button" onClick={addTravelBill}
                        disabled={
                          !travelDraft.from || !travelDraft.to || !travelDraft.amount ||
                          !travelDraft.journeyType ||
                          (!!travelDraft.journeyType && !!travelDraft.date && validateJourneyType(travelDraft.journeyType, travelDraft.date, assignments).blocked)
                        }
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold mt-4 self-end">
                        <Plus size={13} /> Add Bill
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Travel Bills List ─────────────────────────────────────── */}
                {travelBills.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-xs divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Date', 'Journey', 'Type', 'From → To', 'Amount', 'Receipt', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {travelBills.map(b => (
                          <tr key={b.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(b.date)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {b.journeyType
                                ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">{b.journeyType}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <span className="flex items-center gap-1">
                                {b.travelType === 'Flight' && <Plane size={11} className="text-blue-500" />}
                                {b.travelType}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[120px]">
                              <div className="truncate">{b.from} → {b.to}</div>
                              {b.distance && <div className="text-gray-400">{b.distance}</div>}
                            </td>
                            <td className="px-3 py-2 font-semibold text-green-700 whitespace-nowrap">
                              {b.amount > 0
                                ? <span>{CURRENCIES.find(c => c.code === (b.currency || 'INR'))?.symbol ?? '₹'} {b.amount.toLocaleString('en-IN')}{b.currency && b.currency !== 'INR' ? ` ${b.currency}` : ''}</span>
                                : <span className="text-amber-500 font-medium text-[11px]">Enter amount</span>}
                            </td>
                            <td className="px-3 py-2">
                              {b.receipt
                                ? (b.receipt.startsWith('http')
                                    ? <a href={b.receipt} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-blue-600 hover:underline">
                                        <ExternalLink size={11} /> View
                                      </a>
                                    : <button type="button" className="flex items-center gap-1 text-blue-600 hover:underline">
                                        <Download size={11} />{b.receipt}
                                      </button>)
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => removeTravelBill(b.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">Total Travel Bills</span>
                  <span className="text-sm font-bold text-green-700">{formatINR(travelTotal)}</span>
                </div>
              </div>

              {/* Miscellaneous Expenses */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="mb-1">
                  <h3 className="text-sm font-bold text-blue-700">Step 8 — Miscellaneous Expenses</h3>
                  <p className="text-xs text-gray-400">Add any other eligible expenses</p>
                </div>

                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Expense Type</label>
                      <select className={selectCls} value={miscDraft.expenseType}
                        onChange={e => setMiscDraft(p => ({ ...p, expenseType: e.target.value }))}>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input type="date" className={inputCls} value={miscDraft.date || ''}
                        min={fromDate} max={toDate}
                        onChange={e => setMiscDraft(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Currency</label>
                      <select className={selectCls} value={miscDraft.currency || 'INR'}
                        onChange={e => setMiscDraft(p => ({ ...p, currency: e.target.value }))}>
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Amount</label>
                      <input type="number" className={inputCls} placeholder="150" value={miscDraft.amount || ''}
                        onChange={e => setMiscDraft(p => ({ ...p, amount: Number(e.target.value) }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Remarks</label>
                      <input className={inputCls} placeholder="Internet for training material" value={miscDraft.remarks || ''}
                        onChange={e => setMiscDraft(p => ({ ...p, remarks: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Upload Receipt</label>
                      <label className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload size={12} className="text-gray-400" />
                        <span className="text-gray-500 truncate max-w-[150px]">{miscDraft.receipt || 'Choose File'}</span>
                        <input type="file" className="hidden" onChange={e => setMiscDraft(p => ({ ...p, receipt: e.target.files?.[0]?.name || '' }))} />
                      </label>
                    </div>
                    <button type="button" onClick={addMiscExpense}
                      disabled={!miscDraft.amount}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold mt-4 self-end">
                      <Plus size={13} /> Add Expense
                    </button>
                  </div>
                </div>

                {miscExpenses.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-xs divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Date', 'Type', 'Currency', 'Amount', 'Remarks', 'Receipt', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {miscExpenses.map(e => (
                          <tr key={e.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(e.date)}</td>
                            <td className="px-3 py-2">{e.expenseType}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">{e.currency || 'INR'}</span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-green-700 whitespace-nowrap">{e.amount.toLocaleString()}</td>
                            <td className="px-3 py-2 max-w-[120px] truncate">{e.remarks || '—'}</td>
                            <td className="px-3 py-2">
                              {e.receipt
                                ? <button type="button" className="flex items-center gap-1 text-blue-600 hover:underline"><Download size={11} />{e.receipt}</button>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => removeMiscExpense(e.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">Total Misc Expenses</span>
                  <span className="text-sm font-bold text-green-700">{formatINR(miscTotal)}</span>
                </div>
              </div>

              {/* ── Step 9: Advance Taken ──────────────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-violet-700 flex items-center gap-2">
                      <DollarSign size={15} className="text-violet-500" />
                      Step 9 — Advance Taken
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Advances for EMP-<span className="font-mono">{empCode}</span> within{' '}
                      <span className="font-semibold text-gray-600">{fromDate ? fmt(fromDate) : '—'} → {toDate ? fmt(toDate) : '—'}</span>
                      {' '}— auto-fetched from PMS &amp; deducted from net payable
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {advancesLoading && (
                      <span className="flex items-center gap-1.5 text-xs text-violet-500">
                        <Loader2 size={13} className="animate-spin" /> Fetching from PMS…
                      </span>
                    )}
                    {advancesInRange.length > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase">Total Advance</p>
                        <p className="text-lg font-extrabold text-violet-700">{formatINR(advanceTotal)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error banner */}
                {advancesError && (
                  <div className="mx-5 mb-3 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{advancesError}</span>
                  </div>
                )}

                {/* PMS Advance Records from apikey=259 — filtered to selected date range */}
                {pmsAdvancesInRange.length > 0 && (
                  <div className="px-5 mb-4">
                    <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                      <Info size={11} className="text-violet-400" />
                      {pmsAdvancesInRange.length} Advance{pmsAdvancesInRange.length !== 1 ? 's' : ''} Found in PMS for {fmt(fromDate)} → {fmt(toDate)} — Import to adjust before submitting
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-violet-100">
                      <table className="min-w-full text-xs divide-y divide-gray-100">
                        <thead className="bg-violet-50">
                          <tr>
                            {['Advance ID', 'Emp Name', 'Date', 'Amount', 'Currency', 'Purpose', 'Voucher No.', 'Status', ''].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-violet-700 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {pmsAdvancesInRange.map((r, idx) => {
                            const key = String(r.AdvanceId ?? `${r.EmpId}-${r.AdvanceDate}-${r.AdvanceAmount}`);
                            const alreadyImported = importedAdvanceIds.has(key);
                            const isCancelled = String(r.Status ?? '').toLowerCase().includes('cancel');
                            return (
                              <tr key={idx} className={isCancelled ? 'opacity-50' : 'hover:bg-violet-50/40'}>
                                <td className="px-3 py-2.5 font-mono text-violet-700 font-semibold">
                                  {r.AdvanceId ? `#${r.AdvanceId}` : '—'}
                                </td>
                                <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                                  {r.EmpName || '—'}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                                  {parseDT(r.AdvanceDate) ? fmt(parseDT(r.AdvanceDate)) : (r.AdvanceDate || '—')}
                                </td>
                                <td className="px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap">
                                  {r.AdvanceAmount != null
                                    ? Number(r.AdvanceAmount).toLocaleString('en-IN')
                                    : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600">{r.Currency || 'INR'}</td>
                                <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate">{r.Purpose || '—'}</td>
                                <td className="px-3 py-2.5 font-mono text-gray-400 text-[11px]">{r.VoucherNo || '—'}</td>
                                <td className="px-3 py-2.5">
                                  {r.Status ? (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      isCancelled
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-green-100 text-green-700'
                                    }`}>{r.Status}</span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {isCancelled ? (
                                    <span className="text-[10px] text-red-400 font-medium">Cancelled</span>
                                  ) : alreadyImported ? (
                                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                                      <CheckCircle2 size={11} /> Imported
                                    </span>
                                  ) : (
                                    <button type="button"
                                      onClick={() => importAdvance(r)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-semibold transition-colors">
                                      <Plus size={10} /> Import
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* No PMS advances in range */}
                {!advancesLoading && pmsAdvancesInRange.length === 0 && !advancesError && (
                  <div className="mx-5 mb-4 flex items-center gap-2 py-3 px-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                    <DollarSign size={14} className="opacity-40" />
                    {pmsAdvances.length > 0
                      ? `No advances found within ${fmt(fromDate)} → ${fmt(toDate)} (${pmsAdvances.length} record${pmsAdvances.length !== 1 ? 's' : ''} outside this range in PMS)`
                      : 'No advance records found in PMS for this employee'}
                  </div>
                )}

                <div className="px-5 pb-4">
                  {/* Manual add form */}
                  <p className="text-xs font-semibold text-gray-600 mb-2 mt-1">Add Advance Manually</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date Received</label>
                        <input type="date" className={inputCls} value={advanceDraft.date || ''}
                          min={fromDate} max={toDate}
                          onChange={e => setAdvanceDraft(p => ({ ...p, date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Amount & Currency</label>
                        <div className="flex gap-1.5">
                          <select
                            className="px-2 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[72px]"
                            value={advanceDraft.currency || 'INR'}
                            onChange={e => setAdvanceDraft(p => ({ ...p, currency: e.target.value }))}>
                            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
                          </select>
                          <input type="number" className={inputCls} placeholder="0.00"
                            value={advanceDraft.amount || ''}
                            onChange={e => setAdvanceDraft(p => ({ ...p, amount: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Purpose</label>
                        <input className={inputCls} placeholder="e.g. Travel advance"
                          value={advanceDraft.purpose || ''}
                          onChange={e => setAdvanceDraft(p => ({ ...p, purpose: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Reference / Voucher No.</label>
                        <input className={inputCls} placeholder="e.g. ADV-2026-001"
                          value={advanceDraft.reference || ''}
                          onChange={e => setAdvanceDraft(p => ({ ...p, reference: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={addAdvance}
                        disabled={!advanceDraft.amount || !advanceDraft.date}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
                        <Plus size={13} /> Add Advance
                      </button>
                    </div>
                  </div>

                  {/* Imported / manually added advances list */}
                  {advancesInRange.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 mt-4 mb-3">
                      <table className="min-w-full text-xs divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Date', 'Purpose', 'Voucher / Reference', 'Currency', 'Amount', ''].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {advancesInRange.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2.5 whitespace-nowrap">{a.date ? fmt(a.date) : '—'}</td>
                              <td className="px-3 py-2.5 text-gray-700">{a.purpose || '—'}</td>
                              <td className="px-3 py-2.5 font-mono text-gray-400 text-[11px]">{a.reference || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-600">{a.currency || 'INR'}</td>
                              <td className="px-3 py-2.5 font-bold text-violet-700 whitespace-nowrap">
                                {CURRENCIES.find(c => c.code === (a.currency || 'INR'))?.symbol}{' '}
                                {a.amount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2.5">
                                <button type="button" onClick={() => removeAdvance(a.id)} className="text-red-400 hover:text-red-600">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Net payable summary */}
                  {advancesInRange.length > 0 && (
                    <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex flex-wrap gap-6 items-center">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Grand Total</p>
                          <p className="font-bold text-gray-800">{formatINR(grandTotal)}</p>
                        </div>
                        <span className="text-gray-400 text-base">−</span>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Advance (INR)</p>
                          <p className="font-bold text-violet-700">{formatINR(advanceTotal)}</p>
                        </div>
                        <span className="text-gray-400 text-base">=</span>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Net Payable</p>
                          <p className="text-xl font-extrabold text-green-700">{formatINR(Math.max(0, grandTotal - advanceTotal))}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {advancesInRange.length === 0 && pmsAdvancesInRange.length === 0 && !advancesLoading && (
                    <div className="flex items-center gap-2 py-4 justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs mt-3">
                      <DollarSign size={16} className="opacity-40" />
                      No advances recorded for this date range
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Employee Remarks ───────────────────────────────────────────────────── */}
      {fetched && (
        <div className="max-w-4xl mx-auto px-4 mt-5">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-1">
              <MessageSquare size={15} className="text-blue-500" />
              Employee Remarks
            </h3>
            <p className="text-xs text-gray-400 mb-3">Add any comments or notes before submitting your claim</p>
            <textarea
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white resize-none"
              placeholder="Enter your remarks here (optional)…"
              value={employeeRemarks}
              onChange={e => setEmployeeRemarks(e.target.value)}
            />
            {employeeRemarks.trim() && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">{employeeRemarks.length} character{employeeRemarks.length !== 1 ? 's' : ''}</span>
                <button type="button" onClick={() => setEmployeeRemarks('')}
                  className="text-xs text-red-400 hover:text-red-600 underline transition-colors">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 9: Claim Review & Submit ──────────────────────────────────────── */}
      {fetched && (
        <div className="max-w-4xl mx-auto px-4 pb-40">
          <div className="bg-white border-2 border-blue-200 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} /> Step 9 — Claim Review &amp; Submit
              </h2>
              <p className="text-blue-100 text-xs mt-0.5">All steps consolidated — verify before submitting</p>
            </div>

            <div className="p-6 space-y-4">

              {/* ── Row 1: Date Range + Assignments ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Step 1 — Date Range</p>
                  <p className="text-sm font-bold text-gray-800">
                    {fmt(fromDate)} <span className="text-gray-400 font-normal">→</span> {fmt(toDate)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {assignmentDates.length} day{assignmentDates.length !== 1 ? 's' : ''} in period
                    {currentUser?.email && <span className="ml-1 text-gray-400">· {currentUser.email}</span>}
                  </p>
                </div>

                {/* Step 2 */}
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Step 2 — Assignments</p>
                  {assignments.length > 0 ? (
                    <div className="space-y-1">
                      {assignments.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{a.courseName || a.clientName}</span>
                        </div>
                      ))}
                      {assignments.length > 2 && (
                        <p className="text-xs text-gray-400 ml-5">+{assignments.length - 2} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={11} /> No assignments found</p>
                  )}
                </div>
              </div>

              {/* ── Row 2: Leave Dates + DA ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Step 3 */}
                <div className="rounded-xl border border-orange-200 p-4 bg-orange-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-1">Step 3 — Leave Dates</p>
                  {leaveDates.size > 0 ? (
                    <>
                      <p className="text-sm font-bold text-orange-700">{leaveDates.size} leave day{leaveDates.size !== 1 ? 's' : ''} marked</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Array.from(leaveDates).sort().map(d => (
                          <span key={d} className="px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 text-[10px] font-medium">{fmt(d)}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 size={11} /> No leave days — full DA eligible</p>
                  )}
                </div>

                {/* Step 4 */}
                <div className="rounded-xl border border-green-200 p-4 bg-green-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">Step 4 — DA Eligibility</p>
                  {/* Individual currency amounts */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {autoDATotal > 0 && (
                      <span className="text-xl font-extrabold text-green-700">{formatINR(autoDATotal)}</span>
                    )}
                    {Object.entries(foreignDAMap).map(([cur, amt]) => (
                      <span key={cur} className="text-xl font-extrabold text-green-700">{formatDaCurrency(amt, cur)}</span>
                    ))}
                    {autoDATotal === 0 && Object.keys(foreignDAMap).length === 0 && (
                      <span className="text-xl font-extrabold text-green-700">₹0</span>
                    )}
                  </div>
                  {/* Combined INR equivalent when foreign DA exists */}
                  {Object.keys(foreignDAMap).length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-100 border border-green-300">
                      <span className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Total DA (INR equiv.)</span>
                      <span className="text-sm font-extrabold text-green-800 ml-auto">
                        {formatINR(autoDATotal + foreignDATotalINR)}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                    <p>{daRows.filter(r => r.amount > 0).length} eligible day{daRows.filter(r => r.amount > 0).length !== 1 ? 's' : ''} × rate</p>
                    {Object.keys(foreignDAMap).length > 0 && (
                      <p className="text-green-600">
                        Foreign DA converted @ {Object.entries(foreignDAMap).map(([c]) => `${c} = ₹${FX_TO_INR[c] ?? '?'}`).join(', ')} (indicative)
                      </p>
                    )}
                    {leaveDates.size > 0 && (
                      <p className="text-orange-600">{leaveDates.size} leave day{leaveDates.size !== 1 ? 's' : ''} deducted</p>
                    )}
                    {daRows.filter(r => r.amount === 0 && !leaveDates.has(r.iso)).length > 0 && (
                      <p className="text-red-500">{daRows.filter(r => r.amount === 0 && !leaveDates.has(r.iso)).length} ineligible day{daRows.filter(r => r.amount === 0 && !leaveDates.has(r.iso)).length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Row 3: Flights + Lodging ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Step 5 */}
                <div className="rounded-xl border border-blue-200 p-4 bg-blue-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Step 5 — Flights</p>
                  {pmsFlights.length > 0 ? (
                    <>
                      <p className="text-sm font-bold text-blue-700">{pmsFlights.length} flight{pmsFlights.length !== 1 ? 's' : ''} in PMS</p>
                      <div className="mt-1 space-y-0.5">
                        {pmsFlights.slice(0, 2).map((f, i) => (
                          <p key={i} className="text-xs text-gray-600 truncate">
                            {f.airlines_name || '—'} · {f.from_city} → {f.to_city} · {parseDT(f.departure_date) ? fmt(parseDT(f.departure_date)) : '—'}
                          </p>
                        ))}
                        {pmsFlights.length > 2 && <p className="text-xs text-gray-400">+{pmsFlights.length - 2} more</p>}
                      </div>
                      <p className="text-xs text-blue-600 mt-1">{importedTripIds.size} added to bill</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Info size={11} /> No flights in PMS for this range</p>
                  )}
                </div>

                {/* Step 6 */}
                <div className="rounded-xl border border-teal-200 p-4 bg-teal-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400 mb-1">Step 6 — Lodging</p>
                  {lodgingEntries.length > 0 ? (
                    <>
                      <p className="text-xl font-extrabold text-teal-700">{formatINR(lodgingTotal)}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {lodgingEntries.map((l, i) => (
                          <p key={i} className="truncate">
                            {l.hotelName || '—'} · {l.nights} night{l.nights !== 1 ? 's' : ''}
                            {l.ratePerNight > 0 ? ` · ${formatINR(l.ratePerNight)}/night` : ' · rate pending'}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Info size={11} /> No lodging added</p>
                  )}
                </div>
              </div>

              {/* ── Row 4: Travel Bills + Misc ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Step 7 */}
                <div className="rounded-xl border border-indigo-200 p-4 bg-indigo-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">Step 7 — Travel Bills</p>
                  {travelBills.length > 0 ? (
                    <>
                      <p className="text-xl font-extrabold text-indigo-700">{formatINR(travelTotal)}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {travelBills.map((b, i) => (
                          <p key={i} className="truncate">{b.travelType} · {b.from} → {b.to} · {formatINR(b.amount)}</p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Info size={11} /> No travel bills added</p>
                  )}
                </div>

                {/* Step 8 */}
                <div className="rounded-xl border border-purple-200 p-4 bg-purple-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">Step 8 — Miscellaneous</p>
                  {miscExpenses.length > 0 ? (
                    <>
                      <p className="text-xl font-extrabold text-purple-700">{formatINR(miscTotal)}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {miscExpenses.map((e, i) => (
                          <p key={i} className="truncate">{e.expenseType} · {formatINR(e.amount)}</p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Info size={11} /> No misc expenses added</p>
                  )}
                </div>
              </div>

              {/* ── Grand Total Banner ── */}
              <div className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6 text-white text-center">
                  {/* INR DA */}
                  <div>
                    <p className="text-[10px] opacity-70 uppercase tracking-wider">DA {Object.keys(foreignDAMap).length > 0 ? '(INR)' : ''}</p>
                    <p className="text-base font-bold">{formatINR(autoDATotal)}</p>
                  </div>
                  {/* Foreign currency DA */}
                  {Object.entries(foreignDAMap).map(([cur, amt]) => (
                    <div key={cur}>
                      <p className="text-[10px] opacity-70 uppercase tracking-wider">DA ({cur})</p>
                      <p className="text-base font-bold">{formatDaCurrency(amt, cur)}</p>
                    </div>
                  ))}
                  {/* Travel, Lodging, Misc */}
                  {[
                    { label: 'Travel', value: travelTotal },
                    { label: 'Lodging', value: lodgingTotal },
                    { label: 'Misc', value: miscTotal },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] opacity-70 uppercase tracking-wider">{item.label}</p>
                      <p className="text-base font-bold">{formatINR(item.value)}</p>
                    </div>
                  ))}
                  <div className="border-l border-blue-400 pl-6">
                    <p className="text-[10px] opacity-70 uppercase tracking-wider">Grand Total (INR)</p>
                    <p className="text-2xl font-extrabold">{formatINR(grandTotal)}</p>
                    {Object.keys(foreignDAMap).length > 0 && (
                      <p className="text-[10px] opacity-75 mt-0.5">
                        Incl. {Object.entries(foreignDAMap).map(([c, a]) => `${formatDaCurrency(a, c)} @ ~${FX_TO_INR[c] ?? '?'}₹`).join(' + ')} (indicative)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => navigate('/claims')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-semibold border border-white/30 transition-colors">
                    <Save size={15} /> Save Draft
                  </button>
                  <button type="button" onClick={handleSubmit}
                    disabled={submitSuccess}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 text-sm font-bold transition-colors shadow disabled:opacity-60">
                    {submitSuccess ? <CheckCircle2 size={15} className="text-green-600" /> : <Send size={15} />}
                    {submitSuccess ? 'Submitted!' : 'Submit Claim'}
                  </button>
                </div>
              </div>

              {/* ── Readiness Checklist ── */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-600 mb-3 uppercase tracking-wider">Pre-submission Checklist</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { ok: !!fromDate && !!toDate,          label: 'Date range selected' },
                    { ok: assignments.length > 0,           label: 'At least one assignment fetched' },
                    { ok: true,                             label: `Leave dates reviewed (${leaveDates.size} marked)` },
                    { ok: autoDATotal > 0 || Object.keys(foreignDAMap).length > 0, label: 'DA calculated (eligible days found)' },
                    { ok: lodgingEntries.length > 0 || pmsAccom.length === 0, label: 'Lodging reviewed' },
                    { ok: travelBills.length > 0 || pmsFlights.length === 0, label: 'Travel bills reviewed' },
                    { ok: grandTotal > 0,                   label: 'Claim has a non-zero total' },
                    { ok: lodgingEntries.every(l => l.ratePerNight > 0), label: 'All lodging rates entered' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {item.ok
                        ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                        : <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />}
                      <span className={item.ok ? 'text-gray-700' : 'text-amber-700 font-medium'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Sticky bottom bar ─────────────────────────────────────────────────── */}
      {fetched && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-xl">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
              <span className="text-sm font-bold">Claim Summary</span>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-5 text-center">
              {/* DA — INR */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">DA {Object.keys(foreignDAMap).length > 0 ? '(INR)' : ''}</p>
                <p className="text-sm font-bold text-green-700">{formatINR(autoDATotal)}</p>
              </div>
              {/* DA — foreign currencies */}
              {Object.entries(foreignDAMap).map(([cur, amt]) => (
                <div key={cur}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">DA ({cur})</p>
                  <p className="text-sm font-bold text-green-700">{formatDaCurrency(amt, cur)}</p>
                </div>
              ))}
              {/* Travel, Lodging, Misc */}
              {[
                { label: 'Travel', value: travelTotal, color: 'text-indigo-700' },
                { label: 'Lodging', value: lodgingTotal, color: 'text-teal-700' },
                { label: 'Misc', value: miscTotal, color: 'text-purple-700' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{formatINR(item.value)}</p>
                </div>
              ))}
              <div className="border-l border-gray-200 pl-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Grand Total (INR)</p>
                <p className="text-lg font-extrabold text-blue-700">{formatINR(grandTotal)}</p>
                {Object.keys(foreignDAMap).length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Incl. {Object.entries(foreignDAMap).map(([c, a]) => `${formatDaCurrency(a, c)} @ ~${FX_TO_INR[c] ?? '?'}₹`).join(' + ')} (indicative)
                  </p>
                )}
              </div>
              {leaveDates.size > 0 && (
                <div className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                  {leaveDates.size} leave day{leaveDates.size !== 1 ? 's' : ''} excluded
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button type="button" onClick={() => navigate('/claims')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                <Save size={14} /> Save Draft
              </button>
              <button type="button" onClick={handleSubmit}
                disabled={submitSuccess}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60">
                {submitSuccess ? <CheckCircle2 size={14} /> : <Send size={14} />}
                {submitSuccess ? 'Submitted!' : 'Submit Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
