'use client';

import { useState, useMemo } from 'react';
import type { AuditLog } from '../types';
import { formatDate } from '../services/calculationEngine';

// ── Color coding by action keyword ─────────────────────────────────────────────

type ActionGroup = 'approved' | 'rejected' | 'clarification' | 'submitted' | 'system';

function classifyAction(action: string): ActionGroup {
  const lower = action.toLowerCase();
  if (lower.includes('approv')) return 'approved';
  if (lower.includes('reject') || lower.includes('denied') || lower.includes('cancel')) return 'rejected';
  if (lower.includes('clarif') || lower.includes('hold') || lower.includes('queried')) return 'clarification';
  if (lower.includes('submit') || lower.includes('resubmit') || lower.includes('create') || lower.includes('paid') || lower.includes('payment')) return 'submitted';
  return 'system';
}

const ACTION_STYLES: Record<ActionGroup, { dot: string; badge: string; label: string }> = {
  approved: {
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    label: 'Approved',
  },
  rejected: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    label: 'Rejected',
  },
  clarification: {
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    label: 'Clarification',
  },
  submitted: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    label: 'Submitted',
  },
  system: {
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600',
    label: 'System',
  },
};

// ── Utility ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const datePart = iso.slice(0, 10);
  const timePart = iso.length > 10 ? iso.slice(11, 16) : '';
  return timePart ? `${formatDate(datePart)}, ${timePart}` : formatDate(datePart);
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── CSV export ─────────────────────────────────────────────────────────────────

function exportToCSV(logs: AuditLog[]) {
  const headers = [
    'Log ID',
    'Claim ID',
    'Entity Type',
    'Entity ID',
    'Action',
    'Old Value',
    'New Value',
    'Reason Code',
    'Remarks',
    'Performed By',
    'Role',
    'Performed At',
    'IP Address',
  ];

  const escape = (v: unknown) => {
    const s = renderValue(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = logs.map((log) => [
    escape(log.logId),
    escape(log.claimId ?? ''),
    escape(log.entityType),
    escape(log.entityId),
    escape(log.action),
    escape(log.oldValue),
    escape(log.newValue),
    escape(log.reasonCode ?? ''),
    escape(log.remarks ?? ''),
    escape(log.performedBy),
    escape(log.performedByRole),
    escape(log.performedAt),
    escape(log.ipAddress ?? ''),
  ]);

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Filter pill ────────────────────────────────────────────────────────────────

const ALL_GROUPS: ActionGroup[] = ['approved', 'rejected', 'clarification', 'submitted', 'system'];

function FilterPills({
  active,
  onChange,
}: {
  active: ActionGroup | 'all';
  onChange: (g: ActionGroup | 'all') => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange('all')}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          active === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {ALL_GROUPS.map((g) => {
        const s = ACTION_STYLES[g];
        return (
          <button
            key={g}
            onClick={() => onChange(g)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active === g ? s.badge + ' ring-1 ring-inset ring-current' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AuditTimelineProps {
  auditLogs: AuditLog[];
  showClaimId?: boolean;
  maxItems?: number;
}

export default function AuditTimeline({
  auditLogs,
  showClaimId = false,
  maxItems,
}: AuditTimelineProps) {
  const [filter, setFilter] = useState<ActionGroup | 'all'>('all');
  const [expanded, setExpanded] = useState(false);

  // Sort descending (most recent first)
  const sorted = useMemo(
    () => [...auditLogs].sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()),
    [auditLogs],
  );

  const filtered = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((l) => classifyAction(l.action) === filter)),
    [sorted, filter],
  );

  const limit = maxItems && !expanded ? maxItems : undefined;
  const visible = limit ? filtered.slice(0, limit) : filtered;
  const hasMore = limit !== undefined && filtered.length > limit;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills active={filter} onChange={setFilter} />
        <button
          onClick={() => exportToCSV(filtered)}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gray-500">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Timeline */}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No audit records found.</p>
      ) : (
        <div className="relative flex flex-col">
          {visible.map((log, idx) => {
            const group = classifyAction(log.action);
            const style = ACTION_STYLES[group];
            const isLast = idx === visible.length - 1;
            const hasValueChange = log.oldValue !== undefined || log.newValue !== undefined;

            return (
              <div key={log.logId} className="flex gap-4">
                {/* Left: dot + connector */}
                <div className="flex flex-col items-center">
                  <span className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white shadow ${style.dot}`} />
                  {!isLast && (
                    <div className="mt-1 w-0.5 flex-1 bg-gray-200" style={{ minHeight: '2rem' }} />
                  )}
                </div>

                {/* Right: content */}
                <div className="pb-6 flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{log.action}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                      {style.label}
                    </span>
                    {showClaimId && log.claimId && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                        #{log.claimId}
                      </span>
                    )}
                  </div>

                  {/* Entity info */}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {log.entityType}
                    {log.entityId && (
                      <>
                        {' '}
                        <span className="font-mono text-gray-400">({log.entityId})</span>
                      </>
                    )}
                  </p>

                  {/* Value change */}
                  {hasValueChange && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-xs">
                      <span className="font-mono text-red-600 line-through">
                        {renderValue(log.oldValue)}
                      </span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-gray-400 shrink-0">
                        <path
                          fillRule="evenodd"
                          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-mono text-green-700">
                        {renderValue(log.newValue)}
                      </span>
                    </div>
                  )}

                  {/* Reason code */}
                  {log.reasonCode && (
                    <span className="mt-1.5 inline-block rounded bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-700">
                      {log.reasonCode}
                    </span>
                  )}

                  {/* Remarks */}
                  {log.remarks && (
                    <p className="mt-1.5 text-sm italic text-gray-600">
                      &ldquo;{log.remarks}&rdquo;
                    </p>
                  )}

                  {/* Footer: performed by + timestamp */}
                  <p className="mt-1.5 text-xs text-gray-400">
                    <span className="font-medium text-gray-600">{log.performedBy}</span>
                    <span className="mx-1">·</span>
                    <span>{log.performedByRole}</span>
                    <span className="mx-1">·</span>
                    {formatDateTime(log.performedAt)}
                    {log.ipAddress && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="font-mono">{log.ipAddress}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show more */}
      {hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          Show {filtered.length - (limit ?? 0)} more entries
        </button>
      )}
    </div>
  );
}

