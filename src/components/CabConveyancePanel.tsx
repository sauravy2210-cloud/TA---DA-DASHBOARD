import { useMemo } from 'react';
import type { FC } from 'react';
import type { CabRecord } from '../types';
import { formatINR, formatDate } from '../services/calculationEngine';

interface CabConveyancePanelProps {
  cabRecords: CabRecord[];
  policyLimit: number;
  assignmentDates: string[];
}

function isWithinAssignment(date: string, assignmentDates: string[]): boolean {
  return assignmentDates.includes(date);
}

const CabConveyancePanel: FC<CabConveyancePanelProps> = ({
  cabRecords,
  policyLimit,
  assignmentDates,
}) => {
  const summary = useMemo(() => {
    const totalClaimed = cabRecords.reduce((s, r) => s + r.amount, 0);
    const totalEligible = cabRecords
      .filter((r) => r.isEligible)
      .reduce((s, r) => s + r.amount, 0);
    const totalDeduction = totalClaimed - totalEligible;
    return { totalClaimed, totalEligible, totalDeduction };
  }, [cabRecords]);

  const recordsEnrichedByDay = useMemo(() => {
    // Per-day cumulative eligible amount to flag daily cap breaches
    const dayRunning = new Map<string, number>();
    return cabRecords.map((rec) => {
      const withinAssignment = isWithinAssignment(rec.date, assignmentDates);
      const prevTotal = dayRunning.get(rec.date) ?? 0;
      const exceedsDayCap =
        rec.isEligible && policyLimit > 0 && prevTotal + rec.amount > policyLimit;
      if (rec.isEligible) {
        dayRunning.set(rec.date, prevTotal + rec.amount);
      }
      return { ...rec, withinAssignment, exceedsDayCap };
    });
  }, [cabRecords, assignmentDates, policyLimit]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
          Cab / Conveyance
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
          </svg>
          Policy limit:{' '}
          <span className="font-semibold text-blue-700">
            {policyLimit > 0 ? `${formatINR(policyLimit)} / day` : 'No cap'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300"></span>
          Not eligible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300"></span>
          Outside assignment dates
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Date</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">From</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">To</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Purpose</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Amount (₹)</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Receipt</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Eligible (₹)</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Reason (if not eligible)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recordsEnrichedByDay.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">
                  No cab / conveyance records found.
                </td>
              </tr>
            )}
            {recordsEnrichedByDay.map((rec) => {
              const rowBg = !rec.isEligible
                ? 'bg-red-50 border-l-4 border-red-400'
                : !rec.withinAssignment
                ? 'bg-gray-50 border-l-4 border-gray-300'
                : rec.exceedsDayCap
                ? 'bg-yellow-50 border-l-4 border-yellow-400'
                : '';

              const eligibleAmount = rec.isEligible ? rec.amount : 0;

              return (
                <tr
                  key={rec.cabId}
                  className={`transition-colors ${rowBg} hover:brightness-95`}
                >
                  <td className="px-3 py-2 text-gray-700 font-mono whitespace-nowrap">
                    {formatDate(rec.date)}
                    {!rec.withinAssignment && (
                      <span
                        className="ml-1 text-gray-400 text-xs"
                        title="Outside assignment date range"
                      >
                        (ext)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-[100px] truncate" title={rec.fromLocation}>
                    {rec.fromLocation}
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-[100px] truncate" title={rec.toLocation}>
                    {rec.toLocation}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={rec.purpose}>
                    {rec.purpose}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{formatINR(rec.amount)}</td>
                  <td className="px-3 py-2 text-center">
                    {rec.receiptUploaded ? (
                      <span className="text-green-600 font-bold" title="Receipt uploaded">✓</span>
                    ) : (
                      <span className="text-red-500 font-bold" title="Receipt missing">✗</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${!rec.isEligible ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                    {formatINR(eligibleAmount)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={rec.reasonIfIneligible ?? ''}>
                    {!rec.isEligible
                      ? rec.reasonIfIneligible ?? 'Not eligible'
                      : rec.exceedsDayCap
                      ? `Daily cap ${formatINR(policyLimit)} reached`
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300 text-xs">
              <td colSpan={4} className="px-3 py-2.5 text-gray-500 font-medium">Totals</td>
              <td className="px-3 py-2.5 text-right font-semibold font-mono text-gray-800">
                {formatINR(summary.totalClaimed)}
              </td>
              <td></td>
              <td className="px-3 py-2.5 text-right font-bold font-mono text-gray-800">
                {formatINR(summary.totalEligible)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 px-5 py-4 bg-gray-50 border-t border-gray-200">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Total Claimed</p>
          <p className="text-base font-bold font-mono text-gray-800">{formatINR(summary.totalClaimed)}</p>
        </div>
        <div className="bg-white rounded-lg border border-green-200 px-4 py-3">
          <p className="text-xs text-green-600 mb-0.5">Eligible</p>
          <p className="text-base font-bold font-mono text-green-700">{formatINR(summary.totalEligible)}</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 px-4 py-3">
          <p className="text-xs text-red-600 mb-0.5">Deduction</p>
          <p className="text-base font-bold font-mono text-red-700">{formatINR(summary.totalDeduction)}</p>
        </div>
      </div>
    </div>
  );
};

export default CabConveyancePanel;

