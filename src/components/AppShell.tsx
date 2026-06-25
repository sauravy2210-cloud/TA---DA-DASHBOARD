import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { User, UserRole } from '../types';

interface AppShellProps {
  children: React.ReactNode;
  currentUser: User;
  onRoleSwitch: (role: UserRole) => void;
  onLogout?: () => void;
  currentPath?: string;
}

const SIDEBAR_WIDTH = 240;

export default function AppShell({
  children,
  currentUser,
  onRoleSwitch,
  onLogout,
  currentPath: currentPathProp,
}: AppShellProps) {
  const location = useLocation();
  const currentPath = currentPathProp ?? location.pathname;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  const handleNavigate = (_path: string) => {
    // Navigation is handled by NavLink; this can be used for analytics or close-on-mobile
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#eef4fa' }}>
      {/* Sidebar — fixed left */}
      <aside
        className="flex-shrink-0 h-full transition-all duration-200 ease-in-out overflow-hidden"
        style={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          minWidth: sidebarOpen ? SIDEBAR_WIDTH : 0,
          position: 'relative',
        }}
      >
        <div
          className="h-full"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <Sidebar
            currentUser={currentUser}
            currentPath={currentPath}
            onNavigate={handleNavigate}
          />
        </div>
      </aside>

      {/* Right column: header + main */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Header — sticky top */}
        <Header
          currentUser={currentUser}
          onRoleSwitch={onRoleSwitch}
          searchValue={searchValue}
          onSearch={setSearchValue}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          notificationCount={4}
          onLogout={onLogout}
        />

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: '#eef4fa' }}
        >
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

