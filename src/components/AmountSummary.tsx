import { formatINR } from '../services/calculationEngine';

interface AmountSummaryProps {
  claimedAmount: number;
  eligibleAmount: number;
  approvedAmount: number;
  deductionAmount: number;
  advanceAdjusted: number;
  miscAdjustments: number;
  recoverableAmount: number;
  netPayable: number;
  currency?: string;
}

interface RowProps {
  label: string;
  amount: number;
  bold?: boolean;
  muted?: boolean;
  negative?: boolean;
}

function AmountRow({ label, amount, bold = false, muted = false, negative = false }: RowProps) {
  const labelClass = muted ? 'text-gray-400' : bold ? 'text-gray-800 font-semibold' : 'text-gray-600';
  const amountClass = bold
    ? amount < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'
    : negative
    ? 'text-red-500 font-medium'
    : muted
    ? 'text-gray-400'
    : 'text-gray-800 font-medium';

  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <span className={`text-sm tabular-nums ${amountClass}`}>
        {negative && amount > 0 ? `(${formatINR(amount)})` : formatINR(amount)}
      </span>
    </div>
  );
}

function Separator() {
  return <div className="border-t border-gray-100 my-1" />;
}

function SectionSeparator() {
  return <div className="border-t border-gray-200 my-2" />;
}

export default function AmountSummary({
  claimedAmount,
  eligibleAmount,
  approvedAmount,
  deductionAmount,
  advanceAdjusted,
  miscAdjustments,
  recoverableAmount,
  netPayable,
  currency = 'INR',
}: AmountSummaryProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
          Amount Summary
          {currency !== 'INR' && (
            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">({currency})</span>
          )}
        </h3>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Section 1: Claim vs Eligible */}
        <AmountRow label="Total Claimed" amount={claimedAmount} />
        <AmountRow label="Eligible Amount" amount={eligibleAmount} />

        <SectionSeparator />

        {/* Section 2: Approved & Deductions */}
        <AmountRow label="Approved Amount" amount={approvedAmount} />
        <AmountRow label="Deductions" amount={deductionAmount} negative />

        <Separator />

        {/* Section 3: Adjustments */}
        <AmountRow label="Advance Adjusted" amount={advanceAdjusted} muted={advanceAdjusted === 0} negative />
        <AmountRow label="Misc. Adjustments" amount={miscAdjustments} muted={miscAdjustments === 0} negative />
        <AmountRow label="Recoverable Amount" amount={recoverableAmount} muted={recoverableAmount === 0} negative />

        <SectionSeparator />

        {/* Net Payable */}
        <div
          className={[
            'flex items-center justify-between rounded-lg px-3 py-2.5',
            netPayable >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100',
          ].join(' ')}
        >
          <span className="text-sm font-bold text-gray-800">Net Payable</span>
          <span
            className={[
              'text-base font-bold tabular-nums',
              netPayable >= 0 ? 'text-green-700' : 'text-red-600',
            ].join(' ')}
          >
            {formatINR(netPayable)}
          </span>
        </div>
      </div>
    </div>
  );
}

