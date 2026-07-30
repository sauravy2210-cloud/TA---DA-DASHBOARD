import { useState, useRef } from 'react';
import { Search, User as UserIcon, Calendar, ArrowRight, RefreshCw, ChevronDown } from 'lucide-react';
import type { User } from '../types';
import CreateTADABill from './CreateTADABill';

interface CheckDetailsProps {
  currentUser: User;
}

export default function CheckDetails({ currentUser }: CheckDetailsProps) {
  const [empCode, setEmpCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');

  const [proxyUser, setProxyUser] = useState<User | null>(null);
  const billRef = useRef<HTMLDivElement>(null);

  // Lookup employee name from PMS to confirm empCode before loading
  async function lookupEmployee(code: string) {
    if (!code.trim()) return;
    setEmpLoading(true);
    setEmpError('');
    setEmpName('');
    try {
      const res = await fetch(`/api/employee?empCode=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (data?.employee) {
        const emp = data.employee;
        const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') || `EMP-${code}`;
        setEmpName(name);
        setEmpEmail(String(emp.email_address || '').trim());
      } else {
        setEmpError('Employee not found in PMS');
      }
    } catch {
      setEmpError('Failed to fetch employee details');
    } finally {
      setEmpLoading(false);
    }
  }

  function handleLoad() {
    if (!empCode.trim()) return;
    const code = empCode.trim();
    // Build a proxy User object — only trainerId matters for API calls
    const proxy: User = {
      ...currentUser,
      id:            code,
      trainerId:     code,
      name:          empName || `Trainer ${code}`,
      email:         empEmail || `${code}@koenig-solutions.com`,
      role:          'Trainer',
      originalRole:  currentUser.originalRole ?? currentUser.role,
      avatarInitials: empName ? empName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : code.slice(0, 2).toUpperCase(),
      pmsDetails:    undefined,
    };
    setProxyUser(proxy);
    // Scroll to wizard
    setTimeout(() => billRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  function handleReset() {
    setProxyUser(null);
    setEmpCode('');
    setEmpName('');
    setEmpEmail('');
    setEmpError('');
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header banner ── */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-700 px-6 py-5">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Search size={18} /> Check Details — HR Admin View
        </h1>
        <p className="text-indigo-200 text-xs mt-0.5">
          Enter any trainer's employee code to view their full TA/DA wizard (Step 1–9) for any date range
        </p>
      </div>

      {/* ── Employee lookup form ── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <UserIcon size={15} className="text-indigo-500" />
            Select Trainer
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Employee Code</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={empCode}
                  onChange={e => { setEmpCode(e.target.value); setEmpName(''); setEmpEmail(''); setEmpError(''); setProxyUser(null); }}
                  onKeyDown={e => e.key === 'Enter' && lookupEmployee(empCode)}
                  placeholder="e.g. 3162"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => lookupEmployee(empCode)}
                  disabled={!empCode.trim() || empLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  {empLoading
                    ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <Search size={14} />}
                  Lookup
                </button>
              </div>
              {empError && <p className="text-xs text-red-500 mt-1">⚠ {empError}</p>}
            </div>
          </div>

          {/* Confirmed employee card */}
          {empName && !empError && (
            <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
                  {empName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{empName}</p>
                  <p className="text-xs text-gray-500 font-mono">EMP-{empCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {proxyUser ? (
                  <button type="button" onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                    <RefreshCw size={12} /> Reset
                  </button>
                ) : (
                  <button type="button" onClick={handleLoad}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shadow">
                    <ArrowRight size={14} /> Load Details
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Instruction when no lookup yet */}
          {!empName && !empError && !empLoading && (
            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 flex items-center gap-1.5">
                <Calendar size={12} />
                Enter employee code → Lookup → Load Details → then select a date range inside the wizard to fetch all Steps 1–9
              </p>
            </div>
          )}
        </div>

        {/* Quick selector for common emp codes */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">Quick:</span>
          {['3162', '2225', '1001'].map(code => (
            <button key={code} type="button"
              onClick={() => { setEmpCode(code); setEmpName(''); setEmpEmail(''); setEmpError(''); setProxyUser(null); lookupEmployee(code); }}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-mono transition-colors">
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      {proxyUser && (
        <div className="max-w-2xl mx-auto px-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-indigo-200" />
            <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200">
              <ChevronDown size={12} />
              Viewing as: {proxyUser.name} (EMP-{empCode}) — Read-Only Admin View
            </span>
            <div className="flex-1 h-px bg-indigo-200" />
          </div>
        </div>
      )}

      {/* ── Full CreateTADABill wizard rendered for the proxy user ── */}
      {proxyUser && (
        <div ref={billRef} className="relative">
          {/* Read-only overlay label */}
          <div className="sticky top-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700">
              👁 HR Admin — Check Details View for {proxyUser.name} (EMP-{empCode})
            </span>
            <button type="button" onClick={handleReset}
              className="ml-auto text-xs text-red-500 hover:underline font-medium flex items-center gap-1">
              <RefreshCw size={11} /> Change Employee
            </button>
          </div>
          <CreateTADABill currentUser={proxyUser} />
        </div>
      )}
    </div>
  );
}
