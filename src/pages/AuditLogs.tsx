import { useState, useMemo } from 'react';
import type { User } from '../types';
import { mockAuditLogs } from '../data/mockClaims';
import { getAuditLogs } from '../services/auditEngine';
import AuditTimeline from '../components/AuditTimeline';
import { exportToCSV } from '../services/exportEngine';

interface AuditLogsProps {
  currentUser?: User;
}

const ACTION_TYPE_OPTIONS = [
  'CLAIM_SUBMITTED', 'CLAIM_UPDATED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED',
  'CLARIFICATION_SENT', 'RESUBMITTED', 'EXCEPTION_RAISED', 'EXCEPTION_APPROVED',
  'EXCEPTION_REJECTED', 'PAYMENT_PROCESSED', 'PAYMENT_DISBURSED', 'PAYMENT_INITIATED',
  'POLICY_CHANGED', 'CLAIM_CANCELLED', 'CLAIM_REOPENED', 'LEDGER_VERIFIED',
  'ATTACHMENT_UPLOADED', 'AMOUNT_CHANGED', 'DEDUCTION_ADDED',
];

const ENTITY_TYPE_OPTIONS = ['Claim', 'Payment', 'Policy', 'Exception', 'Attachment', 'User'];

function renderVal(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function fmtDateTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogs({ currentUser: _currentUser }: AuditLogsProps) {
  const [view, setView] = useState<'timeline' | 'table'>('timeline');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [entityType, setEntityType] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [claimId, setClaimId] = useState('');

  // Merge persisted + mock logs
  const allLogs = useMemo(() => {
    const persisted = getAuditLogs();
    const mockIds = new Set(mockAuditLogs.map((l) => l.logId));
    const unique = persisted.filter((l) => !mockIds.has(l.logId));
    return [...mockAuditLogs, ...unique].sort(
      (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );
  }, []);

  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (dateFrom && log.performedAt < dateFrom) return false;
      if (dateTo && log.performedAt > dateTo + 'T23:59:59') return false;
      if (actionTypes.length > 0 && !actionTypes.includes(log.action)) return false;
      if (entityType && !(log.entityType ?? '').toLowerCase().includes(entityType.toLowerCase())) return false;
      if (performedBy && !log.performedBy.toLowerCase().includes(performedBy.toLowerCase())) return false;
      if (claimId && !(log.claimId ?? '').toLowerCase().includes(claimId.toLowerCase())) return false;
      return true;
    });
  }, [allLogs, dateFrom, dateTo, actionTypes, entityType, performedBy, claimId]);

  function toggleAction(action: string) {
    setActionTypes((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  }

  function handleExport() {
    const headers = ['Log ID', 'Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Performed By', 'Role', 'Old Value', 'New Value', 'Reason', 'Remarks', 'Claim ID', 'IP'];
    const rows = filtered.map((log) => [
      log.logId,
      fmtDateTime(log.performedAt),
      log.action,
      log.entityType ?? '',
      log.entityId ?? '',
      log.performedBy,
      log.performedByRole,
      renderVal(log.oldValue),
      renderVal(log.newValue),
      log.reasonCode ?? '',
      log.remarks ?? '',
      log.claimId ?? '',
      log.ipAddress ?? '',
    ]);
    exportToCSV(`Audit_Log_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  }

  const hasFilters = dateFrom || dateTo || actionTypes.length > 0 || entityType || performedBy || claimId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Complete activity trail — {filtered.length} of {allLogs.length} entries
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
              <button
                onClick={() => setView('timeline')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  view === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Timeline
              </button>
              <button
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  view === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Table
              </button>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Entities</option>
              {ENTITY_TYPE_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Performed By</label>
            <input type="text" placeholder="Name..." value={performedBy} onChange={(e) => setPerformedBy(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Claim ID</label>
            <input type="text" placeholder="e.g. clm-0051" value={claimId} onChange={(e) => setClaimId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {hasFilters && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setActionTypes([]); setEntityType(''); setPerformedBy(''); setClaimId(''); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-4"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Action type multi-select pills */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Action Types</label>
          <div className="flex flex-wrap gap-1.5">
            {ACTION_TYPE_OPTIONS.map((action) => (
              <button
                key={action}
                onClick={() => toggleAction(action)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  actionTypes.includes(action)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {action.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {view === 'timeline' ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <AuditTimeline auditLogs={filtered as any} showClaimId maxItems={20} />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Log ID', 'Timestamp', 'Action', 'Entity', 'Performed By', 'Role', 'Old Value', 'New Value', 'Reason', 'Remarks'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">
                      No audit logs match the selected filters.
                    </td>
                  </tr>
                )}
                {filtered.map((log) => (
                  <tr key={log.logId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600">{log.logId}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(log.performedAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>{log.entityType ?? '—'}</div>
                      {log.claimId && <div className="text-gray-400 font-mono">{log.claimId}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.performedBy}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{log.performedByRole}</td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <span className="block truncate font-mono text-xs text-red-500">{renderVal(log.oldValue)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <span className="block truncate font-mono text-xs text-green-600">{renderVal(log.newValue)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-600">{log.reasonCode ?? '—'}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="block truncate text-xs text-gray-500 italic">{log.remarks ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


