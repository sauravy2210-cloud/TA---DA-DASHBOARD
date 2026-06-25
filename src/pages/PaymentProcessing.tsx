import { useState, useMemo } from 'react';
import type { User } from '../types';
import { mockClaims, mockPayments } from '../data/mockClaims';
import { exportPaymentSheet } from '../services/exportEngine';
import { logAction, ACTION_TYPES } from '../services/auditEngine';
import { notifyPaymentProcessed } from '../services/notificationEngine';
import { saveToStorage, getFromStorage } from '../services/storageService';

interface PaymentProcessingProps {
  currentUser: User;
}

type PaymentMode = 'NEFT' | 'RTGS' | 'Cheque' | 'Online';

interface MarkPaidForm {
  paymentDate: string;
  utr: string;
  paymentMode: PaymentMode;
  paidAmount: string;
  financeRemarks: string;
}

interface LocalPaymentRecord {
  paymentId: string;
  claimId: string;
  billNumber: string;
  trainerName: string;
  paidAmount: number;
  paymentDate: string;
  utrReference: string;
  paymentMode: string;
  financeRemarks: string;
  processedBy: string;
  processedAt: string;
}

const EMPTY_FORM: MarkPaidForm = {
  paymentDate: new Date().toISOString().slice(0, 10),
  utr: '',
  paymentMode: 'NEFT',
  paidAmount: '',
  financeRemarks: '',
};

function fmt(n: number | null | undefined, currency = 'INR') {
  if (n === null || n === undefined) return '—';
  if (currency === 'AED') return `AED ${n.toLocaleString('en-IN')}`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  'Paid': 'bg-green-100 text-green-700 border border-green-200',
  'Payment Pending': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Approved': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Partially Approved': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
};

export default function PaymentProcessing({ currentUser }: PaymentProcessingProps) {
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const [selectedClaim, setSelectedClaim] = useState<(typeof mockClaims)[0] | null>(null);
  const [form, setForm] = useState<MarkPaidForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<MarkPaidForm>>({});
  const [saving, setSaving] = useState(false);

  const [localPayments, setLocalPayments] = useState<LocalPaymentRecord[]>(
    () => getFromStorage<LocalPaymentRecord[]>('tada_local_payments', [])
  );

  const paymentClaims = useMemo(
    () =>
      mockClaims.filter(
        (c) =>
          c.status === 'Payment Pending' ||
          c.status === 'Paid' ||
          c.status === 'Approved' ||
          c.status === 'Partially Approved'
      ),
    []
  );

  const filtered = useMemo(() => {
    return paymentClaims.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (trainerFilter && !c.trainerName.toLowerCase().includes(trainerFilter.toLowerCase())) return false;
      if (clientFilter && !c.clientName.toLowerCase().includes(clientFilter.toLowerCase())) return false;
      if (batchFilter && !c.assignmentIds.join(' ').toLowerCase().includes(batchFilter.toLowerCase())) return false;
      if (dateFrom && c.submittedAt && c.submittedAt < dateFrom) return false;
      if (dateTo && c.submittedAt && c.submittedAt > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [paymentClaims, statusFilter, trainerFilter, clientFilter, batchFilter, dateFrom, dateTo]);

  function openModal(claim: (typeof mockClaims)[0]) {
    setSelectedClaim(claim);
    setForm({ ...EMPTY_FORM, paidAmount: String(claim.netPayable ?? claim.approvedAmount ?? '') });
    setFormErrors({});
  }

  function closeModal() {
    setSelectedClaim(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function validate(): boolean {
    const errors: Partial<MarkPaidForm> = {};
    if (!form.paymentDate) errors.paymentDate = 'Required';
    if (!form.utr.trim()) errors.utr = 'UTR / Reference is required';
    if (!form.paidAmount || isNaN(Number(form.paidAmount)) || Number(form.paidAmount) <= 0)
      errors.paidAmount = 'Enter valid amount';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (!selectedClaim || !validate()) return;
    setSaving(true);
    setTimeout(() => {
      const rec: LocalPaymentRecord = {
        paymentId: `pay_${Date.now()}`,
        claimId: selectedClaim.claimId,
        billNumber: selectedClaim.billNo,
        trainerName: selectedClaim.trainerName,
        paidAmount: Number(form.paidAmount),
        paymentDate: form.paymentDate,
        utrReference: form.utr,
        paymentMode: form.paymentMode,
        financeRemarks: form.financeRemarks,
        processedBy: currentUser.name,
        processedAt: new Date().toISOString(),
      };
      const updated = [...localPayments, rec];
      setLocalPayments(updated);
      saveToStorage('tada_local_payments', updated);

      logAction({
        claimId: selectedClaim.claimId,
        entityType: 'Payment',
        entityId: selectedClaim.billNo,
        action: ACTION_TYPES.PAYMENT_PROCESSED,
        newValue: { utr: form.utr, amount: Number(form.paidAmount), mode: form.paymentMode },
        remarks: form.financeRemarks,
        performedBy: currentUser.name,
        performedByRole: currentUser.role,
      });

      notifyPaymentProcessed(selectedClaim as any, selectedClaim.claimId, form.utr);

      setSaving(false);
      closeModal();
    }, 600);
  }

  function isPaid(claimId: string) {
    return localPayments.some((p) => p.claimId === claimId);
  }

  function getPaymentRecord(claimId: string) {
    return (
      localPayments.find((p) => p.claimId === claimId) ||
      mockPayments.find((p) => p.claimId === claimId && p.referenceUTR)
    );
  }

  function handleExport() {
    exportPaymentSheet(mockClaims as any, mockPayments as any);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payment Processing</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Finance disbursement queue — {filtered.length} claim{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Finance Sheet
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="Payment Pending">Payment Pending</option>
              <option value="Paid">Paid</option>
              <option value="Approved">Approved</option>
              <option value="Partially Approved">Partially Approved</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trainer</label>
            <input
              type="text"
              placeholder="Search trainer..."
              value={trainerFilter}
              onChange={(e) => setTrainerFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
            <input
              type="text"
              placeholder="Search client..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Batch / Assignment</label>
            <input
              type="text"
              placeholder="Search batch..."
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {(statusFilter || dateFrom || dateTo || trainerFilter || clientFilter || batchFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setTrainerFilter(''); setClientFilter(''); setBatchFilter(''); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Bill No', 'Trainer', 'Batch / Assignment', 'Client', 'Approved Amt', 'Advance', 'Misc', 'Recoverable', 'Net Payable', 'Currency', 'Status', 'Payment Date', 'UTR', 'Action'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-sm text-gray-400">
                    No payment records match the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((claim) => {
                const paid = isPaid(claim.claimId) || claim.status === 'Paid';
                const rec = getPaymentRecord(claim.claimId);
                const isPending = claim.status === 'Payment Pending';
                return (
                  <tr key={claim.claimId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-indigo-700">{claim.billNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{claim.trainerName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{claim.assignmentIds[0] ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{claim.clientName}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(claim.approvedAmount, claim.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(0, claim.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">—</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(claim.recoverableAmount, claim.currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(claim.netPayable, claim.currency)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-600">{claim.currency}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {rec && 'paidAt' in rec ? fmtDate((rec as any).paidAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {paid && rec ? (
                        <span className="font-mono text-xs text-green-700 bg-green-50 rounded px-2 py-0.5 border border-green-200">
                          {(rec as any).referenceUTR ?? (rec as any).utr ?? '—'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Paid
                        </span>
                      ) : isPending ? (
                        <button
                          onClick={() => openModal(claim)}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Mark as Paid
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Awaiting approval</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark as Paid Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
            {/* Modal header */}
            <div className="flex items-start justify-between rounded-t-2xl bg-indigo-50 px-6 py-4 border-b border-indigo-100">
              <div>
                <h2 className="text-base font-bold text-indigo-900">Mark as Paid</h2>
                <p className="mt-0.5 text-xs text-indigo-600">
                  {selectedClaim.billNo} — {selectedClaim.trainerName}
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Claim summary */}
            <div className="mx-6 mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-gray-500">Client</span>
                  <div className="font-medium text-gray-800">{selectedClaim.clientName}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Net Payable</span>
                  <div className="font-semibold text-indigo-700">{fmt(selectedClaim.netPayable, selectedClaim.currency)}</div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.paymentDate ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.paymentDate && <p className="mt-1 text-xs text-red-500">{formErrors.paymentDate}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Mode <span className="text-red-500">*</span></label>
                  <select
                    value={form.paymentMode}
                    onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reference / UTR No. <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. UTR20260624001"
                  value={form.utr}
                  onChange={(e) => setForm({ ...form, utr: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.utr ? 'border-red-400' : 'border-gray-300'}`}
                />
                {formErrors.utr && <p className="mt-1 text-xs text-red-500">{formErrors.utr}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {selectedClaim.currency === 'AED' ? 'AED' : '₹'}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.paidAmount}
                    onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                    className={`w-full rounded-lg border pl-10 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.paidAmount ? 'border-red-400' : 'border-gray-300'}`}
                  />
                </div>
                {formErrors.paidAmount && <p className="mt-1 text-xs text-red-500">{formErrors.paidAmount}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Finance Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks for the payment..."
                  value={form.financeRemarks}
                  onChange={(e) => setForm({ ...form, financeRemarks: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


