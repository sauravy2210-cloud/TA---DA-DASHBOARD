import React, { useState } from 'react';
import type { ExceptionRequest, ExceptionStatus, ReasonCode } from '../types';
import ReasonCodeSelect from './ReasonCodeSelect';

interface ExceptionPanelProps {
  exceptions: ExceptionRequest[];
  onApprove?: (id: string, remarks: string) => void;
  onReject?: (id: string, remarks: string, reason: ReasonCode) => void;
  isApprover?: boolean;
}

function fmt(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const STATUS_STYLE: Record<ExceptionStatus, { bg: string; text: string; border: string; label: string }> = {
  Pending: {
    bg: 'var(--accent-amber-bg)',
    text: 'var(--accent-amber)',
    border: 'var(--accent-amber-border)',
    label: '⏳ Pending',
  },
  Approved: {
    bg: 'var(--success-bg)',
    text: 'var(--success-text)',
    border: 'var(--success-border)',
    label: '✓ Approved',
  },
  Rejected: {
    bg: 'var(--danger-bg)',
    text: 'var(--danger-text)',
    border: 'var(--danger-border)',
    label: '✗ Rejected',
  },
};

// ── Per-exception action state ──────────────────────────────────────────────

interface ActionState {
  remarks: string;
  reasonCode: string;
}

export const ExceptionPanel: React.FC<ExceptionPanelProps> = ({
  exceptions,
  onApprove,
  onReject,
  isApprover = false,
}) => {
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getState(id: string): ActionState {
    return actionState[id] ?? { remarks: '', reasonCode: '' as string };
  }

  function updateState(id: string, patch: Partial<ActionState>) {
    setActionState((prev) => ({
      ...prev,
      [id]: { ...getState(id), ...patch },
    }));
  }

  function handleApprove(ex: ExceptionRequest) {
    const { remarks } = getState(ex.exceptionId);
    if (onApprove) {
      onApprove(ex.exceptionId, remarks);
    }
    setExpandedId(null);
  }

  function handleReject(ex: ExceptionRequest) {
    const { remarks, reasonCode } = getState(ex.exceptionId);
    if (!reasonCode) return;
    if (onReject) {
      onReject(ex.exceptionId, remarks, reasonCode as unknown as ReasonCode);
    }
    setExpandedId(null);
  }

  if (exceptions.length === 0) {
    return (
      <div className="koenig-card">
        <div className="koenig-card-header">
          <h3 className="koenig-card-title">Exception Requests</h3>
        </div>
        <div className="koenig-card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          No exception requests for this claim.
        </div>
      </div>
    );
  }

  const pendingCount = exceptions.filter((e) => e.status === 'Pending').length;

  return (
    <div className="koenig-card">
      <div className="koenig-card-header">
        <h3 className="koenig-card-title">Exception Requests</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {pendingCount > 0 && (
            <span
              className="koenig-badge"
              style={{
                backgroundColor: 'var(--accent-amber-bg)',
                color: 'var(--accent-amber)',
                borderColor: 'var(--accent-amber-border)',
              }}
            >
              {pendingCount} Pending
            </span>
          )}
          <span
            className="koenig-badge"
            style={{
              backgroundColor: 'var(--surface-muted)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            {exceptions.length} Total
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {exceptions.map((ex, idx) => {
          const ss = STATUS_STYLE[ex.status];
          const state = getState(ex.exceptionId);
          const isExpanded = expandedId === ex.exceptionId;
          const canAct = isApprover && ex.status === 'Pending';

          return (
            <div
              key={ex.exceptionId}
              style={{
                borderTop: idx > 0 ? '1px solid var(--border-muted)' : undefined,
                padding: '1.25rem 1.5rem',
                backgroundColor: isExpanded ? 'var(--surface-muted)' : undefined,
                transition: 'background-color var(--transition-fast)',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                    <span
                      className="koenig-badge"
                      style={{
                        backgroundColor: ss.bg,
                        color: ss.text,
                        borderColor: ss.border,
                      }}
                    >
                      {ss.label}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {ex.exceptionId}
                    </span>
                    {ex.lineItemId && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Line: {ex.lineItemId}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {ex.reason}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <span>
                      <strong>Requested by:</strong> {ex.requestedBy}
                    </span>
                    <span>
                      <strong>Date:</strong> {fmtDate(ex.requestedAt)}
                    </span>
                    {ex.amount != null && (
                      <span>
                        <strong>Amount:</strong>{' '}
                        <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>
                          {fmt(ex.amount)}
                        </span>
                      </span>
                    )}
                    {ex.approvedBy && (
                      <span>
                        <strong>{ex.status === 'Approved' ? 'Approved' : 'Actioned'} by:</strong>{' '}
                        {ex.approvedBy}
                        {ex.approvedAt ? ` on ${fmtDate(ex.approvedAt)}` : ''}
                      </span>
                    )}
                  </div>

                  {ex.remarks && (
                    <p
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                      }}
                    >
                      Remarks: {ex.remarks}
                    </p>
                  )}
                </div>

                {canAct && (
                  <button
                    className="koenig-btn koenig-btn-ghost koenig-btn-sm"
                    onClick={() => setExpandedId(isExpanded ? null : ex.exceptionId)}
                    style={{ flexShrink: 0 }}
                  >
                    {isExpanded ? 'Cancel' : 'Review'}
                  </button>
                )}
              </div>

              {/* Approver action panel */}
              {canAct && isExpanded && (
                <div
                  style={{
                    marginTop: '1rem',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div>
                      <label className="koenig-label" htmlFor={`remarks-${ex.exceptionId}`}>
                        Remarks
                      </label>
                      <textarea
                        id={`remarks-${ex.exceptionId}`}
                        className="koenig-input"
                        rows={2}
                        placeholder="Enter remarks (optional for approval, recommended for rejection)"
                        value={state.remarks}
                        onChange={(e) => updateState(ex.exceptionId, { remarks: e.target.value })}
                        style={{ resize: 'vertical', minHeight: '60px' }}
                      />
                    </div>

                    <div>
                      <label className="koenig-label" htmlFor={`reason-${ex.exceptionId}`}>
                        Reason Code <span style={{ color: 'var(--danger)' }}>*</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (required for rejection)</span>
                      </label>
                      <ReasonCodeSelect
                        value={state.reasonCode}
                        onChange={(code) => updateState(ex.exceptionId, { reasonCode: code })}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        className="koenig-btn koenig-btn-primary koenig-btn-sm"
                        onClick={() => handleApprove(ex)}
                      >
                        ✓ Approve Exception
                      </button>
                      <button
                        className="koenig-btn koenig-btn-danger koenig-btn-sm"
                        onClick={() => handleReject(ex)}
                        disabled={!state.reasonCode}
                        title={!state.reasonCode ? 'Select a reason code to reject' : undefined}
                      >
                        ✗ Reject Exception
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExceptionPanel;

