import { useState, useRef, useEffect } from 'react';
import { Menu, Search, Bell, LogOut, CheckCheck, Info, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { formatDate } from '../services/calculationEngine';
import type { User, UserRole, NotificationLog } from '../types';

interface HeaderProps {
  currentUser: User;
  onRoleSwitch: (role: UserRole) => void;
  searchValue: string;
  onSearch: (value: string) => void;
  onMenuToggle?: () => void;
  notifications?: NotificationLog[];
  onMarkRead?: (notifId: string) => void;
  onMarkAllRead?: () => void;
  onLogout?: () => void;
}

const ROLE_TABS: { label: string; value: UserRole }[] = [
  { label: 'Trainer', value: 'Trainer' },
  { label: 'HR/Admin', value: 'HRAdmin' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Super Admin', value: 'SuperAdmin' },
];

function notifIcon(type: string) {
  if (type === 'approved') return <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />;
  if (type === 'rejected') return <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />;
  if (type === 'submitted') return <Clock size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />;
  return <Info size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Header({
  currentUser,
  onRoleSwitch,
  searchValue,
  onSearch,
  onMenuToggle,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onLogout,
}: HeaderProps) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = formatDate(todayIso);

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bellOpen]);

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
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(o => !o)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white leading-none pointer-events-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}

            {/* Notification dropdown */}
            {bellOpen && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl shadow-xl overflow-hidden z-50"
                style={{ width: 340, border: '1px solid #e2e8f0', background: '#ffffff' }}
              >
                {/* Dropdown header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: '#f8fafc' }}>
                  <span className="text-sm font-semibold text-gray-800">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">{unreadCount}</span>
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => { onMarkAllRead?.(); }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <Bell size={28} className="text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400 font-medium">You're all caught up!</p>
                      <p className="text-xs text-gray-300 mt-1">No notifications yet.</p>
                    </div>
                  ) : (
                    notifications
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(n => (
                        <div
                          key={n.notifId}
                          onClick={() => { if (!n.read) onMarkRead?.(n.notifId); }}
                          className={`flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                        >
                          {notifIcon(n.type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-snug ${!n.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                              {n.title}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
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
        {ROLE_TABS.filter(tab => {
          if (currentUser.role === 'Trainer') return tab.value === 'Trainer';
          if (currentUser.role === 'HRAdmin') return tab.value === 'HRAdmin';
          return true;
        }).map((tab) => {
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
