import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FilePlus,
  AlertTriangle,
  CreditCard,
  BarChart2,
  BookOpen,
  Database,
  ScrollText,
  Bell,
  CheckSquare,
  HelpCircle,
  User,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  X,
  Send,
  CheckCircle2,
  Stamp,
} from 'lucide-react';
import type { User as UserType, UserRole } from '../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  groupLabel?: string;
  items: NavItem[];
  collapsible?: boolean;
}

interface SidebarProps {
  currentUser: UserType;
  currentPath: string;
  onNavigate: (path: string) => void;
}

function Badge({ count }: { count: number }) {
  return (
    <span className="ml-auto min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full text-xs font-bold bg-red-500 text-white">
      {count}
    </span>
  );
}

const ADMIN_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Admin Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
      { label: 'Payment Processing', path: '/payments', icon: <CreditCard size={16} /> },
    ],
  },
];

const TRAINER_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Trainer Dashboard', path: '/dashboard', icon: <LayoutDashboard size={16} /> },
      { label: 'File TA/DA Claim', path: '/create-bill', icon: <FilePlus size={16} /> },
      { label: 'View My Bills', path: '/claims', icon: <ClipboardList size={16} /> },
      { label: 'Visa Fees Entry', path: '/visa-entry', icon: <Stamp size={16} /> },
    ],
  },
  {
    groupLabel: 'Support',
    collapsible: true,
    items: [
      { label: 'Help / Policy Guidelines', path: '/trainer/help', icon: <HelpCircle size={16} /> },
      { label: 'Profile', path: '/trainer/profile', icon: <User size={16} /> },
    ],
  },
];

const CHECK_DETAILS_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Check Details', path: '/check-details', icon: <ClipboardList size={16} /> },
    ],
  },
];

const FINANCE_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Payment Processing', path: '/finance/payments', icon: <CreditCard size={16} /> },
      { label: 'Reports & Exports', path: '/finance/reports', icon: <BarChart2 size={16} /> },
      { label: 'Audit Logs', path: '/finance/audit', icon: <ScrollText size={16} /> },
    ],
  },
];

const SUPERADMIN_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Admin Dashboard', path: '/superadmin/dashboard', icon: <LayoutDashboard size={16} /> },
      { label: 'Verification Queue', path: '/superadmin/verification', icon: <CheckSquare size={16} />, badge: 12 },
      { label: 'Claim Review', path: '/superadmin/review', icon: <ClipboardList size={16} /> },
      { label: 'Exception Claims', path: '/superadmin/exceptions', icon: <AlertTriangle size={16} />, badge: 3 },
      { label: 'Payment Processing', path: '/superadmin/payments', icon: <CreditCard size={16} /> },
    ],
  },
  {
    groupLabel: 'Reports & Data',
    collapsible: true,
    items: [
      { label: 'Reports & Exports', path: '/superadmin/reports', icon: <BarChart2 size={16} /> },
      { label: 'Policy Master', path: '/superadmin/policy', icon: <BookOpen size={16} /> },
      { label: 'Master Data', path: '/superadmin/master-data', icon: <Database size={16} /> },
      { label: 'Audit Logs', path: '/superadmin/audit', icon: <ScrollText size={16} /> },
      { label: 'Notifications/SLA', path: '/superadmin/notifications', icon: <Bell size={16} />, badge: 4 },
    ],
  },
];

function getNavGroups(role: UserRole): NavGroup[] {
  switch (role) {
    case 'HRAdmin':
      return ADMIN_GROUPS;
    case 'CheckDetails':
      return CHECK_DETAILS_GROUPS;
    case 'Trainer':
      return TRAINER_GROUPS;
    case 'Finance':
      return FINANCE_GROUPS;
    case 'SuperAdmin':
      return SUPERADMIN_GROUPS;
    default:
      return TRAINER_GROUPS;
  }
}

function NavGroupSection({
  group,
  currentPath,
}: {
  group: NavGroup;
  currentPath: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-2">
      {group.groupLabel && (
        <button
          onClick={() => group.collapsible && setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-200 hover:text-white transition-colors"
        >
          <span className="flex-1 text-left">{group.groupLabel}</span>
          {group.collapsible && (
            collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
          )}
        </button>
      )}
      {!collapsed && (
        <ul>
          {group.items.map((item) => {
            const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={() =>
                    [
                      'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white',
                    ].join(' ')
                  }
                >
                  <span className="flex-shrink-0 opacity-90">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && <Badge count={item.badge} />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const FEEDBACK_CATEGORIES = [
  'Suggestions for new features',
  'Ideas to simplify the process',
  'Feedback on your user experience',
  'Bug reports or technical issues',
  'Any other recommendations',
] as const;

function FeedbackModal({ onClose, trainerName, trainerId }: { onClose: () => void; trainerName: string; trainerId?: string }) {
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !message.trim()) return;
    const entry = {
      id: Date.now().toString(),
      trainerName,
      trainerId: trainerId ?? '',
      category,
      message: message.trim(),
      submittedAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem('tada_feedback') ?? '[]');
    localStorage.setItem('tada_feedback', JSON.stringify([...existing, entry]));
    // Email to saurav.yadav@koenig-solutions.com — fire and forget
    fetch('/api/turso?type=feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {/* silent */});
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#1f7cc9' }}>
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-white" />
            <span className="text-white font-semibold text-sm">Share Your Feedback</span>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
            <CheckCircle2 size={48} className="text-green-500" />
            <p className="text-gray-800 font-semibold text-base text-center">Thank you for your feedback!</p>
            <p className="text-gray-500 text-sm text-center">Your input helps us improve the TA/DA Portal.</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ background: '#1f7cc9' }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category <span className="text-red-500">*</span></label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              >
                <option value="">Select a category…</option>
                {FEEDBACK_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Feedback <span className="text-red-500">*</span></label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={5}
                placeholder="Describe your feedback in detail…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!category || !message.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: '#1f7cc9' }}
              >
                <Send size={14} />
                Submit Feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ currentUser, currentPath }: SidebarProps) {
  const groups = getNavGroups(currentUser.role);
  const [showFeedback, setShowFeedback] = useState(false);
  const isTrainer = currentUser.role === 'Trainer';

  return (
    <>
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: '#1f7cc9' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-start px-4 py-4 border-b border-blue-400/30 flex-shrink-0">
        <img
          src="/koenig-logo-white.svg"
          alt="Koenig Solutions"
          className="h-10 w-auto"
          draggable={false}
        />
        <p className="text-blue-200 text-[10px] mt-1 pl-1 tracking-wide">TA / DA Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {groups.map((group, idx) => (
          <NavGroupSection key={idx} group={group} currentPath={currentPath} />
        ))}
      </nav>

      {/* Feedback button — Trainer only */}
      {isTrainer && (
        <div className="flex-shrink-0 px-3 pb-2">
          <button
            onClick={() => setShowFeedback(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <MessageSquarePlus size={16} className="flex-shrink-0 opacity-90" />
            <span className="flex-1 text-left">Share Feedback</span>
          </button>
        </div>
      )}

      {/* User foot */}
      <div className="flex-shrink-0 border-t border-blue-400/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(currentUser.role === 'HRAdmin' || currentUser.originalRole === 'HRAdmin') ? 'Admin' : currentUser.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">
              {(currentUser.role === 'HRAdmin' || currentUser.originalRole === 'HRAdmin') ? 'HR/Admin' : currentUser.name}
            </p>
            {/* Show designation + department from PMS if available, else role */}
            {currentUser.pmsDetails ? (() => {
              const pms = currentUser.pmsDetails!;
              const desig = [
                pms.designation_name, pms.designation,
              ].find(v => v && String(v).trim() && String(v).trim().toLowerCase() !== 'null');
              const dept = [
                pms.deparment_name, pms.department_name, pms.department,
              ].find(v => v && String(v).trim() && String(v).trim().toLowerCase() !== 'null');
              const city = pms.city_name;
              const line2 = desig ? String(desig).trim() : currentUser.role;
              const line3 = [dept ? String(dept).trim() : null, city ? String(city).trim() : null]
                .filter(Boolean).join(', ');
              return (
                <>
                  <p className="text-blue-100 text-[11px] truncate leading-tight">{line2}</p>
                  {line3 && <p className="text-blue-300 text-[10px] truncate leading-tight">{line3}</p>}
                  {currentUser.trainerId && (
                    <p className="text-blue-300 text-[10px] font-mono leading-tight">
                      EMP-{currentUser.trainerId.replace(/^EMP-/i, '')}
                    </p>
                  )}
                </>
              );
            })() : (
              <>
                <p className="text-blue-200 text-xs truncate">{currentUser.role}</p>
                {currentUser.trainerId && (
                  <p className="text-blue-300 text-[10px] font-mono leading-tight">
                    EMP-{currentUser.trainerId.replace(/^EMP-/i, '')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </aside>

    {showFeedback && (
      <FeedbackModal
        onClose={() => setShowFeedback(false)}
        trainerName={currentUser.name}
        trainerId={currentUser.trainerId}
      />
    )}
    </>
  );
}

