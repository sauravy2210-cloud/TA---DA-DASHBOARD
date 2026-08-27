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
import { backfillReceiptsToBlob } from '../services/receiptBackfill';

interface AppShellProps {
  children: React.ReactNode;
  currentUser: User;
  onRoleSwitch: (role: UserRole) => void;
  onLogout?: () => void;
  currentPath?: string;
}

const SIDEBAR_WIDTH = 240;

// Derive notifications for HR/Admin — one per submitted/resubmitted claim
function deriveHRAdminNotifications(recipientId: string): void {
  const claims = getClaims().filter(
    c => c.status === 'Submitted' || c.status === 'Resubmitted'
  );
  const existing = getNotifications(recipientId);
  const existingIds = new Set(existing.map(n => n.notifId));

  for (const claim of claims) {
    const notifId = `hr_submitted_${claim.claimId}`;
    if (existingIds.has(notifId)) continue;
    saveNotification({
      notifId,
      recipientId,
      type: 'submitted',
      title: `New bill submitted by ${claim.trainerName}`,
      message: `Bill ${claim.billNo} has been submitted and is awaiting your review.`,
      relatedClaimId: claim.claimId,
      read: false,
      createdAt: claim.submittedAt || new Date().toISOString(),
    });
  }
}

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
    if (currentUser.role === 'HRAdmin' || currentUser.role === 'SuperAdmin') {
      deriveHRAdminNotifications(currentUser.id);
    } else {
      deriveNotificationsFromClaims(currentUser.id);
    }
    const all = getNotifications(currentUser.id);
    setNotifications(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [currentUser.id, currentUser.role]);

  // Load on mount and whenever the page changes (catches bill submissions)
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications, location.pathname]);

  // Silently upload any base64 receipts in localStorage to Vercel Blob
  // so HR Admin can view them from any device (runs once per session, trainer only)
  useEffect(() => {
    if (currentUser.role === 'Trainer') {
      backfillReceiptsToBlob().catch(() => {});
    }
  }, [currentUser.role]);

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
            {currentUser.role === 'Trainer' && (
              <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-3 text-center">
                <p className="text-sm font-bold text-amber-800">
                  ⚠️ Avoid Delays &amp; Rework: Upload all required mail approvals from travel desk, bills, and supporting documents with your claim to ensure a smooth one-time settlement.
                </p>
              </div>
            )}
            {currentUser.role === 'Trainer' && (
              <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-red-700 uppercase tracking-wide">Important Rules — Please Read Before Submitting</span>
                </div>
                <ul className="space-y-2 pl-1">
                  <li className="flex items-start gap-2 text-sm text-red-800">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <span><strong>Multiple Assignment IDs not allowed:</strong> Each claim must contain only one Assignment ID. Submitting multiple Assignment IDs in a single claim will result in immediate rejection.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-red-800">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <span><strong>Attachment amount must match entered amount:</strong> The amount written on your receipt/attachment in Step 7 (Travel Bills) and Step 8 (Miscellaneous Expenses) must exactly match the amount you fill in the form. Mismatched amounts will lead to rejection.</span>
                  </li>
                </ul>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Floating chatbot — only for Trainer role */}
      {currentUser.role === 'Trainer' && <ChatBot />}
    </div>
  );
}
