import { useMemo } from 'react';
import type { HotelStay } from '../types';
import { formatINR, formatDate } from '../services/calculationEngine';

interface LodgingStaybackPanelProps {
  hotelStays: HotelStay[];
  policyLimit: number;
}

type StayClassification = 'personal-stayback' | 'company-paid' | 'eligible' | 'over-limit';

function classifyStay(stay: HotelStay, policyLimit: number): StayClassification {
  if (stay.stayType === 'Not Applicable') return 'personal-stayback';
  if (stay.stayType === 'Company Provided') return 'company-paid';
  if (stay.amountPerNight > policyLimit) return 'over-limit';
  return 'eligible';
}

function getRowClass(classification: StayClassification): string {
  switch (classification) {
    case 'personal-stayback':
      return 'bg-orange-50 border-l-4 border-orange-400';
    case 'company-paid':
      return 'bg-red-50 border-l-4 border-red-400';
    case 'over-limit':
      return 'bg-yellow-50 border-l-4 border-yellow-400';
    default:
      return '';
  }
}

function computeEligible(stay: HotelStay, policyLimit: number): number {
  const classification = classifyStay(stay, policyLimit);
  if (classification === 'personal-stayback' || classification === 'company-paid') return 0;
  const eligiblePerNight = Math.min(stay.amountPerNight, policyLimit);
  return eligiblePerNight * stay.nights;
}

function computeDeduction(stay: HotelStay, policyLimit: number): number {
  return stay.totalAmount - computeEligible(stay, policyLimit);
}

function computeRecoverable(stay: HotelStay, policyLimit: number): number {
  const classification = classifyStay(stay, policyLimit);
  if (classification === 'company-paid') return stay.totalAmount;
  return 0;
}

const LodgingStaybackPanel: React.FC<LodgingStaybackPanelProps> = ({
  hotelStays,
  policyLimit,
}) => {
  const summary = useMemo(() => {
    const totalClaimed = hotelStays.reduce((s, h) => s + h.totalAmount, 0);
    const totalEligible = hotelStays.reduce((s, h) => s + computeEligible(h, policyLimit), 0);
    const totalDeduction = hotelStays.reduce((s, h) => s + computeDeduction(h, policyLimit), 0);
    const totalRecoverable = hotelStays.reduce((s, h) => s + computeRecoverable(h, policyLimit), 0);
    return { totalClaimed, totalEligible, totalDeduction, totalRecoverable };
  }, [hotelStays, policyLimit]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
          Lodging / Hotel Stays
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
          </svg>
          Policy limit: <span className="font-semibold text-blue-700">{formatINR(policyLimit)} / night</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
          Personal stayback (non-payable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300"></span>
          Company-paid (recoverable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
          Exceeds policy limit
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Hotel Name</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">City</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Check-in</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Check-out</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Nights</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Per Night (₹)</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Total (₹)</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Stay Type</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Invoice No</th>
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Receipt</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Eligible (₹)</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Deduction (₹)</th>
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Recoverable (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hotelStays.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-400 italic">
                  No lodging records found.
                </td>
              </tr>
            )}
            {hotelStays.map((stay) => {
              const classification = classifyStay(stay, policyLimit);
              const eligible = computeEligible(stay, policyLimit);
              const deduction = computeDeduction(stay, policyLimit);
              const recoverable = computeRecoverable(stay, policyLimit);

              return (
                <tr
                  key={stay.stayId}
                  className={`transition-colors ${getRowClass(classification)} hover:brightness-95`}
                >
                  <td className="px-3 py-2 text-gray-800 font-medium max-w-[140px] truncate" title={stay.hotelName}>
                    {stay.hotelName}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{stay.city}</td>
                  <td className="px-3 py-2 text-gray-700 font-mono whitespace-nowrap">{formatDate(stay.checkIn)}</td>
                  <td className="px-3 py-2 text-gray-700 font-mono whitespace-nowrap">{formatDate(stay.checkOut)}</td>
                  <td className="px-3 py-2 text-center text-gray-700">{stay.nights}</td>
                  <td className={`px-3 py-2 text-right font-mono ${stay.amountPerNight > policyLimit ? 'text-amber-600 font-semibold' : 'text-gray-700'}`}>
                    {formatINR(stay.amountPerNight)}
                    {stay.amountPerNight > policyLimit && (
                      <span className="ml-1 text-amber-500" title={`Exceeds policy limit of ${formatINR(policyLimit)}`}>▲</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">{formatINR(stay.totalAmount)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      classification === 'personal-stayback'
                        ? 'bg-orange-100 text-orange-700'
                        : classification === 'company-paid'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {stay.stayType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">
                    {stay.invoiceNo ?? <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {stay.receiptUploaded ? (
                      <span className="text-green-600 font-bold" title="Receipt uploaded">✓</span>
                    ) : (
                      <span className="text-red-500 font-bold" title="Receipt missing">✗</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${eligible === 0 ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                    {formatINR(eligible)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${deduction > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                    {deduction > 0 ? formatINR(deduction) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${recoverable > 0 ? 'text-red-700 font-bold' : 'text-gray-400'}`}>
                    {recoverable > 0 ? formatINR(recoverable) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer summary */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300 text-xs">
              <td colSpan={6} className="px-3 py-2.5 text-gray-500 font-medium">
                Totals
              </td>
              <td className="px-3 py-2.5 text-right font-semibold font-mono text-gray-800">
                {formatINR(summary.totalClaimed)}
              </td>
              <td colSpan={3}></td>
              <td className="px-3 py-2.5 text-right font-bold font-mono text-gray-800">
                {formatINR(summary.totalEligible)}
              </td>
              <td className="px-3 py-2.5 text-right font-bold font-mono text-red-600">
                {summary.totalDeduction > 0 ? formatINR(summary.totalDeduction) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right font-bold font-mono text-red-700">
                {summary.totalRecoverable > 0 ? formatINR(summary.totalRecoverable) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-gray-50 border-t border-gray-200">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Total Claimed</p>
          <p className="text-base font-bold font-mono text-gray-800">{formatINR(summary.totalClaimed)}</p>
        </div>
        <div className="bg-white rounded-lg border border-green-200 px-4 py-3">
          <p className="text-xs text-green-600 mb-0.5">Eligible Lodging</p>
          <p className="text-base font-bold font-mono text-green-700">{formatINR(summary.totalEligible)}</p>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 px-4 py-3">
          <p className="text-xs text-amber-600 mb-0.5">Total Deduction</p>
          <p className="text-base font-bold font-mono text-amber-700">{formatINR(summary.totalDeduction)}</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 px-4 py-3">
          <p className="text-xs text-red-600 mb-0.5">Recoverable</p>
          <p className="text-base font-bold font-mono text-red-700">{formatINR(summary.totalRecoverable)}</p>
        </div>
      </div>
    </div>
  );
};

export default LodgingStaybackPanel;

