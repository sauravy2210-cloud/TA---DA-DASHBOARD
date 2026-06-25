import React from 'react';
import type { ClaimLineItem, PolicyRule } from '../types';

interface PolicyComparisonProps {
  lineItems: ClaimLineItem[];
  policies: PolicyRule[];
}

function fmt(amount: number, currency = 'INR'): string {
  return `${currency === 'INR' ? '₹' : currency + ' '}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function findPolicy(item: ClaimLineItem, policies: PolicyRule[]): PolicyRule | undefined {
  return policies.find(
    (p) =>
      p.active &&
      p.expenseType.toLowerCase() === item.expenseType.toLowerCase(),
  );
}

export const PolicyComparison: React.FC<PolicyComparisonProps> = ({ lineItems, policies }) => {
  const anyException = lineItems.some((item) => item.exceptionRequired);

  // Collect unique policy versions shown
  const usedPolicies = lineItems
    .map((item) => findPolicy(item, policies))
    .filter((p): p is PolicyRule => p !== undefined);

  const uniquePolicies = Array.from(
    new Map(usedPolicies.map((p) => [p.ruleId, p])).values(),
  );

  return (
    <div className="koenig-card">
      <div className="koenig-card-header">
        <h3 className="koenig-card-title">Policy Comparison</h3>
        {anyException && (
          <span
            className="koenig-badge"
            style={{
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning-text)',
              borderColor: 'var(--warning-border)',
            }}
          >
            ⚠ Exception Required
          </span>
        )}
      </div>

      <div className="koenig-table-wrapper" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
        <table className="koenig-table">
          <thead>
            <tr>
              <th>Expense Type</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Claimed</th>
              <th style={{ textAlign: 'right' }}>Policy Limit</th>
              <th style={{ textAlign: 'right' }}>Eligible</th>
              <th style={{ textAlign: 'right' }}>Deduction</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Exception</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => {
              const policy = findPolicy(item, policies);
              const limit = item.policyLimit > 0 ? item.policyLimit : (policy?.maxAmount ?? 0);
              const exceeds = limit > 0 && item.claimedAmount > limit;

              const rowStyle: React.CSSProperties = exceeds
                ? { backgroundColor: 'var(--accent-amber-bg)' }
                : {};

              return (
                <tr key={item.lineItemId} style={rowStyle}>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--accent-blue-bg)',
                        color: 'var(--accent-blue)',
                        border: '1px solid var(--accent-blue-border)',
                      }}
                    >
                      {item.expenseType}
                      {item.expenseSubType ? ` / ${item.expenseSubType}` : ''}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: '200px' }}>
                    <span className="koenig-truncate" style={{ display: 'block', maxWidth: '200px' }}>
                      {item.description}
                    </span>
                    {item.date && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.date}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {fmt(item.claimedAmount, item.currency)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {limit > 0 ? fmt(limit, item.currency) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No cap</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--success-text)', fontWeight: 500 }}>
                    {fmt(item.eligibleAmount, item.currency)}
                  </td>
                  <td style={{ textAlign: 'right', color: item.deductionAmount > 0 ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                    {item.deductionAmount > 0 ? `-${fmt(item.deductionAmount, item.currency)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {exceeds ? (
                      <span
                        className="koenig-badge"
                        style={{
                          backgroundColor: 'var(--accent-amber-bg)',
                          color: 'var(--accent-amber)',
                          borderColor: 'var(--accent-amber-border)',
                        }}
                      >
                        Exceeds
                      </span>
                    ) : (
                      <span
                        className="koenig-badge"
                        style={{
                          backgroundColor: 'var(--success-bg)',
                          color: 'var(--success-text)',
                          borderColor: 'var(--success-border)',
                        }}
                      >
                        Within
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.exceptionRequired ? (
                      <span
                        className="koenig-badge"
                        style={{
                          backgroundColor: 'var(--warning-bg)',
                          color: 'var(--warning-text)',
                          borderColor: 'var(--warning-border)',
                        }}
                      >
                        Required
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Policy version footer */}
      <div className="koenig-card-footer">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Applicable Policies:
          </span>
          {uniquePolicies.length === 0 ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No policy data linked</span>
          ) : (
            uniquePolicies.map((p) => (
              <span
                key={p.ruleId}
                style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
              >
                <strong>{p.expenseType}</strong> — v{p.version} &nbsp;|&nbsp; Effective:{' '}
                {p.effectiveFrom}
                {p.effectiveTo ? ` to ${p.effectiveTo}` : ' (current)'}
                &nbsp;|&nbsp; Limit: {fmt(p.maxAmount, p.currency)} per {p.unit}
                &nbsp;|&nbsp; Changed by {p.changedBy} on {p.changedOn}
              </span>
            ))
          )}
        </div>
        {anyException && (
          <div
            className="koenig-alert koenig-alert-warning"
            style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }}
          >
            <span>⚠</span>
            <span>
              One or more line items exceed the policy limit by more than the 20% tolerance
              threshold and require Finance exception sign-off before the claim can proceed.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PolicyComparison;


