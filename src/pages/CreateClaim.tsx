import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CheckCircle, Plus, Trash2, Upload,
  Plane, Train, Bus, Car, Clock, Info,
} from 'lucide-react';
import type { User } from '../types';
import { saveClaim, clearDraftWizard } from '../services/storageService';
import { formatDate, formatINR } from '../services/calculationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TravelLeg {
  id: string; mode: string; from: string; to: string;
  departureDate: string; arrivalDate: string; fare: number; currency: string; pnr: string;
  receipt: string;
}
interface CabEntry {
  id: string; date: string; from: string; to: string; amount: number; currency: string; receipt: string;
}
interface HotelStay {
  id: string; hotelName: string; checkIn: string; checkOut: string;
  ratePerNight: number; currency: string; stayType: string; receipt: string;
}
interface OtherExpense {
  id: string; category: string; description: string; date: string;
  amount: number; currency: string; receipt: string;
}
interface AdvanceRecord {
  id: string; label: string; amount: number; selected: boolean;
}

interface FormData {
  // Tab 1
  trainerName: string; empCode: string; department: string; baseCity: string;
  assignmentId: string; clientName: string; venue: string; country: string; city: string;
  assignmentStart: string; assignmentEnd: string;
  // Tab 2
  claimFrom: string; claimTo: string;
  travelLegs: TravelLeg[]; cabEntries: CabEntry[];
  // Tab 3
  leaveDates: string; staybackDates: string;
  hotelStays: HotelStay[]; otherExpenses: OtherExpense[];
  // Tab 4
  advances: AdvanceRecord[];
  // Tab 5
  remarks: string; declared: boolean;
}

const DEFAULT: FormData = {
  trainerName: '', empCode: '', department: '', baseCity: '',
  assignmentId: '', clientName: '', venue: '', country: 'India', city: '',
  assignmentStart: '', assignmentEnd: '',
  claimFrom: '', claimTo: '',
  travelLegs: [], cabEntries: [],
  leaveDates: '', staybackDates: '',
  hotelStays: [], otherExpenses: [],
  advances: [
    { id: 'adv1', label: 'ADV-2026-001 — Travel advance (May)', amount: 5000, selected: false },
    { id: 'adv2', label: 'ADV-2026-002 — Hotel advance (Pune)', amount: 8000, selected: false },
  ],
  remarks: '', declared: false,
};

const TABS = ['Trainer & Assignment', 'Travel Details', 'DA & Lodging', 'Advance & Summary', 'Preview & Submit'];
const MODES = ['Flight', 'Train', 'Bus', 'Cab', 'Own Vehicle'];
const STAY_TYPES = ['Self Booked', 'Company Provided', 'Apartment', 'Not Applicable'];
const EXP_CATS = ['Meal', 'Visa', 'Insurance', 'Internet', 'Laundry', 'Other'];

const CAB_ROUTES = [
  'Custom',
  'Home → Airport',
  'Airport → Home',
  'Airport → Venue',
  'Venue → Airport',
  'Venue → Accommodation',
  'Accommodation → Venue',
  'Accommodation → Airport',
  'Airport → Accommodation',
  'Hotel → Client Office',
  'Client Office → Hotel',
];

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Cambodia','Cameroon',
  'Canada','Chile','China','Colombia','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia',
  'Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan',
  'Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Libya',
  'Lithuania','Luxembourg','Malaysia','Maldives','Malta','Mexico','Moldova','Mongolia',
  'Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua',
  'Nigeria','North Korea','Norway','Oman','Pakistan','Palestine','Panama','Paraguay','Peru',
  'Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia',
  'Senegal','Serbia','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea',
  'Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
  'Thailand','Tunisia','Turkey','Turkmenistan','Uganda','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen',
  'Zambia','Zimbabwe',
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
];

function currencySymbol(code: string) {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code;
}

function uid() { return Math.random().toString(36).slice(2, 8); }

function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function addDay(iso: string, n: number) {
  if (!iso) return '';
  const d = new Date(iso); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Small shared components ──────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-gray-500 mb-1">{children}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white';
const selectCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white';

function UploadBtn({ label, file, onFile }: { label: string; file: string; onFile: (n: string) => void }) {
  const pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,.jpg,.jpeg,.png';
    inp.onchange = () => { if (inp.files?.[0]) onFile(inp.files[0].name); };
    inp.click();
  };
  return (
    <button type="button" onClick={pick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
        file ? 'bg-green-50 border-green-300 text-green-700' : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
      }`}>
      <Upload className="w-3.5 h-3.5" />
      {file ? `✓ ${file.length > 18 ? file.slice(0, 15) + '...' : file}` : label}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-2">
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />{text}
    </div>
  );
}

function CurrencyAmount({
  label, amount, currency,
  onAmount, onCurrency,
}: {
  label: string; amount: number; currency: string;
  onAmount: (v: number) => void; onCurrency: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-1">
        <select
          value={currency}
          onChange={e => onCurrency(e.target.value)}
          className="px-2 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white w-[90px] flex-shrink-0"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
          ))}
        </select>
        <input
          type="number" min={0} placeholder="0"
          value={amount || ''}
          onChange={e => onAmount(parseFloat(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white min-w-0"
        />
      </div>
    </Field>
  );
}

// ─── Tab 1: Trainer & Assignment ──────────────────────────────────────────────

function Tab1({ d, s }: { d: FormData; s: (x: Partial<FormData>) => void }) {
  return (
    <div className="space-y-4">
      <Card title="Trainer details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trainer name *">
            <input className={inputCls} value={d.trainerName} placeholder="Full name"
              onChange={e => s({ trainerName: e.target.value })} />
          </Field>
          <Field label="Employee code">
            <input className={inputCls} value={d.empCode} placeholder="e.g. EMP-1042"
              onChange={e => s({ empCode: e.target.value })} />
          </Field>
          <Field label="Department">
            <input className={inputCls} value={d.department} placeholder="e.g. Technical Training"
              onChange={e => s({ department: e.target.value })} />
          </Field>
          <Field label="Base city">
            <input className={inputCls} value={d.baseCity} placeholder="Your home city"
              onChange={e => s({ baseCity: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="Assignment details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignment ID">
            <input className={inputCls} value={d.assignmentId} placeholder="e.g. ASN-2026-084"
              onChange={e => s({ assignmentId: e.target.value })} />
          </Field>
          <Field label="Client name *">
            <input className={inputCls} value={d.clientName} placeholder="e.g. Infosys"
              onChange={e => s({ clientName: e.target.value })} />
          </Field>
          <Field label="Training venue / location">
            <input className={inputCls} value={d.venue} placeholder="Venue or address"
              onChange={e => s({ venue: e.target.value })} />
          </Field>
          <Field label="Training city">
            <input className={inputCls} value={d.city} placeholder="e.g. Bangalore"
              onChange={e => s({ city: e.target.value })} />
          </Field>
          <Field label="Country">
            <select className={selectCls} value={d.country} onChange={e => s({ country: e.target.value })}>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Assignment start date *">
            <input type="date" className={inputCls} value={d.assignmentStart} max={todayISO()}
              onChange={e => s({ assignmentStart: e.target.value })} />
          </Field>
          <Field label="Assignment end date *">
            <input type="date" className={inputCls} value={d.assignmentEnd}
              min={d.assignmentStart} max={todayISO()}
              onChange={e => s({ assignmentEnd: e.target.value })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab 2: Travel Details ────────────────────────────────────────────────────

function Tab2({ d, s }: { d: FormData; s: (x: Partial<FormData>) => void }) {
  const minDate = d.assignmentStart ? addDay(d.assignmentStart, -1) : '';
  const maxDate = d.assignmentEnd || todayISO();

  const addLeg = () => s({ travelLegs: [...d.travelLegs, {
    id: uid(), mode: 'Flight', from: d.baseCity, to: d.city,
    departureDate: d.claimFrom || minDate, arrivalDate: d.claimFrom || minDate,
    fare: 0, currency: 'INR', pnr: '', receipt: '',
  }]});

  const updateLeg = (id: string, patch: Partial<TravelLeg>) =>
    s({ travelLegs: d.travelLegs.map(l => l.id === id ? { ...l, ...patch } : l) });

  const removeLeg = (id: string) =>
    s({ travelLegs: d.travelLegs.filter(l => l.id !== id) });

  const addCab = () => s({ cabEntries: [...d.cabEntries, {
    id: uid(), date: d.claimFrom || minDate, from: '', to: '', amount: 0, currency: 'INR', receipt: '',
  }]});

  const updateCab = (id: string, patch: Partial<CabEntry>) =>
    s({ cabEntries: d.cabEntries.map(c => c.id === id ? { ...c, ...patch } : c) });

  const removeCab = (id: string) =>
    s({ cabEntries: d.cabEntries.filter(c => c.id !== id) });

  const ModeIcon = ({ mode }: { mode: string }) => {
    if (mode === 'Flight') return <Plane className="w-3.5 h-3.5" />;
    if (mode === 'Train') return <Train className="w-3.5 h-3.5" />;
    if (mode === 'Bus') return <Bus className="w-3.5 h-3.5" />;
    return <Car className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Claim period */}
      <Card title="Claim period">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From — earliest: 1 day before assignment">
            <input type="date" className={inputCls} value={d.claimFrom}
              min={minDate} max={maxDate}
              onChange={e => s({ claimFrom: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={d.claimTo}
              min={d.claimFrom || minDate} max={maxDate}
              onChange={e => s({ claimTo: e.target.value })} />
          </Field>
        </div>
        {minDate && (
          <InfoTip text={`You can claim from ${formatDate(minDate)} (1 day before assignment start). Future dates are greyed out.`} />
        )}
      </Card>

      {/* Travel legs */}
      <Card title="Travel legs">
        <div className="space-y-3">
          {d.travelLegs.map((leg, i) => (
            <div key={leg.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <ModeIcon mode={leg.mode} /> Leg {i + 1}
                </div>
                <div className="flex items-center gap-2">
                  <UploadBtn label="Upload ticket / receipt" file={leg.receipt}
                    onFile={n => updateLeg(leg.id, { receipt: n })} />
                  <button type="button" onClick={() => removeLeg(leg.id)}
                    className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Mode">
                  <select className={selectCls} value={leg.mode}
                    onChange={e => updateLeg(leg.id, { mode: e.target.value })}>
                    {MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="From">
                  <input className={inputCls} value={leg.from} placeholder="City / Airport"
                    onChange={e => updateLeg(leg.id, { from: e.target.value })} />
                </Field>
                <Field label="To">
                  <input className={inputCls} value={leg.to} placeholder="City / Airport"
                    onChange={e => updateLeg(leg.id, { to: e.target.value })} />
                </Field>
                <Field label="Departure date">
                  <input type="date" className={inputCls} value={leg.departureDate}
                    min={minDate} max={maxDate}
                    onChange={e => updateLeg(leg.id, { departureDate: e.target.value })} />
                </Field>
                <Field label="Arrival date">
                  <input type="date" className={inputCls} value={leg.arrivalDate}
                    min={leg.departureDate || minDate} max={addDay(maxDate, 1)}
                    onChange={e => updateLeg(leg.id, { arrivalDate: e.target.value })} />
                </Field>
                <CurrencyAmount
                  label="Fare"
                  amount={leg.fare} currency={leg.currency}
                  onAmount={v => updateLeg(leg.id, { fare: v })}
                  onCurrency={v => updateLeg(leg.id, { currency: v })}
                />
                {(leg.mode === 'Flight' || leg.mode === 'Train') && (
                  <Field label="PNR / Ticket no.">
                    <input className={inputCls} value={leg.pnr} placeholder="Optional"
                      onChange={e => updateLeg(leg.id, { pnr: e.target.value })} />
                  </Field>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={addLeg}
            className="w-full py-2.5 border-2 border-dashed border-blue-300 rounded-lg text-sm text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add travel leg
          </button>
        </div>
      </Card>

      {/* Cab entries */}
      <Card title="Local cab / conveyance">
        <div className="space-y-2">
          {d.cabEntries.map(cab => {
            const routePreset = CAB_ROUTES.find(r => r !== 'Custom' && cab.from && cab.to && r === `${cab.from} → ${cab.to}`) ?? 'Custom';
            const applyPreset = (preset: string) => {
              if (preset === 'Custom') return;
              const [f, t] = preset.split(' → ');
              updateCab(cab.id, { from: f, to: t });
            };
            return (
            <div key={cab.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <Field label="Date">
                  <input type="date" className={inputCls} value={cab.date}
                    min={minDate} max={maxDate}
                    onChange={e => updateCab(cab.id, { date: e.target.value })} />
                </Field>
                <Field label="Route (quick-fill)">
                  <select className={selectCls} value={routePreset}
                    onChange={e => applyPreset(e.target.value)}>
                    {CAB_ROUTES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="From">
                  <input className={inputCls} value={cab.from} placeholder="Pickup point"
                    onChange={e => updateCab(cab.id, { from: e.target.value })} />
                </Field>
                <Field label="To">
                  <input className={inputCls} value={cab.to} placeholder="Drop point"
                    onChange={e => updateCab(cab.id, { to: e.target.value })} />
                </Field>
                <CurrencyAmount
                  label="Amount"
                  amount={cab.amount} currency={cab.currency}
                  onAmount={v => updateCab(cab.id, { amount: v })}
                  onCurrency={v => updateCab(cab.id, { currency: v })}
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <UploadBtn label="Upload receipt" file={cab.receipt}
                  onFile={n => updateCab(cab.id, { receipt: n })} />
                <button type="button" onClick={() => removeCab(cab.id)}
                  className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            );
          })}
          <button type="button" onClick={addCab}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add cab entry
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab 3: DA & Lodging ──────────────────────────────────────────────────────

function Tab3({ d, s }: { d: FormData; s: (x: Partial<FormData>) => void }) {
  const minDate = d.assignmentStart ? addDay(d.assignmentStart, -1) : '';
  const maxDate = d.assignmentEnd || todayISO();

  // Build DA rows from travel dates
  const daRows = useMemo(() => {
    if (!d.claimFrom || !d.claimTo) return [];
    const rows: { date: string; type: string; amount: number }[] = [];
    const leaveDays = new Set(d.leaveDates.split(',').map(s => s.trim()).filter(Boolean));
    const staybackDays = new Set(d.staybackDates.split(',').map(s => s.trim()).filter(Boolean));
    const start = new Date(d.claimFrom);
    const end = new Date(d.claimTo);
    const cur = new Date(start);
    const RATE = 1000;
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const isLeave = leaveDays.has(iso);
      const isStayback = staybackDays.has(iso);
      const isFirst = iso === d.claimFrom;
      const isLast = iso === d.claimTo;
      let type = 'Full day';
      let amount = RATE;
      if (isLeave) { type = 'Leave'; amount = 0; }
      else if (isStayback) { type = 'Stayback'; amount = 0; }
      else if (isFirst || isLast) { type = 'Half day'; amount = RATE / 2; }
      rows.push({ date: iso, type, amount });
      cur.setDate(cur.getDate() + 1);
    }
    return rows;
  }, [d.claimFrom, d.claimTo, d.leaveDates, d.staybackDates]);

  const totalDA = daRows.reduce((sum, r) => sum + r.amount, 0);

  const addHotel = () => s({ hotelStays: [...d.hotelStays, {
    id: uid(), hotelName: '', checkIn: d.assignmentStart || '',
    checkOut: d.assignmentEnd || '', ratePerNight: 0, currency: 'INR', stayType: 'Self Booked', receipt: '',
  }]});

  const updateHotel = (id: string, patch: Partial<HotelStay>) =>
    s({ hotelStays: d.hotelStays.map(h => h.id === id ? { ...h, ...patch } : h) });

  const removeHotel = (id: string) =>
    s({ hotelStays: d.hotelStays.filter(h => h.id !== id) });

  const addExp = () => s({ otherExpenses: [...d.otherExpenses, {
    id: uid(), category: 'Meal', description: '', date: d.assignmentStart || '', amount: 0, currency: 'INR', receipt: '',
  }]});

  const updateExp = (id: string, patch: Partial<OtherExpense>) =>
    s({ otherExpenses: d.otherExpenses.map(e => e.id === id ? { ...e, ...patch } : e) });

  const removeExp = (id: string) =>
    s({ otherExpenses: d.otherExpenses.filter(e => e.id !== id) });

  return (
    <div className="space-y-4">
      {/* DA table */}
      <Card title="Daily allowance — auto-calculated from claim period">
        {daRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Set the claim period in the Travel tab — DA will appear here automatically.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
              <table className="min-w-full text-xs divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Day type', 'DA eligible'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {daRows.map(r => (
                    <tr key={r.date} className={r.amount === 0 ? 'opacity-40' : ''}>
                      <td className="px-3 py-2 font-medium">{formatDate(r.date)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.type === 'Full day' ? 'bg-green-100 text-green-700' :
                          r.type === 'Half day' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{r.type}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-green-700">₹{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end text-sm font-semibold text-gray-700">
              Total DA: <span className="text-green-700 ml-2">{formatINR(totalDA)}</span>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Leave dates (YYYY-MM-DD, comma separated)">
            <input className={inputCls} value={d.leaveDates} placeholder="e.g. 2026-05-29"
              onChange={e => s({ leaveDates: e.target.value })} />
          </Field>
          <Field label="Personal stayback dates">
            <input className={inputCls} value={d.staybackDates} placeholder="e.g. 2026-06-04"
              onChange={e => s({ staybackDates: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Hotel stays */}
      <Card title="Lodging / hotel stays">
        <div className="space-y-3">
          {d.hotelStays.map(h => (
            <div key={h.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">Hotel stay</span>
                <div className="flex items-center gap-2">
                  <UploadBtn label="Upload hotel invoice" file={h.receipt}
                    onFile={n => updateHotel(h.id, { receipt: n })} />
                  <button type="button" onClick={() => removeHotel(h.id)}
                    className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <Field label="Hotel name">
                    <input className={inputCls} value={h.hotelName} placeholder="Hotel / guest house"
                      onChange={e => updateHotel(h.id, { hotelName: e.target.value })} />
                  </Field>
                </div>
                <Field label="Check-in">
                  <input type="date" className={inputCls} value={h.checkIn}
                    min={minDate} max={maxDate}
                    onChange={e => updateHotel(h.id, { checkIn: e.target.value })} />
                </Field>
                <Field label="Check-out">
                  <input type="date" className={inputCls} value={h.checkOut}
                    min={h.checkIn || minDate} max={maxDate}
                    onChange={e => updateHotel(h.id, { checkOut: e.target.value })} />
                </Field>
                <CurrencyAmount
                  label="Rate / night"
                  amount={h.ratePerNight} currency={h.currency}
                  onAmount={v => updateHotel(h.id, { ratePerNight: v })}
                  onCurrency={v => updateHotel(h.id, { currency: v })}
                />
                <Field label="Stay type">
                  <select className={selectCls} value={h.stayType}
                    onChange={e => updateHotel(h.id, { stayType: e.target.value })}>
                    {STAY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <div className="flex items-end">
                  <div className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-semibold">
                    {currencySymbol(h.currency)}{(nightsBetween(h.checkIn, h.checkOut) * h.ratePerNight).toLocaleString()}
                    <span className="text-xs text-green-500 font-normal ml-1">
                      ({nightsBetween(h.checkIn, h.checkOut)} nights)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addHotel}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add hotel stay
          </button>
        </div>
      </Card>

      {/* Other expenses */}
      <Card title="Other expenses (meals, visa, misc)">
        <div className="space-y-2">
          {d.otherExpenses.map(exp => (
            <div key={exp.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <Field label="Category">
                  <select className={selectCls} value={exp.category}
                    onChange={e => updateExp(exp.id, { category: e.target.value })}>
                    {EXP_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Description">
                  <input className={inputCls} value={exp.description} placeholder="Brief note"
                    onChange={e => updateExp(exp.id, { description: e.target.value })} />
                </Field>
                <Field label="Date">
                  <input type="date" className={inputCls} value={exp.date}
                    min={minDate} max={maxDate}
                    onChange={e => updateExp(exp.id, { date: e.target.value })} />
                </Field>
                <CurrencyAmount
                  label="Amount"
                  amount={exp.amount} currency={exp.currency}
                  onAmount={v => updateExp(exp.id, { amount: v })}
                  onCurrency={v => updateExp(exp.id, { currency: v })}
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <UploadBtn label="Upload receipt" file={exp.receipt}
                  onFile={n => updateExp(exp.id, { receipt: n })} />
                <button type="button" onClick={() => removeExp(exp.id)}
                  className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addExp}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add other expense
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab 4: Advance & Summary ─────────────────────────────────────────────────

function Tab4({ d, s, totals }: { d: FormData; s: (x: Partial<FormData>) => void; totals: ReturnType<typeof calcTotals> }) {
  const toggleAdv = (id: string) =>
    s({ advances: d.advances.map(a => a.id === id ? { ...a, selected: !a.selected } : a) });

  return (
    <div className="space-y-4">
      <Card title="Expense summary">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Travel fare', val: totals.travel },
            { label: 'Cab / conveyance', val: totals.cab },
            { label: 'Daily allowance', val: totals.da },
            { label: 'Lodging', val: totals.lodging },
            { label: 'Other expenses', val: totals.other },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatINR(val)}</p>
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-600">Total claimed</p>
            <p className="text-sm font-bold text-blue-700 mt-0.5">{formatINR(totals.total)}</p>
          </div>
        </div>
      </Card>

      <Card title="Advance adjustment">
        <div className="space-y-2">
          {d.advances.map(adv => (
            <label key={adv.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                adv.selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <input type="checkbox" checked={adv.selected} onChange={() => toggleAdv(adv.id)}
                className="w-4 h-4 accent-blue-600" />
              <span className="flex-1 text-sm text-gray-700">{adv.label}</span>
              <span className="text-sm font-semibold text-red-600">-{formatINR(adv.amount)}</span>
            </label>
          ))}
        </div>
      </Card>

      <div className="rounded-xl p-4 border border-blue-200 bg-blue-50 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-blue-600">Total claimed</p>
          <p className="text-xl font-bold text-blue-700">{formatINR(totals.total)}</p>
        </div>
        {totals.advance > 0 && (
          <div className="text-center">
            <p className="text-xs text-blue-600">Advance adjusted</p>
            <p className="text-base font-semibold text-red-600">-{formatINR(totals.advance)}</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-xs text-blue-600">Net payable</p>
          <p className="text-xl font-bold text-blue-900">{formatINR(totals.net)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Preview & Submit ──────────────────────────────────────────────────

function Tab5({ d, s, totals, onSubmit, submitting }: {
  d: FormData; s: (x: Partial<FormData>) => void;
  totals: ReturnType<typeof calcTotals>;
  onSubmit: () => void; submitting: boolean;
}) {
  const receipts = [
    ...d.travelLegs.map(l => l.receipt),
    ...d.cabEntries.map(c => c.receipt),
    ...d.hotelStays.map(h => h.receipt),
    ...d.otherExpenses.map(e => e.receipt),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <Card title="Trainer & assignment">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          {[
            ['Assignment ID', d.assignmentId || '—'],
            ['Trainer', d.trainerName || '—'],
            ['Emp code', d.empCode || '—'],
            ['Department', d.department || '—'],
            ['Client', d.clientName || '—'],
            ['Venue', d.venue || '—'],
            ['City', `${d.city}${d.country ? ', ' + d.country : ''}`],
            ['Training dates', d.assignmentStart ? `${formatDate(d.assignmentStart)} – ${formatDate(d.assignmentEnd)}` : '—'],
            ['Claim period', d.claimFrom ? `${formatDate(d.claimFrom)} – ${formatDate(d.claimTo)}` : '—'],
            ...(d.remarks ? [['Remarks', d.remarks]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-gray-400 text-xs min-w-[90px] pt-0.5">{k}</span>
              <span className="text-gray-800 font-medium text-xs">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Financial summary">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {[
              ['Travel fare', totals.travel],
              ['Cab / conveyance', totals.cab],
              ['Daily allowance', totals.da],
              ['Lodging', totals.lodging],
              ['Other expenses', totals.other],
            ].map(([label, val]) => (
              <tr key={label as string}>
                <td className="py-2 text-gray-500">{label}</td>
                <td className="py-2 text-right font-medium text-gray-800">{formatINR(val as number)}</td>
              </tr>
            ))}
            <tr><td className="py-2 font-semibold text-gray-700">Total claimed</td>
              <td className="py-2 text-right font-semibold text-gray-900">{formatINR(totals.total)}</td></tr>
            {totals.advance > 0 && (
              <tr><td className="py-2 text-gray-500">Advance adjusted</td>
                <td className="py-2 text-right text-red-600 font-medium">-{formatINR(totals.advance)}</td></tr>
            )}
            <tr className="border-t-2 border-gray-300">
              <td className="pt-3 pb-2 font-bold text-gray-800 text-base">Net payable</td>
              <td className="pt-3 pb-2 text-right font-bold text-blue-700 text-base">{formatINR(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
        <Upload className="w-4 h-4 text-blue-500" />
        <span>{receipts.length} receipt(s) attached</span>
        {receipts.length === 0 && <span className="text-amber-600 text-xs ml-1">— Upload receipts in Travel / DA tabs</span>}
      </div>

      <Card title="Remarks / additional notes">
        <Field label="Remarks (optional — visible to HR/Admin reviewer)">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={d.remarks}
            placeholder="Any special circumstances, explanations, or notes for the reviewer…"
            onChange={e => s({ remarks: e.target.value })}
          />
        </Field>
      </Card>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={d.declared} onChange={e => s({ declared: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-blue-600" />
        <span className="text-sm text-gray-700">
          I declare that all information furnished above is true and correct to the best of my knowledge.
          All expenses are genuine and supported by receipts wherever applicable.
        </span>
      </label>

      <button type="button" disabled={!d.declared || submitting} onClick={onSubmit}
        className="w-full py-3 rounded-xl font-semibold text-white text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
        {submitting
          ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Submitting...</>
          : <><CheckCircle className="w-4 h-4" />Submit TA/DA claim</>}
      </button>
    </div>
  );
}

// ─── Totals helper ────────────────────────────────────────────────────────────

function calcTotals(d: FormData) {
  const travel = d.travelLegs.reduce((s, l) => s + l.fare, 0);
  const cab = d.cabEntries.reduce((s, c) => s + c.amount, 0);
  const da = (() => {
    if (!d.claimFrom || !d.claimTo) return 0;
    let total = 0;
    const RATE = 1000;
    const leaveDays = new Set(d.leaveDates.split(',').map(s => s.trim()).filter(Boolean));
    const staybackDays = new Set(d.staybackDates.split(',').map(s => s.trim()).filter(Boolean));
    const cur = new Date(d.claimFrom);
    const end = new Date(d.claimTo);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      if (!leaveDays.has(iso) && !staybackDays.has(iso)) {
        total += (iso === d.claimFrom || iso === d.claimTo) ? RATE / 2 : RATE;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return total;
  })();
  const lodging = d.hotelStays.reduce((s, h) => s + nightsBetween(h.checkIn, h.checkOut) * h.ratePerNight, 0);
  const other = d.otherExpenses.reduce((s, e) => s + e.amount, 0);
  const total = travel + cab + da + lodging + other;
  const advance = d.advances.filter(a => a.selected).reduce((s, a) => s + a.amount, 0);
  const net = total - advance;
  return { travel, cab, da, lodging, other, total, advance, net };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateClaim({ currentUser }: { currentUser?: User }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [d, setDRaw] = useState<FormData>(DEFAULT);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const s = (patch: Partial<FormData>) => setDRaw(prev => ({ ...prev, ...patch }));
  const totals = useMemo(() => calcTotals(d), [d]);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    saveClaim({
      claimId: 'claim_' + Date.now(),
      billNo: `KNG-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      trainerId: d.empCode,
      trainerName: d.trainerName,
      assignmentIds: [],
      batchIds: [],
      clientName: d.clientName,
      courseName: '',
      trainingLocation: d.venue,
      claimStartDate: d.claimFrom,
      claimEndDate: d.claimTo,
      baseCity: d.baseCity,
      destinationCities: [d.city],
      status: 'Submitted',
      pendingWith: 'HR/Admin',
      submittedAt: new Date().toISOString(),
      lastActionAt: new Date().toISOString(),
      adminOwnerId: '',
      totalClaimedAmount: totals.total,
      eligibleAmount: totals.total,
      approvedAmount: 0,
      deductionAmount: 0,
      advanceAdjusted: totals.advance,
      miscAdjustments: 0,
      recoverableAmount: 0,
      netPayable: totals.net,
      currency: 'INR',
      exceptionFlag: false,
      missingDocumentFlag: false,
      duplicateFlag: false,
      ledgerMismatchFlag: false,
      slaBreached: false,
      paymentStatus: 'Unpaid',
      agingDays: 0,
    });
    clearDraftWizard();
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Claim Submitted!</h2>
          <p className="text-gray-500 mt-2 max-w-sm">Your TA/DA claim has been submitted to HR/Admin for review.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/claims')}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
            View My Bills
          </button>
          <button onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">New TA/DA Bill</h1>
          <p className="text-sm text-gray-500">Fill in all details and submit your claim</p>
        </div>
      </div>

      {/* Tab bar — all tabs clickable */}
      <div className="flex items-center mb-6 gap-0">
        {TABS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button type="button" onClick={() => setTab(i)}
              className="flex flex-col items-center gap-1 min-w-0 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < tab ? 'bg-green-500 text-white' :
                i === tab ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-400 hover:bg-gray-300'
              }`}>
                {i < tab ? '✓' : i + 1}
              </div>
              <span className={`text-xs text-center leading-tight hidden sm:block ${
                i === tab ? 'text-blue-700 font-semibold' : 'text-gray-400'
              }`}>{label}</span>
            </button>
            {i < TABS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < tab ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {tab === 0 && <Tab1 d={d} s={s} />}
        {tab === 1 && <Tab2 d={d} s={s} />}
        {tab === 2 && <Tab3 d={d} s={s} />}
        {tab === 3 && <Tab4 d={d} s={s} totals={totals} />}
        {tab === 4 && <Tab5 d={d} s={s} totals={totals} onSubmit={handleSubmit} submitting={submitting} />}
      </div>

      {/* Navigation */}
      {tab < 4 && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
          <button type="button" onClick={() => setTab(t => Math.max(0, t - 1))} disabled={tab === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-xs text-gray-400">{tab + 1} / {TABS.length}</span>
          <button type="button" onClick={() => setTab(t => Math.min(4, t + 1))}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
