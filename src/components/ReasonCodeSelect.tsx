import React from 'react';

const REASON_CODE_OPTIONS = [
  'Missing ticket',
  'Missing boarding pass',
  'Missing hotel invoice',
  'Missing cab receipt',
  'Attachment not opening',
  'Attachment date mismatch',
  'Attachment amount mismatch',
  'Attachment currency mismatch',
  'Travel date mismatch',
  'Journey route discontinuity',
  'Duplicate claim',
  'Duplicate invoice',
  'Duplicate PNR/ticket',
  'Amount exceeds policy',
  'Wrong batch selected',
  'DA not applicable',
  'Duplicate DA date',
  'DA claimed for leave day',
  'DA claimed for personal stay-back',
  'Local conveyance proof missing',
  'Route/from-to missing',
  'Cab timing mismatch',
  'Cab route mismatch',
  'Advance not adjusted',
  'GST invoice issue',
  'Manager approval required',
  'Personal stay-back hotel recovery',
  'Claim outside allowed period',
  'Ledger mismatch',
  'Other',
];

interface ReasonCodeSelectProps {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}

const ReasonCodeSelect: React.FC<ReasonCodeSelectProps> = ({
  value,
  onChange,
  required = false,
  placeholder = 'Select reason code...',
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={[
        'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        'transition-colors duration-150',
        value
          ? 'border-gray-300 bg-white text-gray-900'
          : 'border-gray-300 bg-white text-gray-400',
      ].join(' ')}
    >
      <option value="" disabled hidden>
        {placeholder}
      </option>
      {REASON_CODE_OPTIONS.map((code) => (
        <option key={code} value={code} className="text-gray-900">
          {code}
        </option>
      ))}
    </select>
  );
};

export default ReasonCodeSelect;

