import { Menu, Search, Bell, LogOut } from 'lucide-react';
import { formatDate } from '../services/calculationEngine';
import type { User, UserRole } from '../types';

interface HeaderProps {
  currentUser: User;
  onRoleSwitch: (role: UserRole) => void;
  searchValue: string;
  onSearch: (value: string) => void;
  onMenuToggle?: () => void;
  notificationCount?: number;
  onLogout?: () => void;
}

const ROLE_TABS: { label: string; value: UserRole }[] = [
  { label: 'Trainer', value: 'Trainer' },
  { label: 'HR/Admin', value: 'HRAdmin' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Super Admin', value: 'SuperAdmin' },
];

export default function Header({
  currentUser,
  onRoleSwitch,
  searchValue,
  onSearch,
  onMenuToggle,
  notificationCount = 0,
  onLogout,
}: HeaderProps) {
  const today = formatDate(new Date().toISOString());

  return (
    <header
      className="sticky top-0 z-30 bg-white border-b border-gray-200 flex flex-col"
      style={{ minHeight: '64px' }}
    >
      {/* Primary row */}
      <div className="flex items-center gap-4 px-4 h-16">
        {/* Left: hamburger + portal label */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-base font-semibold text-gray-800 hidden sm:block">
            TA/DA Portal
          </span>
        </div>

        {/* Center: search */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search bill no, PNR, invoice, trainer..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                         placeholder-gray-400 text-gray-700 transition-all"
            />
          </div>
        </div>

        {/* Right: notifications, avatar, date, logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Date */}
          <span className="text-xs text-gray-500 hidden lg:block">{today}</span>

          {/* Notification bell */}
          <div className="relative">
            <button
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white leading-none">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </div>

          {/* Avatar + welcome */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: '#1f7cc9' }}
            >
              {currentUser.avatarInitials}
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-xs text-gray-500">Welcome:</span>
              <span className="text-sm font-semibold text-gray-800 leading-tight max-w-[120px] truncate">
                {currentUser.name}
              </span>
            </div>
            {/* Role pill */}
            <span
              className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ background: '#1f7cc9' }}
            >
              {currentUser.role === 'HRAdmin' ? 'HR Admin' : currentUser.role}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-all"
            aria-label="Logout"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Role switcher tabs */}
      <div className="flex items-center gap-1 px-4 pb-2 border-t border-gray-100">
        <span className="text-xs text-gray-400 mr-2 hidden sm:block">View as:</span>
        {ROLE_TABS.map((tab) => {
          const isActive = currentUser.role === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onRoleSwitch(tab.value)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
                isActive
                  ? 'text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              ].join(' ')}
              style={isActive ? { background: '#1f7cc9' } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

