import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Send,
  CheckCircle2,
  BadgeCheck,
  XCircle,
  BookOpen,
  ArrowRight,
  Bell,
  CalendarDays,
  Plane, Calendar,
  ChevronRight, Search, Eye,
  Loader2, AlertCircle, ExternalLink,
} from 'lucide-react';

import KpiCard from '../components/KpiCard';
import { getClaims } from '../services/storageService';
import type { User, ClaimHeader } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  const abs = Math.abs(Math.round(amount)).toString();
  if (abs.length <= 3) return `${amount < 0 ? '-' : ''}₹${abs}`;
  const last3 = abs.slice(-3);
  const rest = abs.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}₹${rest},${last3}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Trainer Flight Details API (api_key=108) ──────────────────────────────────

interface FlightRecord {
  trip_ID: number | null;
  flight_number: string | null;
  from_city: string | null;
  to_city: string | null;
  departure_date: string | null;   // "2026-07-04T00:00:00"
  departure_time: string | null;   // "16:00:00"
  arrival_date: string | null;
  arrival_time: string | null;
  connecting_flight_id: number | null;
  Is_cancelled: string | null;     // "Yes" | "No"
  ticket_path: string | null;
  insurance_path: string | null;
  airlines_name: string | null;
}

// Fetch flights via server-side proxy (credentials stay out of the browser bundle)
async function fetchFlights(email: string, empCode: string): Promise<FlightRecord[]> {
  const params = new URLSearchParams();
  if (email)   params.set('email',   email);
  if (empCode) params.set('empCode', empCode);
  const res = await fetch(`/api/flights?${params.toString()}`);
  const d = await res.json();
  if (!res.ok) return [];
  const raw = d.flights ?? d;
  return Array.isArray(raw) ? raw : [];
}

// "2026-07-04T00:00:00" → "2026-07-04"
function parseDT(dt: string | null): string {
  return dt ? dt.slice(0, 10) : '';
}
// "16:00:00" → "16:00"
function parseTM(t: string | null): string {
  return t ? t.slice(0, 5) : '';
}
// "2026-07-04" → formatted display
function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// Map mockClaims status strings to ClaimHeader status type
// mockClaims uses uppercase strings like 'SUBMITTED', 'DRAFT', etc.
// ClaimTable expects proper ClaimStatus type — we need to normalise
// ── Props ──────────────────────────────────────────────────────────────────────

interface TrainerDashboardProps {
  currentUser?: User;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TrainerDashboard({ currentUser }: TrainerDashboardProps) {
  const navigate = useNavigate();

  const trainerName = currentUser?.name || '';

  const [myClaims, setMyClaims] = useState<ClaimHeader[]>([]);

  useEffect(() => {
    const all = getClaims();
    const mine = all.filter(
      c => c.trainerId === (currentUser?.trainerId || currentUser?.id) ||
           c.trainerName === trainerName
    );
    setMyClaims(mine);
  }, [currentUser, trainerName]);

  // Upcoming travel state (live API)
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState('');
  const [travelSearch, setTravelSearch] = useState('');
  const [travelExpanded, setTravelExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role !== 'Trainer') return;
    const email     = currentUser?.email ?? '';
    const trainerId = currentUser?.trainerId ?? '';
    if (!email && !trainerId) return;

    setFlightsLoading(true);
    setFlightsError('');

    fetchFlights(email, trainerId)
      .then(data => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isCancelled = (f: FlightRecord) =>
          (f.Is_cancelled ?? '').toLowerCase() === 'yes' || String(f.Is_cancelled) === '1';
        const upcoming = data.filter(f => {
          if (isCancelled(f)) return false;
          const dep = parseDT(f.departure_date);
          return dep !== '' && new Date(dep) >= today;
        });
        upcoming.sort((a, b) => parseDT(a.departure_date).localeCompare(parseDT(b.departure_date)));
        setFlights(upcoming);
      })
      .catch(err => setFlightsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setFlightsLoading(false));
  }, [currentUser?.email, currentUser?.role, currentUser?.trainerId]);

  const filteredFlights = flights.filter(f => {
    const q = travelSearch.toLowerCase();
    return (
      (f.airlines_name ?? '').toLowerCase().includes(q) ||
      (f.from_city ?? '').toLowerCase().includes(q) ||
      (f.to_city ?? '').toLowerCase().includes(q) ||
      (f.flight_number ?? '').toLowerCase().includes(q)
    );
  });

  const nearestDays = filteredFlights.length > 0
    ? daysUntil(parseDT(filteredFlights[0].departure_date))
    : null;

  // KPI counts — myClaims already uses proper ClaimStatus strings
  const kpi = useMemo(() => {
    const st = (c: ClaimHeader) => c.status;
    const pending = myClaims.filter(c => ['Submitted', 'Under Review'].includes(st(c))).length;
    const draft = myClaims.filter(c => st(c) === 'Draft').length;
    const submitted = myClaims.filter(c => st(c) === 'Submitted').length;
    const clarification = myClaims.filter(c => st(c) === 'Clarification Required').length;
    const approved = myClaims.filter(c => ['Approved', 'Partially Approved'].includes(st(c))).length;
    const paymentPendingAmt = myClaims
      .filter(c => st(c) === 'Payment Pending')
      .reduce((s, c) => s + (c.netPayable ?? c.approvedAmount ?? 0), 0);
    const paid = myClaims.filter(c => st(c) === 'Paid').length;
    const rejected = myClaims.filter(c => st(c) === 'Rejected').length;
    const totalClaimed = myClaims.reduce((s, c) => s + (c.totalClaimedAmount ?? 0), 0);
    const totalApproved = myClaims.reduce((s, c) => s + (c.approvedAmount ?? 0), 0);
    const totalDeducted = myClaims.reduce((s, c) => s + (c.deductionAmount ?? 0), 0);
    return { pending, draft, submitted, clarification, approved, paymentPendingAmt, paid, rejected, totalClaimed, totalApproved, totalDeducted };
  }, [myClaims]);

  const clarificationClaims = useMemo(
    () => myClaims.filter(c => c.status === 'Clarification Required'),
    [myClaims]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 px-6 py-10 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Left: greeting */}
            <div>
              <p className="text-blue-100 text-sm font-medium tracking-wide mb-1 uppercase">
                Koenig Solutions — TA/DA Portal
              </p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Welcome back, {trainerName}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-blue-100 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Trainer
                </span>
                <span className="text-blue-300">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  {todayFormatted()}
                </span>
              </div>
              <p className="mt-3 text-blue-100 text-sm max-w-xl leading-relaxed">
                Track your TA/DA claims, eligible assignments, payments, and pending actions all in one place.
              </p>
            </div>

            {/* Right: CTA buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate('/claims')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 border-white text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View My Bills
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-10">

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

            <KpiCard
              title="Pending TA/DA Bills"
              value={kpi.pending}
              subtitle="Submitted or Under Review"
              icon={Clock}
              accentColor="yellow"
              onClick={() => navigate('/claims?status=pending')}
            />

            <KpiCard
              title="Submitted Bills"
              value={kpi.submitted}
              subtitle="Awaiting HR/Admin review"
              icon={Send}
              accentColor="blue"
              onClick={() => navigate('/claims?status=submitted')}
            />

            <KpiCard
              title="Approved Bills"
              value={kpi.approved}
              subtitle="Approved by HR/Finance"
              icon={CheckCircle2}
              accentColor="green"
              onClick={() => navigate('/claims?status=approved')}
            />

            <KpiCard
              title="Paid Bills"
              value={kpi.paid}
              subtitle="Fully disbursed"
              icon={BadgeCheck}
              accentColor="green"
              onClick={() => navigate('/claims?status=paid')}
            />

            <KpiCard
              title="Rejected Bills"
              value={kpi.rejected}
              subtitle="Rejected — see reason"
              icon={XCircle}
              accentColor="red"
              onClick={() => navigate('/claims?status=rejected')}
            />

          </div>
        </section>

        {/* ── Clarification Required Panel ─────────────────────────────────── */}
        {clarificationClaims.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-semibold text-gray-700">
                Action Required — Clarification
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                {clarificationClaims.length}
              </span>
            </div>
            <div className="space-y-3">
              {clarificationClaims.map((claim) => (
                <div
                  key={claim.claimId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-800 text-sm">
                        {claim.billNo}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                        Clarification Required
                      </span>
                      {claim.agingDays > 0 && (
                        <span className="text-xs text-gray-400">
                          {claim.agingDays}d pending
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{claim.clientName}</span>
                      {claim.baseCity && (
                        <span className="text-gray-400"> · {claim.baseCity}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Claimed: <span className="font-medium text-gray-700">{formatINR(claim.totalClaimedAmount ?? 0)}</span>
                      {claim.submittedAt && (
                        <span> · Submitted {formatDate(claim.submittedAt)}</span>
                      )}
                    </p>
                    {claim.adminRemark && (
                      <p className="mt-2 text-xs text-orange-800 bg-orange-100 rounded px-3 py-1.5 italic border border-orange-200">
                        Reviewer note: {claim.adminRemark}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/claims/${claim.claimId}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors flex-shrink-0"
                  >
                    Respond
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Upcoming Travel ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700">Upcoming Travel</h2>
              <p className="text-xs text-gray-400 mt-0.5">Booked flights fetched live from PMS</p>
            </div>
            {flightsLoading && (
              <Loader2 size={18} className="animate-spin text-blue-500" />
            )}
          </div>

          {/* Error */}
          {flightsError && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{flightsError}</span>
            </div>
          )}

          {/* Summary mini-cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total upcoming', value: flights.length, color: 'bg-blue-50 text-blue-700' },
              { label: 'Domestic', value: flights.filter(f => (f.from_city ?? '').length > 0 && (f.to_city ?? '') === (f.to_city ?? '')).length, color: 'bg-green-50 text-green-700' },
              { label: 'With ticket', value: flights.filter(f => !!f.ticket_path).length, color: 'bg-amber-50 text-amber-700' },
              { label: 'Next flight in', value: nearestDays !== null ? (nearestDays === 0 ? 'Today' : nearestDays === 1 ? 'Tomorrow' : `${nearestDays}d`) : '—', color: 'bg-purple-50 text-purple-700' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl p-3 ${c.color}`}>
                <p className="text-xs font-medium opacity-70">{c.label}</p>
                <p className="text-2xl font-bold mt-0.5">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={travelSearch}
                onChange={e => setTravelSearch(e.target.value)}
                placeholder="Search by airline, city, or flight number…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
              />
            </div>
          </div>

          {/* Flight cards */}
          <div className="space-y-3">
            {!flightsLoading && !flightsError && filteredFlights.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Plane size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {flights.length === 0
                    ? 'No upcoming flights found for your account.'
                    : 'No flights match your search.'}
                </p>
              </div>
            )}
            {filteredFlights.map((f, idx) => {
              const depDate = parseDT(f.departure_date);
              const arrDate = parseDT(f.arrival_date);
              const depTime = parseTM(f.departure_time);
              const arrTime = parseTM(f.arrival_time);
              const days = depDate ? daysUntil(depDate) : null;
              const cardId = String(f.trip_ID ?? idx);
              const isExpanded = travelExpanded === cardId;
              return (
                <div key={cardId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTravelExpanded(isExpanded ? null : cardId)}
                    className="w-full text-left px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                          <Plane size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-sm">
                              {f.from_city ?? '—'} → {f.to_city ?? '—'}
                            </span>
                            {f.airlines_name && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                {f.airlines_name}
                              </span>
                            )}
                            {f.flight_number && (
                              <span className="text-xs text-gray-400">{f.flight_number}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                            {depDate && (
                              <span className="flex items-center gap-1">
                                <Calendar size={11} />
                                {fmtDate(depDate)}{depTime ? ` · ${depTime}` : ''}
                              </span>
                            )}
                            {days !== null && (
                              <span className="flex items-center gap-1 text-blue-600 font-medium">
                                <Clock size={11} />
                                {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`flex-shrink-0 text-gray-400 mt-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Departure</p>
                          <p className="text-sm font-medium text-gray-700">
                            {fmtDate(depDate)}{depTime ? ` at ${depTime}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Arrival</p>
                          <p className="text-sm font-medium text-gray-700">
                            {fmtDate(arrDate)}{arrTime ? ` at ${arrTime}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Trip ID</p>
                          <p className="text-sm font-medium text-gray-700">{f.trip_ID ?? '—'}</p>
                        </div>
                        {f.connecting_flight_id != null && (
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Connecting flight ID</p>
                            <p className="text-sm font-medium text-gray-700">{f.connecting_flight_id}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {f.ticket_path && (
                          <a
                            href={f.ticket_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                          >
                            <ExternalLink size={12} /> View Ticket
                          </a>
                        )}
                        {f.insurance_path && (
                          <a
                            href={f.insurance_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                          >
                            <ExternalLink size={12} /> Insurance
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}


