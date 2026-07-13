import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
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
      { label: 'Select Date Range', path: '/create-bill', icon: <FilePlus size={16} /> },
      { label: 'View My Bills', path: '/claims', icon: <ClipboardList size={16} /> },
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

export default function Sidebar({ currentUser, currentPath }: SidebarProps) {
  const groups = getNavGroups(currentUser.role);

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: '#1f7cc9' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-400/30 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <FileText size={16} className="text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-lg tracking-widest">KOENIG</span>
          <p className="text-blue-200 text-xs leading-none mt-0.5">TA / DA Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {groups.map((group, idx) => (
          <NavGroupSection key={idx} group={group} currentPath={currentPath} />
        ))}
      </nav>

      {/* User foot */}
      <div className="flex-shrink-0 border-t border-blue-400/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{currentUser.name}</p>
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
  );
}

