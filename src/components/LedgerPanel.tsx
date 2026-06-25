import React, { useState } from 'react';
import type { ClaimHeader, AdvanceRecord } from '../types';
import { reconcileLedger, getLedgerStatus } from '../services/ledgerEngine';

interface LedgerPanelProps {
  claim: ClaimHeader;
  advanceRecords: AdvanceRecord[];
  onVerify?: () => void;
  onAdjust?: (adjustment: number, reason: string) => void;
  isEditable?: boolean;
}

function fmt(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${Math.abs(amount).toLocaleString('en-IN', {
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

export const LedgerPanel: React.FC<LedgerPanelProps> = ({
  claim,
  advanceRecords,
  onVerify,
  onAdjust,
  isEditable = false,
}) => {
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [showAdjustForm, setShowAdjustForm] = useState(false);

  // Reconcile against claim line items — we don't have them here so pass empty array;
  // ledger engine falls back to claim.approvedAmount in that case.
  const ledger = reconcileLedger(claim, [], advanceRecords);
  const status = getLedgerStatus(claim);

  const handleAdjust = () => {
    const num = parseFloat(adjustAmount);
    if (!isNaN(num) && adjustReason.trim() && onAdjust) {
      onAdjust(num, adjustReason.trim());
      setAdjustAmount('');
      setAdjustReason('');
      setShowAdjustForm(false);
    }
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    Reconciled: {
      bg: 'var(--success-bg)',
      text: 'var(--success-text)',
      border: 'var(--success-border)',
    },
    Mismatch: {
      bg: 'var(--danger-bg)',
      text: 'var(--danger-text)',
      border: 'var(--danger-border)',
    },
    Pending: {
      bg: 'var(--warning-bg)',
      text: 'var(--warning-text)',
      border: 'var(--warning-border)',
    },
  };

  const sc = statusColors[status] ?? statusColors.Pending;

  return (
    <div className="koenig-card">
      <div className="koenig-card-header">
        <h3 className="koenig-card-title">Ledger Reconciliation</h3>
        <span
          className="koenig-badge"
          style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}
        >
          {status === 'Reconciled' && '✓ '}
          {status === 'Mismatch' && '✗ '}
          {status === 'Pending' && '⏳ '}
          {status}
        </span>
      </div>

      <div className="koenig-card-body">
        {/* Ledger waterfall */}
        <div
          style={{
            backgroundColor: 'var(--surface-muted)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            marginBottom: '1.25rem',
            border: '1px solid var(--border)',
          }}
        >
          <LedgerLine
            label="Approved Amount"
            amount={ledger.approvedAmount}
            currency={claim.currency}
            bold
          />
          <LedgerLine
            label="— Advance Adjusted"
            amount={ledger.advanceAdjusted}
            currency={claim.currency}
            sign="-"
            color="var(--accent-orange)"
          />
          <LedgerLine
            label={ledger.miscAdjustments >= 0 ? '+ Misc Adjustments' : '— Misc Adjustments'}
            amount={ledger.miscAdjustments}
            currency={claim.currency}
            sign={ledger.miscAdjustments >= 0 ? '+' : '-'}
            color={ledger.miscAdjustments >= 0 ? 'var(--success-text)' : 'var(--danger-text)'}
          />
          <LedgerLine
            label="— Recoverable Amount"
            amount={ledger.recoverableAmount}
            currency={claim.currency}
            sign="-"
            color="var(--danger-text)"
          />
          <div
            style={{
              borderTop: '2px solid var(--border-strong)',
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                = Final Settlement
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1.125rem',
                  color: ledger.isBalanced ? 'var(--success-text)' : 'var(--danger-text)',
                }}
              >
                {fmt(ledger.finalSettlement, claim.currency)}
              </span>
            </div>
            {!ledger.isBalanced && (
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--danger-text)',
                  marginTop: '0.375rem',
                }}
              >
                Discrepancy of {fmt(ledger.discrepancy, claim.currency)} vs claim net payable (
                {fmt(claim.netPayable, claim.currency)})
              </p>
            )}
          </div>
        </div>

        {/* Blockers */}
        {ledger.blockers.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <p
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--danger-text)',
                marginBottom: '0.5rem',
              }}
            >
              Blockers
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ledger.blockers.map((blocker, i) => (
                <li
                  key={i}
                  className="koenig-alert koenig-alert-danger"
                  style={{ fontSize: '0.8125rem', padding: '0.625rem 0.875rem' }}
                >
                  <span style={{ flexShrink: 0 }}>✗</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {isEditable && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: showAdjustForm ? '1rem' : 0 }}>
            {status === 'Reconciled' && onVerify && (
              <button
                className="koenig-btn koenig-btn-primary koenig-btn-sm"
                onClick={onVerify}
              >
                ✓ Mark Verified
              </button>
            )}
            {onAdjust && (
              <button
                className="koenig-btn koenig-btn-secondary koenig-btn-sm"
                onClick={() => setShowAdjustForm((v) => !v)}
              >
                {showAdjustForm ? 'Cancel' : '± Add Adjustment'}
              </button>
            )}
          </div>
        )}

        {showAdjustForm && isEditable && onAdjust && (
          <div
            style={{
              backgroundColor: 'var(--surface-muted)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              border: '1px solid var(--border)',
              marginTop: '0.75rem',
            }}
          >
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Add Miscellaneous Adjustment
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="koenig-label" htmlFor="adj-amount">
                  Amount (positive = credit, negative = deduction)
                </label>
                <input
                  id="adj-amount"
                  type="number"
                  className="koenig-input"
                  placeholder="e.g. -500 or 200"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="koenig-label" htmlFor="adj-reason">
                  Reason
                </label>
                <input
                  id="adj-reason"
                  type="text"
                  className="koenig-input"
                  placeholder="Reason for adjustment"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              <button
                className="koenig-btn koenig-btn-primary koenig-btn-sm"
                onClick={handleAdjust}
                disabled={!adjustAmount || !adjustReason.trim()}
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Advance records table */}
      {advanceRecords.length > 0 && (
        <>
          <div style={{ padding: '0 1.5rem', borderBottom: '1px solid var(--border-muted)' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', paddingBottom: '0.75rem' }}>
              Advance Records
            </p>
          </div>
          <div
            className="koenig-table-wrapper"
            style={{ borderRadius: 0, border: 'none' }}
          >
            <table className="koenig-table">
              <thead>
                <tr>
                  <th>Advance ID</th>
                  <th>Purpose</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Adjusted</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {advanceRecords.map((rec) => (
                  <tr key={rec.advanceId}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {rec.advanceId}
                    </td>
                    <td>{rec.purpose}</td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {fmtDate(rec.date)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {fmt(rec.amount, claim.currency)}
                    </td>
                    <td style={{ textAlign: 'right', color: rec.adjustedAmount ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
                      {rec.adjustedAmount ? fmt(rec.adjustedAmount, claim.currency) : '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: rec.balance === 0
                          ? 'var(--success-text)'
                          : rec.balance > 0
                          ? 'var(--danger-text)'
                          : 'var(--text-primary)',
                      }}
                    >
                      {fmt(rec.balance, claim.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ── Internal sub-component ──────────────────────────────────────────────────

interface LedgerLineProps {
  label: string;
  amount: number;
  currency: string;
  sign?: '+' | '-';
  bold?: boolean;
  color?: string;
}

const LedgerLine: React.FC<LedgerLineProps> = ({ label, amount, currency, sign, bold, color }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '0.5rem',
      marginBottom: '0.5rem',
      borderBottom: '1px solid var(--border-muted)',
    }}
  >
    <span
      style={{
        fontSize: bold ? '0.9375rem' : '0.875rem',
        fontWeight: bold ? 700 : 500,
        color: color ?? 'var(--text-primary)',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: bold ? '0.9375rem' : '0.875rem',
        fontWeight: bold ? 700 : 500,
        color: color ?? 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {sign === '-' ? '- ' : sign === '+' ? '+ ' : ''}
      {fmt(amount, currency)}
    </span>
  </div>
);

export default LedgerPanel;

