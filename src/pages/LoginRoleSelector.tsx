import React from 'react';
import { UserCheck, ShieldCheck, Banknote, Crown } from 'lucide-react';
import type { User, UserRole } from '../types';
import { mockUsers } from '../data/mockUsers';

interface RoleCard {
  role: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  iconBg: string;
}

const roleCards: RoleCard[] = [
  {
    role: 'Trainer',
    label: 'Trainer',
    description: 'Submit TA/DA claims, track reimbursements, view assignment history.',
    icon: <UserCheck size={28} />,
    color: 'text-blue-600',
    border: 'border-blue-200 hover:border-blue-400',
    iconBg: 'bg-blue-50',
  },
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

interface Props {
  onLogin: (user: User) => void;
}

const LoginRoleSelector: React.FC<Props> = ({ onLogin }) => {
  const handleRoleSelect = (role: UserRole) => {
    const user = mockUsers.find((u) => u.role === role);
    if (user) {
      onLogin(user as unknown as User);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#eef4fa' }}
    >
      {/* Logo / Brand */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 shadow-md"
          style={{ backgroundColor: '#1a56db' }}
        >
          <span className="text-white text-2xl font-bold tracking-tight">K</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Koenig Solutions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enterprise Training &amp; Learning</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Card Header */}
        <div
          className="px-8 py-6 text-center"
          style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1e429f 100%)' }}
        >
          <h2 className="text-xl font-semibold text-white">TA / DA Portal</h2>
          <p className="text-blue-200 text-sm mt-1">Travel Allowance &amp; Daily Allowance Management</p>
        </div>

        {/* Role Grid */}
        <div className="p-8">
          <p className="text-center text-gray-500 text-sm mb-6">Select your role to continue</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roleCards.map(({ role, label, description, icon, color, border, iconBg }) => (
              <div
                key={role}
                className={`border-2 ${border} rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 cursor-pointer hover:shadow-md bg-white`}
                onClick={() => handleRoleSelect(role)}
              >
                <div className="flex items-center gap-3">
                  <div className={`${iconBg} ${color} rounded-lg p-2.5`}>{icon}</div>
                  <div>
                    <p className="font-semibold text-gray-800">{label}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                <button
                  className={`mt-auto w-full py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${color} border border-current hover:bg-opacity-10`}
                  style={{ background: 'transparent' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSelect(role);
                  }}
                >
                  Login as {label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Mode Note */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Demo mode &mdash; no real authentication. All data is simulated.
      </p>
    </div>
  );
};

export default LoginRoleSelector;

