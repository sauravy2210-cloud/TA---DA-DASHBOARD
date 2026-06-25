import { useState, useMemo } from 'react';
import { mockClaims } from '../data/mockClaims';
import { markNotificationRead, saveToStorage, getFromStorage, STORAGE_KEYS } from '../services/storageService';
import { getSLAAlerts, type SLAAlert, type SLAPriority } from '../services/notificationEngine';

type Tab = 'notifications' | 'sla';

// ── Seed mock notifications if none exist ───────────────────────────────────

const MOCK_NOTIFS = [
  {
    id: 'mn-001',
    userId: 'trainer-001',
    notifId: 'mn-001',
    recipientId: 'trainer-001',
    type: 'success',
    title: 'Claim Approved',
    message: 'Bill TA-2026-0049 has been approved for ₹29,400. Payment will be processed shortly.',
    claimId: 'clm-0049',
    relatedClaimId: 'clm-0049',
    read: false,
    createdAt: '2026-06-08T14:10:00.000Z',
  },
  {
    id: 'mn-002',
    userId: 'admin-001',
    notifId: 'mn-002',
    recipientId: 'admin-001',
    type: 'info',
    title: 'New Claim Submitted',
    message: 'Bill TA-2026-0051 submitted by Imran Khan for TechMah Office — ₹28,400 claimed.',
    claimId: 'clm-0051',
    relatedClaimId: 'clm-0051',
    read: false,
    createdAt: '2026-06-21T10:16:00.000Z',
  },
  {
    id: 'mn-003',
    userId: 'trainer-002',
    notifId: 'mn-003',
    recipientId: 'trainer-002',
    type: 'warning',
    title: 'Clarification Required',
    message: 'Bill TA-2026-0039 requires your attention. Please review the remarks and provide the requested clarification.',
    claimId: 'clm-0039',
    relatedClaimId: 'clm-0039',
    read: true,
    createdAt: '2026-06-17T11:00:00.000Z',
  },
  {
    id: 'mn-004',
    userId: 'admin-001',
    notifId: 'mn-004',
    recipientId: 'admin-001',
    type: 'error',
    title: 'Missing Documents Detected',
    message: 'Bill TA-2026-0051 has missing supporting documents. Trainer needs to upload receipts before processing.',
    claimId: 'clm-0051',
    relatedClaimId: 'clm-0051',
    read: false,
    createdAt: '2026-06-21T10:18:00.000Z',
  },
  {
    id: 'mn-005',
    userId: 'finance-001',
    notifId: 'mn-005',
    recipientId: 'finance-001',
    type: 'info',
    title: 'Payment Processed',
    message: 'Payment of ₹29,400 for bill TA-2026-0049 has been processed. Reference: UTR20260615001.',
    claimId: 'clm-0049',
    relatedClaimId: 'clm-0049',
    read: true,
    createdAt: '2026-06-15T09:30:00.000Z',
  },
  {
    id: 'mn-006',
    userId: 'admin-001',
    notifId: 'mn-006',
    recipientId: 'admin-001',
    type: 'warning',
    title: 'SLA Approaching',
    message: 'Bill TA-2026-0042 has been under review for 5 days. SLA threshold is 7 days.',
    claimId: 'clm-0042',
    relatedClaimId: 'clm-0042',
    read: false,
    createdAt: '2026-06-24T08:00:00.000Z',
  },
  {
    id: 'mn-007',
    userId: 'trainer-003',
    notifId: 'mn-007',
    recipientId: 'trainer-003',
    type: 'success',
    title: 'Payment Disbursed',
    message: 'Your TA/DA payment of ₹34,000 for TA-2026-0028 has been scheduled for 28 June 2026.',
    claimId: 'clm-0028',
    relatedClaimId: 'clm-0028',
    read: false,
    createdAt: '2026-06-24T09:05:00.000Z',
  },
];

function seedNotifications() {
  const existing = getFromStorage<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  if (existing.length === 0) {
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFS);
  }
}

seedNotifications();

// ── Type icons ───────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  success: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ),
  warning: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </span>
  ),
  error: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  ),
  info: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  ),
};

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<SLAPriority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Priority: {
    label: 'Priority',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-600 animate-pulse',
  },
  Red: {
    label: 'Red',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  Orange: {
    label: 'Orange',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Yellow: {
    label: 'Yellow',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-400',
  },
};

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function groupByDate<T extends { createdAt: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  items.forEach((item) => {
    const d = item.createdAt.slice(0, 10);
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : fmtDate(d);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(item);
  });
  return Array.from(map.entries());
}

export default function NotificationsSLA() {
  const [activeTab, setActiveTab] = useState<Tab>('notifications');
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  // Get all notifications (from storage, fallback to mock)
  const allNotifs = useMemo(() => {
    const stored = getFromStorage<any[]>(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFS);
    return [...stored].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [localRead]);

  const slaAlerts = useMemo(() => getSLAAlerts(mockClaims as any), []);

  const alertGroups = useMemo(() => {
    const groups: Record<SLAPriority, SLAAlert[]> = { Priority: [], Red: [], Orange: [], Yellow: [] };
    slaAlerts.forEach((a) => groups[a.priority].push(a));
    return groups;
  }, [slaAlerts]);

  const unreadCount = allNotifs.filter((n) => !n.read && !localRead.has(n.id)).length;

  function handleMarkRead(id: string) {
    markNotificationRead(id);
    setLocalRead((prev) => new Set([...prev, id]));
  }

  function handleMarkAllRead() {
    allNotifs.forEach((n) => {
      if (!n.read) markNotificationRead(n.id ?? n.notifId);
    });
    setLocalRead(new Set(allNotifs.map((n) => n.id ?? n.notifId)));
  }

  const grouped = useMemo(() => groupByDate(allNotifs), [allNotifs]);

  const priorityOrder: SLAPriority[] = ['Priority', 'Red', 'Orange', 'Yellow'];
  const alertCounts = {
    Priority: alertGroups.Priority.length,
    Red: alertGroups.Red.length,
    Orange: alertGroups.Orange.length,
    Yellow: alertGroups.Yellow.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notifications & SLA Monitor</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
              {slaAlerts.length > 0 && ` · ${slaAlerts.length} SLA alert${slaAlerts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b-0">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            My Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white min-w-[18px]">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'sla'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            SLA Alerts
            {slaAlerts.length > 0 && (
              <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold text-white min-w-[18px] ${alertCounts.Priority > 0 ? 'bg-red-600' : 'bg-amber-500'}`}>
                {slaAlerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        {/* ── Notifications Tab ── */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {/* Mark all read */}
            {unreadCount > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Mark all as read
                </button>
              </div>
            )}

            {allNotifs.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">No notifications yet</p>
                <p className="mt-1 text-xs text-gray-400">You're all caught up!</p>
              </div>
            )}

            {grouped.map(([dateLabel, notifs]) => (
              <div key={dateLabel}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{dateLabel}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="space-y-2">
                  {notifs.map((notif) => {
                    const isRead = notif.read || localRead.has(notif.id ?? notif.notifId);
                    return (
                      <div
                        key={notif.id ?? notif.notifId}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                          isRead
                            ? 'border-gray-100 bg-white opacity-70'
                            : 'border-indigo-100 bg-white shadow-sm ring-1 ring-indigo-50'
                        }`}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {TYPE_ICON[notif.type] ?? TYPE_ICON.info}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold leading-tight ${isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                              {notif.title}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!isRead && (
                                <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                              )}
                              <span className="text-xs text-gray-400 whitespace-nowrap">{fmtTime(notif.createdAt)}</span>
                            </div>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{notif.message}</p>
                          <div className="mt-1.5 flex items-center gap-3">
                            {(notif.claimId ?? notif.relatedClaimId) && (
                              <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                                {notif.claimId ?? notif.relatedClaimId}
                              </span>
                            )}
                            {!isRead && (
                              <button
                                onClick={() => handleMarkRead(notif.id ?? notif.notifId)}
                                className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SLA Alerts Tab ── */}
        {activeTab === 'sla' && (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {priorityOrder.map((priority) => {
                const cfg = PRIORITY_CONFIG[priority];
                const count = alertCounts[priority];
                return (
                  <div key={priority} className={`rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className={`mt-1 text-2xl font-bold ${cfg.color}`}>{count}</div>
                    <div className="text-xs text-gray-500">{count === 1 ? 'alert' : 'alerts'}</div>
                  </div>
                );
              })}
            </div>

            {slaAlerts.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">No SLA alerts</p>
                <p className="mt-1 text-xs text-gray-400">All claims are within SLA thresholds.</p>
              </div>
            )}

            {priorityOrder.map((priority) => {
              const alerts = alertGroups[priority];
              if (alerts.length === 0) return null;
              const cfg = PRIORITY_CONFIG[priority];

              return (
                <div key={priority}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
                      {cfg.label} — {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  <div className="space-y-2">
                    {alerts.map((alert) => {
                      const claim = alert.claim as any;
                      return (
                        <div
                          key={claim.claimId}
                          className={`flex items-start gap-4 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3`}
                        >
                          {/* Priority badge */}
                          <div className="flex-shrink-0 mt-0.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.color}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </div>

                          {/* Claim info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-xs font-semibold text-indigo-700">{claim.billNo}</span>
                                <span className="mx-2 text-gray-300">·</span>
                                <span className="text-sm font-medium text-gray-900">{claim.trainerName}</span>
                              </div>
                              <span className="flex-shrink-0 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                                {claim.agingDays}d aging
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-gray-600">{alert.alertType}</p>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>{claim.clientName}</span>
                              <span className="text-gray-300">·</span>
                              <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                                claim.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                claim.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                claim.status === 'Approved' || claim.status === 'Partially Approved' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {claim.status}
                              </span>
                              {claim.submittedAt && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span>Submitted {fmtDate(claim.submittedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action */}
                          <div className="flex-shrink-0">
                            <button className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm">
                              View Claim
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

