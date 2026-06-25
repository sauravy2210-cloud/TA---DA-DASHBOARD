import React from 'react';
import { AlertTriangle, FileX, Copy, Clock, BookOpen, DollarSign } from 'lucide-react';
import type { ClaimStatus, PendingWith } from '../types';

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

type BadgeSize = 'sm' | 'md';

interface StatusBadgeProps {
  status: ClaimStatus | string;
  size?: BadgeSize;
}

interface StatusStyle {
  dot: string;
  pill: string;
  label: string;
}

const statusStyles: Record<string, StatusStyle> = {
  'Draft':                { dot: 'bg-gray-400',   pill: 'bg-gray-100 text-gray-600 border-gray-200',       label: 'Draft'                },
  'Submitted':            { dot: 'bg-blue-500',   pill: 'bg-blue-50 text-blue-700 border-blue-200',         label: 'Submitted'            },
  'Under Review':         { dot: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',   label: 'Under Review'         },
  'Clarification Required': { dot: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Clarification Required' },
  'Resubmitted':          { dot: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 border-purple-200',   label: 'Resubmitted'          },
  'Approved':             { dot: 'bg-green-500',  pill: 'bg-green-50 text-green-700 border-green-200',       label: 'Approved'             },
  'Partially Approved':   { dot: 'bg-teal-500',   pill: 'bg-teal-50 text-teal-700 border-teal-200',         label: 'Partially Approved'   },
  'Rejected':             { dot: 'bg-red-500',    pill: 'bg-red-50 text-red-700 border-red-200',             label: 'Rejected'             },
  'On Hold':              { dot: 'bg-yellow-500', pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',   label: 'On Hold'              },
  'Payment Pending':      { dot: 'bg-amber-500',  pill: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Payment Pending'      },
  'Paid':                 { dot: 'bg-emerald-500',pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid'                 },
  'Cancelled':            { dot: 'bg-slate-400',  pill: 'bg-slate-100 text-slate-600 border-slate-200',     label: 'Cancelled'            },
  'Reopened':             { dot: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700 border-violet-200',   label: 'Reopened'             },
};

const fallbackStyle: StatusStyle = {
  dot: 'bg-gray-400',
  pill: 'bg-gray-100 text-gray-600 border-gray-200',
  label: '',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = statusStyles[status] ?? fallbackStyle;
  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5 gap-1.5'
    : 'text-xs px-2.5 py-1 gap-2';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClasses} ${style.pill}`}>
      <span className={`${dotSize} rounded-full flex-shrink-0 ${style.dot}`} />
      {style.label || status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PendingWithBadge
// ---------------------------------------------------------------------------

interface PendingWithBadgeProps {
  pendingWith: PendingWith;
}

const pendingStyles: Record<string, string> = {
  'Trainer':  'bg-blue-50 text-blue-700 border-blue-200',
  'HR/Admin': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Finance':  'bg-green-50 text-green-700 border-green-200',
  'Approver': 'bg-purple-50 text-purple-700 border-purple-200',
  'None':     'bg-gray-50 text-gray-500 border-gray-200',
};

export function PendingWithBadge({ pendingWith }: PendingWithBadgeProps) {
  const style = pendingStyles[pendingWith] ?? 'bg-gray-50 text-gray-500 border-gray-200';
  if (pendingWith === 'None') return null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Pending with</span>
      {pendingWith}
    </span>
  );
}

// ---------------------------------------------------------------------------
// RiskFlagBadge
// ---------------------------------------------------------------------------

type RiskFlagType = 'exception' | 'missing-doc' | 'duplicate' | 'sla' | 'ledger' | 'high-value';

interface RiskFlagBadgeProps {
  type: RiskFlagType;
  label?: string;
}

const riskConfig: Record<RiskFlagType, { icon: React.ElementType; style: string; defaultLabel: string }> = {
  'exception':   { icon: AlertTriangle, style: 'bg-orange-50 text-orange-700 border-orange-300', defaultLabel: 'Policy Exception' },
  'missing-doc': { icon: FileX,         style: 'bg-red-50 text-red-700 border-red-300',           defaultLabel: 'Missing Docs'      },
  'duplicate':   { icon: Copy,          style: 'bg-yellow-50 text-yellow-700 border-yellow-300',  defaultLabel: 'Duplicate'         },
  'sla':         { icon: Clock,         style: 'bg-amber-50 text-amber-700 border-amber-300',     defaultLabel: 'SLA Breach'        },
  'ledger':      { icon: BookOpen,      style: 'bg-purple-50 text-purple-700 border-purple-300',  defaultLabel: 'Ledger Mismatch'   },
  'high-value':  { icon: DollarSign,    style: 'bg-rose-50 text-rose-700 border-rose-300',        defaultLabel: 'High Value'        },
};

export function RiskFlagBadge({ type, label }: RiskFlagBadgeProps) {
  const config = riskConfig[type];
  const FlagIcon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.style}`}>
      <FlagIcon className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
      {label ?? config.defaultLabel}
    </span>
  );
}

