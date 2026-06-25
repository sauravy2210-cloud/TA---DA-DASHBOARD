import { useState } from 'react';
import type { ReactNode, ChangeEvent, FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  Eye,
  EyeOff,
  IndianRupee,
  Calendar,
  Hash,
  Banknote,
  MessageSquare,
  Send,
} from 'lucide-react';
import type { ClaimHeader, PaymentRecord, UserRole, PaymentStatus } from '../types';

interface PaymentStatusPanelProps {
  claim: ClaimHeader;
  payment?: PaymentRecord;
  userRole: UserRole;
  onMarkPaid?: (data: Partial<PaymentRecord>) => void;
}

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; icon: ReactNode }
> = {
  Unpaid: {
    label: 'Unpaid',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  Processed: {
    label: 'Processed',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    icon: <Clock className="w-4 h-4" />,
  },
  Paid: {
    label: 'Paid',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
};

const PAYMENT_MODES = ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'Cash', 'UPI'];

export default function PaymentStatusPanel({
  claim,
  payment,
  userRole,
  onMarkPaid,
}: PaymentStatusPanelProps) {
  const status = claim.paymentStatus;
  const cfg = STATUS_CONFIG[status];
  const isFinanceRole = userRole === 'Finance' || userRole === 'HRAdmin' || userRole === 'SuperAdmin';
  const canMarkPaid =
    (userRole === 'HRAdmin' || userRole === 'Finance' || userRole === 'SuperAdmin') &&
    (status === 'Unpaid' || status === 'Processed');
  const showBankDetails = userRole === 'Finance' || userRole === 'SuperAdmin';
  const [showAccount, setShowAccount] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  const [formData, setFormData] = useState<{
    paymentDate: string;
    referenceUTR: string;
    paymentMode: string;
    paidAmount: string;
    financeRemarks: string;
  }>({
    paymentDate: new Date().toISOString().split('T')[0],
    referenceUTR: '',
    paymentMode: 'NEFT',
    paidAmount: String(claim.netPayable),
    financeRemarks: '',
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!onMarkPaid) return;
    onMarkPaid({
      claimId: claim.claimId,
      paymentDate: formData.paymentDate,
      referenceUTR: formData.referenceUTR,
      paymentMode: formData.paymentMode,
      paidAmount: parseFloat(formData.paidAmount) || 0,
      financeRemarks: formData.financeRemarks,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-800 text-sm">Payment Status</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}
        >
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {/* Net Payable */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
          Net Payable
        </p>
        <div className="flex items-end gap-1.5">
          <IndianRupee className="w-6 h-6 text-gray-700 mb-0.5" />
          <span className="text-3xl font-bold text-gray-900">
            {claim.netPayable.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="text-sm text-gray-400 mb-1">{claim.currency}</span>
        </div>
        {claim.advanceAdjusted > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Includes advance adjustment of ₹
            {claim.advanceAdjusted.toLocaleString('en-IN')}
          </p>
        )}
      </div>

      {/* Payment Details (if paid) */}
      {status === 'Paid' && payment && (
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Payment Details
          </p>

          <DetailRow icon={<Calendar className="w-4 h-4 text-gray-400" />} label="Payment Date">
            {new Date(payment.paymentDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </DetailRow>

          <DetailRow icon={<Hash className="w-4 h-4 text-gray-400" />} label="Reference / UTR">
            <span className="font-mono text-sm">{payment.referenceUTR}</span>
          </DetailRow>

          <DetailRow icon={<Banknote className="w-4 h-4 text-gray-400" />} label="Mode">
            {payment.paymentMode}
          </DetailRow>

          <DetailRow icon={<IndianRupee className="w-4 h-4 text-gray-400" />} label="Paid Amount">
            ₹{payment.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </DetailRow>

          {payment.financeRemarks && isFinanceRole && (
            <DetailRow
              icon={<MessageSquare className="w-4 h-4 text-gray-400" />}
              label="Finance Remarks"
            >
              <span className="italic text-gray-600">{payment.financeRemarks}</span>
            </DetailRow>
          )}
        </div>
      )}

      {/* Bank details come from trainer profile; show masked for non-finance */}
      {isFinanceRole && (
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Bank Account
            </p>
            {showBankDetails && (
              <button
                type="button"
                onClick={() => setShowAccount((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                {showAccount ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {showAccount ? 'Hide' : 'Reveal'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 italic">
            {showBankDetails
              ? showAccount
                ? 'Account details visible'
                : 'Account details masked — click Reveal'
              : 'Account number masked for your role'}
          </p>
          {/* Placeholder — real bank details would come from TrainerProfile */}
          <p className="text-sm font-mono mt-1 text-gray-700">
            {showBankDetails && showAccount ? '— Full details from trainer profile —' : '•••• •••• 4521'}
          </p>
        </div>
      )}

      {/* Mark as Paid CTA */}
      {canMarkPaid && (
        <div className="px-5 py-4">
          {!formVisible ? (
            <button
              type="button"
              onClick={() => setFormVisible(true)}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold transition-colors"
            >
              Mark as Paid
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm font-semibold text-gray-700">Record Payment</p>

              <FormField label="Payment Date" required>
                <input
                  type="date"
                  name="paymentDate"
                  required
                  value={formData.paymentDate}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Reference / UTR No." required>
                <input
                  type="text"
                  name="referenceUTR"
                  required
                  placeholder="e.g. HDFC0000123456"
                  value={formData.referenceUTR}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Payment Mode" required>
                <select
                  name="paymentMode"
                  required
                  value={formData.paymentMode}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Paid Amount (₹)" required>
                <input
                  type="number"
                  name="paidAmount"
                  required
                  min="0"
                  step="0.01"
                  value={formData.paidAmount}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Finance Remarks">
                <textarea
                  name="financeRemarks"
                  rows={2}
                  placeholder="Optional internal note"
                  value={formData.financeRemarks}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </FormField>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormVisible(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Mark as Paid
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{children}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

