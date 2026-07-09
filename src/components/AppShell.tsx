import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatBot from './ChatBot';
import type { User, UserRole, NotificationLog } from '../types';
import {
  getClaims,
  getNotifications,
  saveNotification,
  markNotificationRead,
  getFromStorage,
  saveToStorage,
  STORAGE_KEYS,
} from '../services/storageService';

interface AppShellProps {
  children: React.ReactNode;
  currentUser: User;
  onRoleSwitch: (role: UserRole) => void;
  onLogout?: () => void;
  currentPath?: string;
}

const SIDEBAR_WIDTH = 240;

// Derive notifications from claims for the current trainer
function deriveNotificationsFromClaims(userId: string): NotificationLog[] {
  const claims = getClaims().filter(c => c.trainerId === userId);
  const existing = getNotifications(userId);
  const existingIds = new Set(existing.map(n => n.notifId));
  const derived: NotificationLog[] = [];

  for (const claim of claims) {
    const idApproved = `auto_approved_${claim.claimId}`;
    const idRejected = `auto_rejected_${claim.claimId}`;
    const idSubmitted = `auto_submitted_${claim.claimId}`;
    const idPaid = `auto_paid_${claim.claimId}`;
    const idClarify = `auto_clarify_${claim.claimId}`;

    const label = claim.billNo || claim.claimId;

    if ((claim.status === 'Approved' || claim.status === 'Partially Approved') && !existingIds.has(idApproved)) {
      derived.push({
        notifId: idApproved,
        recipientId: userId,
        type: 'approved',
        title: `Bill ${label} approved`,
        message: `Your TA/DA bill ${label} has been ${claim.status.toLowerCase()}. Check "My Bills" for details.`,
        relatedClaimId: claim.claimId,
        read: false,
        createdAt: claim.lastActionAt || claim.submittedAt || new Date().toISOString(),
      });
    }

    if (claim.status === 'Rejected' && !existingIds.has(idRejected)) {
      derived.push({
        notifId: idRejected,
        recipientId: userId,
        type: 'rejected',
        title: `Bill ${label} rejected`,
        message: `Your TA/DA bill ${label} was rejected. Please review the remarks and resubmit.`,
        relatedClaimId: claim.claimId,
        read: false,
        createdAt: claim.lastActionAt || claim.submittedAt || new Date().toISOString(),
      });
    }

    if (claim.status === 'Submitted' && !existingIds.has(idSubmitted)) {
      derived.push({
        notifId: idSubmitted,
        recipientId: userId,
        type: 'submitted',
        title: `Bill ${label} submitted`,
        message: `Bill ${label} is under review by HR/Finance team.`,
        relatedClaimId: claim.claimId,
        read: false,
        createdAt: claim.submittedAt || new Date().toISOString(),
      });
    }

    if (claim.status === 'Paid' && !existingIds.has(idPaid)) {
      derived.push({
        notifId: idPaid,
        recipientId: userId,
        type: 'approved',
        title: `Payment processed for ${label}`,
        message: `Your TA/DA payment for bill ${label} has been processed successfully.`,
        relatedClaimId: claim.claimId,
        read: false,
        createdAt: claim.lastActionAt || claim.submittedAt || new Date().toISOString(),
      });
    }

    if (claim.status === 'Clarification Required' && !existingIds.has(idClarify)) {
      derived.push({
        notifId: idClarify,
        recipientId: userId,
        type: 'rejected',
        title: `Clarification needed for ${label}`,
        message: `HR has requested clarification on bill ${label}. Please respond promptly.`,
        relatedClaimId: claim.claimId,
        read: false,
        createdAt: claim.lastActionAt || claim.submittedAt || new Date().toISOString(),
      });
    }
  }

  // Persist newly derived notifications
  for (const n of derived) {
    saveNotification(n);
  }

  return derived;
}

function markAllRead(userId: string) {
  const all = getFromStorage<NotificationLog[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = all.map(n => n.recipientId === userId ? { ...n, read: true } : n);
  saveToStorage(STORAGE_KEYS.NOTIFICATIONS, updated);
}

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
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);

  const refreshNotifications = useCallback(() => {
    // Derive new ones from claims, then load all for this user
    deriveNotificationsFromClaims(currentUser.id);
    const all = getNotifications(currentUser.id);
    setNotifications(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [currentUser.id]);

  // Load on mount and whenever the page changes (catches bill submissions)
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications, location.pathname]);

  const handleMarkRead = (notifId: string) => {
    markNotificationRead(notifId);
    setNotifications(prev => prev.map(n => n.notifId === notifId ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = () => {
    markAllRead(currentUser.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

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
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
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

      {/* Floating chatbot — only for Trainer role */}
      {currentUser.role === 'Trainer' && <ChatBot />}
    </div>
  );
}
