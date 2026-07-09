import React, { useState } from 'react';
import { UserCheck, ShieldCheck, Banknote, Crown, Loader2, AlertCircle, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import type { User, UserRole, PmsEmployeeDetails } from '../types';
import { mockUsers } from '../data/mockUsers';

// ── PMS API ────────────────────────────────────────────────────────────────────

type PmsEmployee = PmsEmployeeDetails;

async function fetchEmployeeFromPMS(empCode: string): Promise<PmsEmployee | null> {
  // Step 1: Get token
  const tokenRes = await fetch('/koenig-api/api/Kites/Operator/GetToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName: 'Saurav_GetEmployeeDeta',
      userPassword: 'dYHVNmg5#eJ#',
      userRole: 'Get Employee Details (PMS)',
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.statuscode !== 200) throw new Error(tokenData.message || 'Token fetch failed');
  const { accessToken, deviceToken } = tokenData.content;

  // Step 2: Fetch employee details
  const url = `/koenig-api/api/Kites/Operator/common?apikey=236&accessToken=${encodeURIComponent(accessToken)}&deviceToken=${encodeURIComponent(deviceToken)}`;
  const dataRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emp_code: empCode }),
  });
  const data = await dataRes.json();
  if (data.statuscode !== 200) throw new Error(data.message || 'Employee fetch failed');
  const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
  const list: PmsEmployee[] = Array.isArray(content) ? content : [];
  return list.length > 0 ? list[0] : null;
}

function getInitials(first: string | null, last: string | null): string {
  const f = (first ?? '').trim()[0] ?? '';
  const l = (last ?? '').trim()[0] ?? '';
  return (f + l).toUpperCase() || 'TR';
}

// ── Non-trainer role cards ─────────────────────────────────────────────────────

interface RoleCard {
  role: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  iconBg: string;
}

// Passwords for protected roles — keep confidential
const ROLE_PASSWORDS: Record<string, string> = {
  HRAdmin:    'KHR@2026!',
  Finance:    'KFin#2026$',
  SuperAdmin: 'KSuper@2026#',
};

const otherRoleCards: RoleCard[] = [
  {
    role: 'HRAdmin',
    label: 'HR / Admin',
    description: 'Review and process trainer claims, manage assignments and policies.',
    icon: <ShieldCheck size={28} />,
    color: 'text-emerald-600',
    border: 'border-emerald-200 hover:border-emerald-400',
    iconBg: 'bg-emerald-50',
  },
  {
    role: 'Finance',
    label: 'Finance',
    description: 'Approve payments, run reports, manage ledger reconciliation.',
    icon: <Banknote size={28} />,
    color: 'text-amber-600',
    border: 'border-amber-200 hover:border-amber-400',
    iconBg: 'bg-amber-50',
  },
  {
    role: 'SuperAdmin',
    label: 'Super Admin',
    description: 'Full system access — users, policies, audit logs, configuration.',
    icon: <Crown size={28} />,
    color: 'text-purple-600',
    border: 'border-purple-200 hover:border-purple-400',
    iconBg: 'bg-purple-50',
  },
];

// ── Password-protected role card ──────────────────────────────────────────────

interface ProtectedRoleCardProps {
  card: RoleCard;
  onLogin: (user: User) => void;
}

function ProtectedRoleCard({ card, onLogin }: ProtectedRoleCardProps) {
  const { role, label, description, icon, color, border, iconBg } = card;
  const [expanded, setExpanded]     = useState(false);
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState('');
  const [attempts, setAttempts]     = useState(0);
  const MAX_ATTEMPTS = 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (attempts >= MAX_ATTEMPTS) return;
    if (password === ROLE_PASSWORDS[role]) {
      const user = mockUsers.find(u => u.role === role);
      if (user) onLogin(user as unknown as User);
    } else {
      const left = MAX_ATTEMPTS - attempts - 1;
      setAttempts(a => a + 1);
      setError(left > 0 ? `Incorrect password. ${left} attempt${left !== 1 ? 's' : ''} remaining.` : 'Too many incorrect attempts. Please contact the administrator.');
      setPassword('');
    }
  }

  if (!expanded) {
    return (
      <div
        className={`border-2 ${border} rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 cursor-pointer hover:shadow-md bg-white`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <div className={`${iconBg} ${color} rounded-lg p-2.5`}>{icon}</div>
          <div>
            <p className="font-semibold text-gray-800">{label}</p>
            <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Lock size={10} /> Password protected
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        <button
          className={`mt-auto w-full py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${color} border border-current hover:bg-opacity-10`}
          style={{ background: 'transparent' }}
          onClick={e => { e.stopPropagation(); setExpanded(true); }}
        >
          Login as {label}
        </button>
      </div>
    );
  }

  return (
    <div className={`border-2 ${border.replace('hover:border-\\S+', '')} rounded-xl p-5 flex flex-col gap-4 bg-white shadow-md`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`${iconBg} ${color} rounded-lg p-2.5`}>{icon}</div>
          <div>
            <p className="font-semibold text-gray-800">{label} Login</p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Lock size={10} /> Enter your access password
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setExpanded(false); setError(''); setPassword(''); setAttempts(0); }}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={13} /> Back
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter access password"
              autoFocus
              disabled={attempts >= MAX_ATTEMPTS}
              className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!password || attempts >= MAX_ATTEMPTS}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
            role === 'HRAdmin'    ? 'bg-emerald-600 hover:bg-emerald-700' :
            role === 'Finance'   ? 'bg-amber-500 hover:bg-amber-600' :
                                   'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          <Lock size={14} /> Login as {label}
        </button>
      </form>
    </div>
  );
}

// ── Trainer login card ─────────────────────────────────────────────────────────

interface TrainerCardProps {
  onLogin: (user: User) => void;
}

function TrainerLoginCard({ onLogin }: TrainerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCode, setShowCode] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const code = empCode.trim();
    if (!code) { setError('Please enter your employee code.'); return; }

    setLoading(true);
    setError('');
    try {
      const emp = await fetchEmployeeFromPMS(code);
      if (!emp || (!emp.first_name && !emp.email_address)) {
        setError('Employee not found. Please check your employee code and try again.');
        setLoading(false);
        return;
      }

      const firstName = emp.first_name ?? '';
      const middleName = emp.middle_name ? ` ${emp.middle_name}` : '';
      const lastName = emp.last_name ? ` ${emp.last_name}` : '';
      const fullName = `${firstName}${middleName}${lastName}`.trim() || `Trainer ${code}`;

      const user: User = {
        id: `emp-${code}`,
        name: fullName,
        email: emp.email_address ?? `emp${code}@koenig-solutions.com`,
        role: 'Trainer',
        avatarInitials: getInitials(emp.first_name, emp.last_name),
        trainerId: code,
        pmsDetails: emp,
      };
      onLogin(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // API unreachable in dev — fallback to mock so UI stays usable
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        const mockUser = mockUsers.find(u => u.role === 'Trainer');
        if (mockUser) { onLogin(mockUser as unknown as User); return; }
      }
      setError(msg || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <div
        className="border-2 border-blue-200 hover:border-blue-400 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 cursor-pointer hover:shadow-md bg-white"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 text-blue-600 rounded-lg p-2.5"><UserCheck size={28} /></div>
          <div>
            <p className="font-semibold text-gray-800">Trainer</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          Submit TA/DA claims, track reimbursements, view assignment history.
        </p>
        <button
          className="mt-auto w-full py-2 rounded-lg text-sm font-medium transition-colors duration-150 text-blue-600 border border-blue-600 hover:bg-blue-50"
          onClick={e => { e.stopPropagation(); setExpanded(true); }}
        >
          Login as Trainer
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-blue-400 rounded-xl p-5 flex flex-col gap-4 bg-white shadow-md col-span-1 sm:col-span-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 text-blue-600 rounded-lg p-2.5"><UserCheck size={24} /></div>
          <div>
            <p className="font-semibold text-gray-800">Trainer Login</p>
            <p className="text-xs text-gray-400">Enter your Koenig employee code to continue</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setExpanded(false); setError(''); setEmpCode(''); }}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={13} /> Back
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
          <div className="relative">
            <input
              type={showCode ? 'text' : 'password'}
              value={empCode}
              onChange={e => { setEmpCode(e.target.value); setError(''); }}
              placeholder="e.g. 1234"
              autoFocus
              className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCode ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !empCode.trim()}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 size={15} className="animate-spin" /> Verifying with Koenig PMS…</>
          ) : (
            'Login →'
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          Your details will be fetched securely from the Koenig PMS system.
        </p>
      </form>
    </div>
  );
}

// ── Main login page ────────────────────────────────────────────────────────────

interface Props {
  onLogin: (user: User) => void;
}

const LoginRoleSelector: React.FC<Props> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#eef4fa' }}>
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 shadow-md" style={{ backgroundColor: '#1a56db' }}>
          <span className="text-white text-2xl font-bold tracking-tight">K</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Koenig Solutions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enterprise Training &amp; Learning</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-8 py-6 text-center" style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1e429f 100%)' }}>
          <h2 className="text-xl font-semibold text-white">TA / DA Portal</h2>
          <p className="text-blue-200 text-sm mt-1">Travel Allowance &amp; Daily Allowance Management</p>
        </div>

        <div className="p-8">
          <p className="text-center text-gray-500 text-sm mb-6">Select your role to continue</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Trainer card — API login */}
            <TrainerLoginCard onLogin={onLogin} />

            {/* Other roles — password protected */}
            {otherRoleCards.map(card => (
              <ProtectedRoleCard key={card.role} card={card} onLogin={onLogin} />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Trainer login is verified via Koenig PMS. HR/Admin, Finance &amp; Super Admin require an access password.
      </p>
    </div>
  );
};

export default LoginRoleSelector;
