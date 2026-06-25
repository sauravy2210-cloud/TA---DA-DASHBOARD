import React, { useMemo } from 'react';
import type { DARecord } from '../types';
import { formatINR, formatDate } from '../services/calculationEngine';

interface DADayBreakdownProps {
  daRecords: DARecord[];
  totalDA: number;
  showPolicyColumn?: boolean;
  editable?: boolean;
}

function getRowClass(record: DARecord): string {
  if (record.isLeaveDay) return 'bg-orange-50 border-l-4 border-orange-400';
  if (!record.fullDayEligible && record.eligibleAmount === 0)
    return 'bg-red-50 border-l-4 border-red-400';
  return '';
}

function exportToCSV(records: DARecord[]): void {
  const headers = [
    'Date',
    'City',
    'Country',
    'Category (Tier)',
    'Rate',
    'Day Type',
    'Partial Reason',
    'Leave Day',
    'Personal Stayback',
    'Duplicate',
    'Eligible Amount',
  ];

  const rows = records.map((r) => [
    r.date,
    r.city,
    r.country,
    r.cityTier,
    r.rateApplicable,
    r.fullDayEligible ? 'Full Day' : r.eligibleAmount > 0 ? 'Half Day' : 'Excluded',
    r.partialDayReason ?? '',
    r.isLeaveDay ? 'Yes' : 'No',
    r.isPersonalStayback ? 'Yes' : 'No',
    r.isDuplicate ? 'Yes' : 'No',
    r.eligibleAmount,
  ]);

  const csvContent =
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'da_day_breakdown.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const DADayBreakdown: React.FC<DADayBreakdownProps> = ({
  daRecords,
  totalDA,
  showPolicyColumn = false,
  editable: _editable = false,
}) => {
  const stats = useMemo(() => {
    const excludedDays = daRecords.filter((r) => r.eligibleAmount === 0).length;
    const leaveDays = daRecords.filter((r) => r.isLeaveDay).length;
    const eligibleTotal = daRecords.reduce((sum, r) => sum + r.eligibleAmount, 0);
    return { excludedDays, leaveDays, eligibleTotal };
  }, [daRecords]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
          DA Day-wise Breakdown
        </h3>
        <button
          onClick={() => exportToCSV(daRecords)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300"></span>
          Excluded day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
          Leave day
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Date</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">City / Country</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Category</th>
              {showPolicyColumn && (
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Rate (₹)</th>
              )}
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Rate (₹)</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Day Type</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Reason</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Leave?</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Stayback?</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Duplicate?</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Eligible (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {daRecords.length === 0 && (
              <tr>
                <td colSpan={showPolicyColumn ? 12 : 11} className="px-4 py-8 text-center text-gray-400 italic">
                  No DA records found.
                </td>
              </tr>
            )}
            {daRecords.map((record, idx) => {
              const isExcluded = record.eligibleAmount === 0;
              const dayType = record.fullDayEligible
                ? 'Full Day'
                : record.eligibleAmount > 0
                ? 'Half Day'
                : 'Excluded';

              return (
                <tr
                  key={`${record.date}-${idx}`}
                  className={`transition-colors ${getRowClass(record)} hover:brightness-95`}
                >
                  <td className="px-3 py-2 text-gray-700 font-mono whitespace-nowrap">
                    {formatDate(record.date)}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {record.city}
                    {record.country && record.country !== 'India' && (
                      <span className="ml-1 text-gray-400">/ {record.country}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      record.cityTier === 'Metro'
                        ? 'bg-purple-100 text-purple-700'
                        : record.cityTier === 'Tier1'
                        ? 'bg-blue-100 text-blue-700'
                        : record.cityTier === 'International'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {record.cityTier}
                    </span>
                  </td>
                  {showPolicyColumn && (
                    <td className="px-3 py-2 text-right text-gray-500">
                      {formatINR(record.rateApplicable)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right text-gray-700 font-mono">
                    {formatINR(record.rateApplicable)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      dayType === 'Full Day'
                        ? 'bg-green-100 text-green-700'
                        : dayType === 'Half Day'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {dayType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate" title={record.partialDayReason ?? record.notes ?? ''}>
                    {record.partialDayReason ?? record.notes ?? (isExcluded ? '—' : '')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {record.isLeaveDay ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold" title="Leave day — DA not payable">
                        L
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {record.isPersonalStayback ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold" title="Personal stayback — DA not payable">
                        S
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {record.isDuplicate ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold" title="Duplicate record">
                        D
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold font-mono ${
                    isExcluded ? 'text-red-500 line-through' : 'text-gray-800'
                  }`}>
                    {formatINR(record.eligibleAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td
                colSpan={showPolicyColumn ? 10 : 10}
                className="px-3 py-2.5 text-xs text-gray-600"
              >
                <span className="font-semibold">Total DA (claimed): </span>
                <span className="font-mono">{formatINR(totalDA)}</span>
                <span className="mx-3 text-gray-300">|</span>
                <span className="text-red-600 font-medium">
                  {stats.excludedDays} day{stats.excludedDays !== 1 ? 's' : ''} excluded
                </span>
                <span className="mx-3 text-gray-300">|</span>
                <span className="text-orange-600 font-medium">
                  {stats.leaveDays} leave day{stats.leaveDays !== 1 ? 's' : ''} deducted
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-800 font-mono text-sm">
                {formatINR(stats.eligibleTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default DADayBreakdown;

