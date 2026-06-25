import React, { useState } from 'react';
import type { ClaimRemarks, UserRole } from '../types';

interface RemarksPanelProps {
  remarks: ClaimRemarks[];
  onAdd?: (text: string, type: 'Trainer' | 'HR' | 'Internal', lineItemId?: string) => void;
  currentUserRole: UserRole;
  currentUserId: string;
}

const REMARK_TYPE_COLORS: Record<string, string> = {
  Trainer: 'bg-blue-100 text-blue-800',
  HR: 'bg-purple-100 text-purple-800',
  Internal: 'bg-amber-100 text-amber-800',
  System: 'bg-gray-100 text-gray-600',
};

const REMARK_TYPE_LABELS: Record<string, string> = {
  Trainer: 'Trainer',
  HR: 'HR',
  Internal: 'Internal',
  System: 'System',
};

function canViewRemark(remark: ClaimRemarks, role: UserRole): boolean {
  if (remark.type === 'System' || remark.type === 'Trainer') return true;
  if (remark.type === 'HR') return role === 'HRAdmin' || role === 'Finance' || role === 'SuperAdmin';
  if (remark.type === 'Internal') return role === 'HRAdmin' || role === 'Finance' || role === 'SuperAdmin';
  return false;
}

function allowedAddTypes(role: UserRole): Array<'Trainer' | 'HR' | 'Internal'> {
  if (role === 'Trainer') return ['Trainer'];
  if (role === 'HRAdmin') return ['HR', 'Internal'];
  if (role === 'Finance') return ['Internal'];
  if (role === 'SuperAdmin') return ['Trainer', 'HR', 'Internal'];
  return [];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

const GROUP_ORDER = ['Trainer', 'HR', 'Internal', 'System'];

const RemarksPanel: React.FC<RemarksPanelProps> = ({
  remarks,
  onAdd,
  currentUserRole,
  currentUserId,
}) => {
  const addTypes = allowedAddTypes(currentUserRole);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'Trainer' | 'HR' | 'Internal'>(addTypes[0] ?? 'Trainer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const visibleRemarks = remarks.filter((r) => canViewRemark(r, currentUserRole));

  const grouped = GROUP_ORDER.reduce<Record<string, ClaimRemarks[]>>((acc, type) => {
    const items = visibleRemarks.filter((r) => r.type === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) {
      setError('Remark text cannot be empty.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onAdd?.(newText.trim(), newType);
      setNewText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Remarks</h3>

      {/* Existing remarks */}
      {Object.entries(grouped).length === 0 ? (
        <p className="text-sm text-gray-400 italic">No remarks yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">{REMARK_TYPE_LABELS[type]}</p>
              <div className="flex flex-col gap-2">
                {items.map((r) => (
                  <div
                    key={r.remarkId}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${REMARK_TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {REMARK_TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.createdBy}
                        {r.createdBy === currentUserId && (
                          <span className="ml-1 text-blue-400">(you)</span>
                        )}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-line">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add remark form */}
      {onAdd && addTypes.length > 0 && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4 flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase">Add Remark</label>
          <div className="flex gap-2 items-start">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Write a remark..."
              rows={3}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'Trainer' | 'HR' | 'Internal')}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              {addTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {error && <span className="text-xs text-red-500">{error}</span>}
            <button
              type="submit"
              disabled={submitting || !newText.trim()}
              className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default RemarksPanel;

