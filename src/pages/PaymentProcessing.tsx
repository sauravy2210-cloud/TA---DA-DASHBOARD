import { useState, useMemo, useEffect } from 'react';
import type { User, ClaimHeader } from '../types';
import { exportPaymentSheet } from '../services/exportEngine';
import { downloadKoenigFile, buildKoenigFileBase64 } from '../services/koenigExport';
import { logAction, ACTION_TYPES } from '../services/auditEngine';
import { notifyPaymentProcessed } from '../services/notificationEngine';
import { saveToStorage, getFromStorage, getClaims, saveClaim, refreshClaims } from '../services/storageService';

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

interface BankInfo {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  loading?: boolean;
}

// Same formula as computedFinalSettlement in ClaimDetail / ledgerEngine
function computeNetPayable(claim: ClaimHeader): number {
  const base = claim.approvedAmount && claim.approvedAmount > 0
    ? claim.approvedAmount
    : claim.totalClaimedAmount ?? 0;
  return base - (claim.advanceAdjusted ?? 0) - (claim.deductionAmount ?? 0) - (claim.recoverableAmount ?? 0);
}

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null') {
      return String(v).trim();
    }
  }
  return '';
}

function extractBankInfo(emp: Record<string, unknown>): BankInfo {
  return {
    bankName: pick(emp, 'bank_name', 'BankName', 'bank', 'Bank', 'bank_nm', 'BankNm'),
    accountNumber: pick(emp,
      'bank_account', 'bank_account_no', 'BankAccountNo',
      'account_number', 'AccountNumber', 'account_no', 'AccountNo',
      'acc_no', 'AccNo', 'account', 'Account'),
    ifsc: pick(emp,
      'ifsc_code', 'bank_ifsc_code', 'BankIfscCode', 'IfscCode',
      'ifsc', 'IFSC', 'bank_ifsc', 'BankIfsc'),
  };
}

/** Lookup bank name from IFSC using Razorpay's free public IFSC API */
async function fetchBankNameFromIfsc(ifsc: string): Promise<string> {
  if (!ifsc || ifsc.length < 4) return '';
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc.toUpperCase())}`, { cache: 'force-cache' });
    if (!res.ok) return '';
    const d = await res.json() as Record<string, unknown>;
    return String(d.BANK ?? d.bank ?? d.BankName ?? '');
  } catch { return ''; }
}

async function fetchBankFromPms(trainerId: string): Promise<BankInfo> {
  // 1. Check localStorage first (trainer may have manually saved)
  try {
    const raw = localStorage.getItem(`trainer_profile_manual_${trainerId}`);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      const b = extractBankInfo(p);
      if (b.bankName || b.accountNumber || b.ifsc) {
        // Fill bank name from IFSC if missing
        if (!b.bankName && b.ifsc) b.bankName = await fetchBankNameFromIfsc(b.ifsc);
        return b;
      }
    }
  } catch { /* ignore */ }

  // 2. Fetch from PMS via /api/employee
  try {
    const res = await fetch(`/api/employee?empCode=${encodeURIComponent(trainerId)}`);
    if (!res.ok) return { bankName: '', accountNumber: '', ifsc: '' };
    const data = await res.json() as { employee?: Record<string, unknown> };
    if (data.employee) {
      const b = extractBankInfo(data.employee);
      // Auto-fill bank name from IFSC when PMS doesn't return it
      if (!b.bankName && b.ifsc) b.bankName = await fetchBankNameFromIfsc(b.ifsc);
      return b;
    }
  } catch { /* ignore */ }

  return { bankName: '', accountNumber: '', ifsc: '' };
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

  const [selectedClaim, setSelectedClaim] = useState<ClaimHeader | null>(null);
  const [form, setForm] = useState<MarkPaidForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<MarkPaidForm>>({});
  const [saving, setSaving] = useState(false);
  const [payTab, setPayTab] = useState<'bank' | 'card'>('bank');
  const [cardForm, setCardForm] = useState({ cardNumber: '', cardHolder: '', expiry: '', cvv: '', billingAddress: '' });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const [localPayments, setLocalPayments] = useState<LocalPaymentRecord[]>(
    () => getFromStorage<LocalPaymentRecord[]>('tada_local_payments', [])
  );

  const [bankInfoMap, setBankInfoMap] = useState<Record<string, BankInfo>>({});
  // Inline bank edit state — keyed by claimId
  const [bankEditId, setBankEditId] = useState<string | null>(null);
  const [bankEditValues, setBankEditValues] = useState<{ bankName: string; accountNumber: string; ifsc: string }>({ bankName: '', accountNumber: '', ifsc: '' });
  const [claimsVersion, setClaimsVersion] = useState(0);
  const [recoveryStatus, setRecoveryStatus] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>(
    () => getFromStorage<Record<string, 'idle' | 'loading' | 'done' | 'error'>>('tada_recovery_status', {})
  );

  // Pull latest claims from Turso on mount, then fetch bank details
  useEffect(() => {
    refreshClaims().then(() => setClaimsVersion(v => v + 1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch bank details for all trainers in the payment queue
  useEffect(() => {
    const claims = getClaims().filter(c =>
      ['Payment Pending', 'Paid', 'Approved', 'Partially Approved'].includes(c.status)
    );

    for (const claim of claims) {
      const trainerId = (claim.trainerId ?? '').trim();
      const mapKey = trainerId || claim.claimId;

      // Check for manually saved bank details first (by claimId fallback)
      try {
        const claimKey = `trainer_profile_manual_claim_${claim.claimId}`;
        const raw = localStorage.getItem(claimKey);
        if (raw) {
          const saved = JSON.parse(raw) as { bankName: string; accountNumber: string; ifsc: string };
          if (saved.bankName || saved.accountNumber || saved.ifsc) {
            setBankInfoMap(prev => ({ ...prev, [mapKey]: { ...saved, loading: false } }));
            continue;
          }
        }
      } catch { /* ignore */ }

      if (!trainerId) {
        // No trainerId — leave as empty (HR Admin can enter manually)
        setBankInfoMap(prev => prev[mapKey] ? prev : { ...prev, [mapKey]: { bankName: '', accountNumber: '', ifsc: '', loading: false } });
        continue;
      }

      // Mark as loading then fetch from PMS (fetchBankFromPms already does IFSC lookup)
      setBankInfoMap(prev => prev[trainerId] ? prev : { ...prev, [trainerId]: { bankName: '', accountNumber: '', ifsc: '', loading: true } });
      fetchBankFromPms(trainerId).then(async info => {
        // If PMS returned IFSC but still no bank name, try IFSC API once more
        if (!info.bankName && info.ifsc) {
          info.bankName = await fetchBankNameFromIfsc(info.ifsc);
        }
        setBankInfoMap(prev => ({ ...prev, [trainerId]: { ...info, loading: false } }));
      });
    }
  }, [claimsVersion]); // re-run after claims refresh

  const paymentClaims = useMemo(
    () =>
      getClaims().filter(
        (c) =>
          c.status === 'Payment Pending' ||
          c.status === 'Paid' ||
          c.status === 'Approved' ||
          c.status === 'Partially Approved'
      ),
    [claimsVersion] // eslint-disable-line react-hooks/exhaustive-deps
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

  // Auto-insert recovery for every claim with a negative net payable (recoverable amount)
  // that hasn't been inserted yet. Runs whenever the filtered list changes.
  useEffect(() => {
    for (const claim of paymentClaims) {
      const net = computeNetPayable(claim);
      if (net >= 0) continue;
      const rs = recoveryStatus[claim.claimId] ?? 'idle';
      if (rs !== 'idle') continue; // already done, loading, or errored

      // Mark as loading immediately to prevent duplicate calls
      setRecoveryStatus((prev) => {
        if ((prev[claim.claimId] ?? 'idle') !== 'idle') return prev;
        const next = { ...prev, [claim.claimId]: 'loading' as const };
        saveToStorage('tada_recovery_status', next);
        return next;
      });

      const today = new Date().toISOString().slice(0, 10);
      const remarks = `TA Bill - ${claim.billNo} - ${claim.trainerId}`;

      fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          EmpCode: claim.trainerId,
          Date: today,
          Currency: claim.currency,
          Amount: String(Math.abs(net)),
          Remarks: remarks,
          CreatedBy: 'HR Admin',
        }),
      })
        .then((r) => r.json())
        .then((data: { success?: boolean }) => {
          const status = data.success ? 'done' as const : 'error' as const;
          setRecoveryStatus((prev) => {
            const next = { ...prev, [claim.claimId]: status };
            saveToStorage('tada_recovery_status', next);
            return next;
          });
        })
        .catch(() => {
          setRecoveryStatus((prev) => {
            const next = { ...prev, [claim.claimId]: 'error' as const };
            saveToStorage('tada_recovery_status', next);
            return next;
          });
        });
    }
  }, [paymentClaims]); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal(claim: ClaimHeader) {
    setSelectedClaim(claim);
    setForm({ ...EMPTY_FORM, paidAmount: String(computeNetPayable(claim)) });
    setFormErrors({});
    setPayTab('bank');
    setCardForm({ cardNumber: '', cardHolder: '', expiry: '', cvv: '', billingAddress: '' });
    setCardErrors({});
  }

  function closeModal() {
    setSelectedClaim(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setCardErrors({});
  }

  function validateCard(): boolean {
    const errs: Record<string, string> = {};
    if (!cardForm.cardNumber.replace(/\s/g, '') || cardForm.cardNumber.replace(/\s/g, '').length < 16) errs.cardNumber = 'Enter valid 16-digit card number';
    if (!cardForm.cardHolder.trim()) errs.cardHolder = 'Card holder name required';
    if (!cardForm.expiry.trim() || !/^\d{2}\/\d{2}$/.test(cardForm.expiry)) errs.expiry = 'Enter expiry as MM/YY';
    if (!cardForm.cvv.trim() || cardForm.cvv.length < 3) errs.cvv = 'Enter valid CVV';
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleCardPay() {
    if (!selectedClaim || !validateCard()) return;
    setSaving(true);
    setTimeout(() => {
      const rec: LocalPaymentRecord = {
        paymentId: `pay_${Date.now()}`,
        claimId: selectedClaim.claimId,
        billNumber: selectedClaim.billNo,
        trainerName: selectedClaim.trainerName,
        paidAmount: computeNetPayable(selectedClaim),
        paymentDate: new Date().toISOString().slice(0, 10),
        utrReference: `CARD-${Date.now()}`,
        paymentMode: 'Online',
        financeRemarks: `Card payment — ${cardForm.cardHolder}`,
        processedBy: currentUser.name,
        processedAt: new Date().toISOString(),
      };
      const updated = [...localPayments, rec];
      setLocalPayments(updated);
      saveToStorage('tada_local_payments', updated);
      const claims = getClaims();
      const idx = claims.findIndex(c => c.claimId === selectedClaim.claimId);
      if (idx >= 0) { saveClaim({ ...claims[idx], status: 'Paid', paymentStatus: 'Paid', pendingWith: 'None', lastActionAt: new Date().toISOString() }); }
      setClaimsVersion(v => v + 1);
      setSaving(false);
      closeModal();
    }, 1200);
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

      saveClaim({
        ...selectedClaim,
        status: 'Paid',
        paymentStatus: 'Paid',
        pendingWith: 'None',
        lastActionAt: new Date().toISOString(),
      });
      setClaimsVersion(v => v + 1);

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

      notifyPaymentProcessed(selectedClaim as unknown as Parameters<typeof notifyPaymentProcessed>[0], selectedClaim.claimId, form.utr);

      setSaving(false);
      closeModal();
    }, 600);
  }

  function isPaid(claimId: string) {
    return localPayments.some((p) => p.claimId === claimId);
  }

  function getPaymentRecord(claimId: string) {
    return localPayments.find((p) => p.claimId === claimId);
  }


  function handleExport() {
    exportPaymentSheet(getClaims() as any, localPayments as any);
  }

  // Retry PMS fetch for a specific trainer
  function retryFetchBank(trainerId: string) {
    if (!trainerId) return;
    setBankInfoMap(prev => ({ ...prev, [trainerId]: { bankName: '', accountNumber: '', ifsc: '', loading: true } }));
    fetchBankFromPms(trainerId).then(async info => {
      if (!info.bankName && info.ifsc) info.bankName = await fetchBankNameFromIfsc(info.ifsc);
      setBankInfoMap(prev => ({ ...prev, [trainerId]: { ...info, loading: false } }));
    });
  }

  // Save manually entered bank details to localStorage + state
  function saveManualBank(trainerId: string, claimId: string, values: { bankName: string; accountNumber: string; ifsc: string }) {
    const key = trainerId ? `trainer_profile_manual_${trainerId}` : `trainer_profile_manual_claim_${claimId}`;
    try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* ignore */ }
    const effectiveKey = trainerId || claimId;
    setBankInfoMap(prev => ({ ...prev, [effectiveKey]: { ...values, loading: false } }));
    setBankEditId(null);
  }

  function handleDownloadKoenig() {
    downloadKoenigFile(filtered, bankInfoMap);
  }

  const [sendingKoenig, setSendingKoenig] = useState(false);

  async function handleSendKoenig() {
    const { base64, rows } = buildKoenigFileBase64(filtered, bankInfoMap);
    if (rows === 0) {
      alert('No claims with positive net payable to send.');
      return;
    }
    setSendingKoenig(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const filename = `Koenig_TADA_Payment_${today}.xlsx`;
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'koenig_file',
          toEmail: currentUser.email,
          attachmentBase64: base64,
          attachmentFilename: filename,
          rowCount: rows,
        }),
      });
      const data = await res.json() as { sent?: boolean; skipped?: boolean; error?: string };
      if (data.sent) {
        alert(`Koenig file sent successfully to finance email (${rows} claim${rows !== 1 ? 's' : ''}).`);
      } else if (data.skipped) {
        alert('Email not configured on server (RESEND_API_KEY missing). Use "Download Koenig File" instead.');
      } else {
        alert(`Send failed: ${data.error ?? 'Unknown error'}`);
      }
    } catch {
      alert('Network error — could not send the file. Use "Download Koenig File" instead.');
    } finally {
      setSendingKoenig(false);
    }
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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Finance Sheet */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Finance Sheet
            </button>

            {/* Download Koenig File */}
            <button
              onClick={handleDownloadKoenig}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
              title="Download Koenig bank transfer file (Kotak format)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Koenig File
            </button>

            {/* Send Koenig File */}
            <button
              onClick={handleSendKoenig}
              disabled={sendingKoenig}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Send Koenig bank transfer file to finance email"
            >
              {sendingKoenig ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              {sendingKoenig ? 'Sending…' : 'Send Koenig File'}
            </button>
          </div>
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
                {['Bill No', 'Trainer', 'Batch / Assignment', 'Client', 'Approved Amt', 'Advance', 'Misc', 'Recoverable', 'Net Payable', 'Currency', 'Status', 'Bank Name', 'Account No.', 'IFSC', 'Bank Edit', 'Pay', 'Payment Date', 'UTR', 'Payment Status', 'Action'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-sm text-gray-400">
                    No payment records match the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((claim) => {
                const paid = isPaid(claim.claimId) || claim.status === 'Paid';
                const rec = getPaymentRecord(claim.claimId);
const bank = bankInfoMap[claim.trainerId] ?? bankInfoMap[claim.claimId] ?? { bankName: '', accountNumber: '', ifsc: '', loading: false };
                const isEditingBank = bankEditId === claim.claimId;
                return (
                  <tr key={claim.claimId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-indigo-700">{claim.billNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{claim.trainerName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{claim.assignmentIds[0] ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{claim.clientName}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(claim.approvedAmount, claim.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(claim.advanceAdjusted || 0, claim.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">—</td>
                    {(() => {
                      const net = computeNetPayable(claim);
                      return net >= 0 ? (
                        <>
                          <td className="px-4 py-3 text-right text-gray-400">{fmt(0, claim.currency)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(net, claim.currency)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            <div>{fmt(Math.abs(net), claim.currency)}</div>
                            {(() => {
                              const rs = recoveryStatus[claim.claimId] ?? 'idle';
                              if (rs === 'done') return (
                                <div className="mt-1 text-[10px] font-medium text-green-600">✓ Recovery inserted</div>
                              );
                              if (rs === 'loading') return (
                                <div className="mt-1 text-[10px] text-amber-500 animate-pulse">Inserting recovery…</div>
                              );
                              if (rs === 'error') return (
                                <div className="mt-1 text-[10px] text-red-400">⚠ Recovery failed</div>
                              );
                              return null;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400">{fmt(0, claim.currency)}</td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-3 text-xs font-medium text-gray-600">{claim.currency}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {claim.status}
                      </span>
                    </td>
                    {/* Bank Name */}
                    <td className="px-4 py-3 text-xs text-gray-700 min-w-[140px]">
                      {bank.loading ? (
                        <span className="text-gray-300 animate-pulse">Fetching…</span>
                      ) : isEditingBank ? (
                        <input autoFocus value={bankEditValues.bankName}
                          onChange={e => setBankEditValues(v => ({ ...v, bankName: e.target.value }))}
                          placeholder="Bank Name"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      ) : bank.bankName ? (
                        <span className="font-medium">{bank.bankName}</span>
                      ) : (
                        <button onClick={() => { setBankEditId(claim.claimId); setBankEditValues({ bankName: bank.bankName, accountNumber: bank.accountNumber, ifsc: bank.ifsc }); }}
                          className="text-amber-600 hover:text-amber-700 text-[11px] underline underline-offset-2">+ Enter</button>
                      )}
                    </td>
                    {/* Account No */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 min-w-[150px]">
                      {bank.loading ? (
                        <span className="text-gray-300 animate-pulse">…</span>
                      ) : isEditingBank ? (
                        <input value={bankEditValues.accountNumber}
                          onChange={e => setBankEditValues(v => ({ ...v, accountNumber: e.target.value }))}
                          placeholder="Account Number"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      ) : (
                        <span>{bank.accountNumber || <span className="text-gray-300 font-sans">—</span>}</span>
                      )}
                    </td>
                    {/* IFSC */}
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600 min-w-[130px]">
                      {bank.loading ? (
                        <span className="text-gray-300 animate-pulse font-normal">…</span>
                      ) : isEditingBank ? (
                        <input value={bankEditValues.ifsc}
                          onChange={e => setBankEditValues(v => ({ ...v, ifsc: e.target.value.toUpperCase() }))}
                          onBlur={async e => {
                            const ifsc = e.target.value.trim().toUpperCase();
                            if (ifsc.length >= 4 && !bankEditValues.bankName) {
                              const name = await fetchBankNameFromIfsc(ifsc);
                              if (name) setBankEditValues(v => ({ ...v, bankName: name }));
                            }
                          }}
                          placeholder="IFSC Code"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      ) : (
                        <span>{bank.ifsc || <span className="text-gray-300 font-normal font-sans">—</span>}</span>
                      )}
                    </td>
                    {/* Edit / Retry actions */}
                    <td className="px-2 py-3 text-xs whitespace-nowrap">
                      {bank.loading ? null : isEditingBank ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveManualBank(claim.trainerId ?? '', claim.claimId, bankEditValues)}
                            className="px-2 py-1 rounded bg-green-600 text-white text-[10px] font-semibold hover:bg-green-700">Save</button>
                          <button onClick={() => setBankEditId(null)}
                            className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-[10px] hover:bg-gray-300">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button title="Edit bank details"
                            onClick={() => { setBankEditId(claim.claimId); setBankEditValues({ bankName: bank.bankName, accountNumber: bank.accountNumber, ifsc: bank.ifsc }); }}
                            className="p-1 rounded hover:bg-amber-100 text-amber-500 transition-colors">✏️</button>
                          <button title="Retry fetch from PMS"
                            onClick={() => retryFetchBank(claim.trainerId ?? '')}
                            className="p-1 rounded hover:bg-blue-100 text-blue-500 transition-colors text-[11px]">↻</button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {paid ? (
                        <span className="text-xs text-green-600 font-medium">✓ Done</span>
                      ) : (
                        <button
                          onClick={() => openModal(claim)}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors shadow-sm"
                        >
                          💳 Pay
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {rec ? fmtDate(rec.paymentDate) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {rec ? (
                        <span className="font-mono text-xs text-green-700 bg-green-50 rounded px-2 py-0.5 border border-green-200">
                          {rec.utrReference}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {/* Payment Status column */}
                    <td className="px-4 py-3">
                      {paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 border border-red-200">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm0 6a1 1 0 10-2 0 1 1 0 002 0z" clipRule="evenodd" />
                          </svg>
                          Unpaid
                        </span>
                      )}
                    </td>
                    {/* Action column */}
                    <td className="px-4 py-3">
                      {paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Paid
                        </span>
                      ) : (
                        <button
                          onClick={() => openModal(claim)}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-start justify-between rounded-t-2xl bg-indigo-50 px-6 py-4 border-b border-indigo-100 sticky top-0 z-10">
              <div>
                <h2 className="text-base font-bold text-indigo-900">Process Payment</h2>
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
                  <div className="font-semibold text-indigo-700">{fmt(computeNetPayable(selectedClaim), selectedClaim.currency)}</div>
                </div>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="mx-6 mt-4 flex rounded-xl overflow-hidden border border-gray-200">
              <button
                onClick={() => setPayTab('bank')}
                className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${payTab === 'bank' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                🏦 Bank Transfer
              </button>
              <button
                onClick={() => setPayTab('card')}
                className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-l border-gray-200 ${payTab === 'card' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                💳 Card Payment
              </button>
            </div>

            {/* ── Bank Transfer Tab ── */}
            {payTab === 'bank' && (
              <>
                {(() => {
                  const bank = bankInfoMap[selectedClaim.trainerId] ?? { bankName: '', accountNumber: '', ifsc: '', loading: true };
                  const hasBankInfo = bank.bankName || bank.accountNumber || bank.ifsc;
                  return (
                    <div className={`mx-6 mt-3 rounded-lg px-4 py-3 text-sm ${bank.loading ? 'bg-gray-50 border border-gray-100' : hasBankInfo ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'}`}>
                      <p className={`text-xs font-semibold mb-2 ${bank.loading ? 'text-gray-500' : hasBankInfo ? 'text-blue-700' : 'text-amber-700'}`}>
                        🏦 Trainer Bank Details
                      </p>
                      {bank.loading ? (
                        <p className="text-xs text-gray-400 animate-pulse">Fetching bank details from PMS…</p>
                      ) : hasBankInfo ? (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-blue-500 uppercase tracking-wide">Bank Name</span>
                            <div className="font-medium text-gray-800 text-xs mt-0.5">{bank.bankName || '—'}</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-blue-500 uppercase tracking-wide">Account No.</span>
                            <div className="font-mono font-medium text-gray-800 text-xs mt-0.5">{bank.accountNumber || '—'}</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-blue-500 uppercase tracking-wide">IFSC Code</span>
                            <div className="font-mono font-semibold text-indigo-700 text-xs mt-0.5">{bank.ifsc || '—'}</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">No bank details found. Ask trainer to update their profile.</p>
                      )}
                    </div>
                  );
                })()}
                <div className="px-6 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                      <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.paymentDate ? 'border-red-400' : 'border-gray-300'}`} />
                      {formErrors.paymentDate && <p className="mt-1 text-xs text-red-500">{formErrors.paymentDate}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Mode <span className="text-red-500">*</span></label>
                      <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="NEFT">NEFT</option>
                        <option value="RTGS">RTGS</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Online">Online</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reference / UTR No. <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="e.g. UTR20260624001" value={form.utr} onChange={(e) => setForm({ ...form, utr: e.target.value })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.utr ? 'border-red-400' : 'border-gray-300'}`} />
                    {formErrors.utr && <p className="mt-1 text-xs text-red-500">{formErrors.utr}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{selectedClaim.currency === 'AED' ? 'AED' : '₹'}</span>
                      <input type="number" placeholder="0" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                        className={`w-full rounded-lg border pl-10 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.paidAmount ? 'border-red-400' : 'border-gray-300'}`} />
                    </div>
                    {formErrors.paidAmount && <p className="mt-1 text-xs text-red-500">{formErrors.paidAmount}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Finance Remarks</label>
                    <textarea rows={2} placeholder="Optional remarks…" value={form.financeRemarks} onChange={(e) => setForm({ ...form, financeRemarks: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
                  <button onClick={handleSubmit} disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60">
                    {saving ? (<><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving…</>) : 'Confirm Bank Transfer'}
                  </button>
                </div>
              </>
            )}

            {/* ── Card Payment Tab ── */}
            {payTab === 'card' && (
              <>
                <div className="mx-6 mt-3 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 px-5 py-4 text-white shadow-md">
                  <p className="text-[10px] uppercase tracking-widest text-indigo-200 mb-3">Payment Card</p>
                  <p className="font-mono text-lg tracking-widest">
                    {cardForm.cardNumber.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim() || '•••• •••• •••• ••••'}
                  </p>
                  <div className="flex justify-between mt-3 text-xs">
                    <div>
                      <p className="text-indigo-300 text-[10px]">Card Holder</p>
                      <p className="font-medium">{cardForm.cardHolder || 'FULL NAME'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-indigo-300 text-[10px]">Expires</p>
                      <p className="font-medium">{cardForm.expiry || 'MM/YY'}</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Card Number <span className="text-red-500">*</span></label>
                    <input type="text" maxLength={19} placeholder="1234 5678 9012 3456"
                      value={cardForm.cardNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
                        setCardForm({ ...cardForm, cardNumber: v });
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${cardErrors.cardNumber ? 'border-red-400' : 'border-gray-300'}`} />
                    {cardErrors.cardNumber && <p className="mt-1 text-xs text-red-500">{cardErrors.cardNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Card Holder Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="As printed on card" value={cardForm.cardHolder}
                      onChange={(e) => setCardForm({ ...cardForm, cardHolder: e.target.value.toUpperCase() })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${cardErrors.cardHolder ? 'border-red-400' : 'border-gray-300'}`} />
                    {cardErrors.cardHolder && <p className="mt-1 text-xs text-red-500">{cardErrors.cardHolder}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expiry (MM/YY) <span className="text-red-500">*</span></label>
                      <input type="text" maxLength={5} placeholder="MM/YY" value={cardForm.expiry}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                          if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                          setCardForm({ ...cardForm, expiry: v });
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${cardErrors.expiry ? 'border-red-400' : 'border-gray-300'}`} />
                      {cardErrors.expiry && <p className="mt-1 text-xs text-red-500">{cardErrors.expiry}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">CVV <span className="text-red-500">*</span></label>
                      <input type="password" maxLength={4} placeholder="•••" value={cardForm.cvv}
                        onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${cardErrors.cvv ? 'border-red-400' : 'border-gray-300'}`} />
                      {cardErrors.cvv && <p className="mt-1 text-xs text-red-500">{cardErrors.cvv}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Billing Address</label>
                    <textarea rows={2} placeholder="Optional billing address…" value={cardForm.billingAddress}
                      onChange={(e) => setCardForm({ ...cardForm, billingAddress: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 flex justify-between items-center">
                    <span className="text-xs font-medium text-green-700">Amount to charge</span>
                    <span className="text-base font-bold text-green-700">{fmt(computeNetPayable(selectedClaim), selectedClaim.currency)}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
                  <button onClick={handleCardPay} disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60">
                    {saving ? (<><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Processing…</>) : '💳 Pay Now'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


