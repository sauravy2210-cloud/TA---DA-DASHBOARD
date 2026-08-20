import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, ClaimHeader } from '../types';
import { exportPaymentSheet } from '../services/exportEngine';
import { downloadKoenigFile, buildKoenigFileBase64 } from '../services/koenigExport';
import { logAction, ACTION_TYPES } from '../services/auditEngine';
import { saveToStorage, getFromStorage, getClaims, saveClaim, refreshClaims, hasDaOverlap } from '../services/storageService';
import VisaFeesBanner from '../components/VisaFeesBanner';

interface PaymentProcessingProps {
  currentUser: User;
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
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const [localPayments, setLocalPayments] = useState<LocalPaymentRecord[]>(
    () => getFromStorage<LocalPaymentRecord[]>('tada_local_payments', [])
  );

  // Payment records used to live ONLY in localStorage — invisible from any other browser or
  // device, and easy to lose. Merge in the server-side copy (Turso) on load so payment history
  // for a bill is reliably visible regardless of which machine originally recorded it. Turso
  // wins on id collision (shouldn't happen — paymentId is a fresh timestamp — but future-proof).
  useEffect(() => {
    fetch('/api/turso?type=payments')
      .then(r => r.ok ? r.json() : { payments: [] })
      .then((d: { payments?: LocalPaymentRecord[] }) => {
        const serverRecords = Array.isArray(d.payments) ? d.payments : [];
        const serverIds = new Set(serverRecords.map(p => p.paymentId));
        // Rescue any record that only ever existed in THIS browser's localStorage (recorded
        // before server-side persistence existed) by pushing it up to Turso now — one-time,
        // whenever this page happens to load in the browser that still has it cached.
        localPayments.filter(p => !serverIds.has(p.paymentId)).forEach(p => {
          fetch('/api/turso?type=payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          }).catch(() => {});
        });
        if (serverRecords.length === 0) return;
        setLocalPayments(prev => {
          const map = new Map(prev.map(p => [p.paymentId, p]));
          serverRecords.forEach(p => map.set(p.paymentId, p));
          const merged = Array.from(map.values());
          saveToStorage('tada_local_payments', merged);
          return merged;
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Simple one-click mark-as-paid — auto-sets today's date, no modal
  function markPaidDirect(claim: ClaimHeader) {
    const today = new Date().toISOString().slice(0, 10);
    const rec: LocalPaymentRecord = {
      paymentId: `pay_${Date.now()}`,
      claimId: claim.claimId,
      billNumber: claim.billNo,
      trainerName: claim.trainerName,
      paidAmount: computeNetPayable(claim),
      paymentDate: today,
      utrReference: `PAY-${Date.now()}`,
      paymentMode: 'NEFT',
      financeRemarks: '',
      processedBy: currentUser.name,
      processedAt: new Date().toISOString(),
    };
    const updated = [...localPayments, rec];
    setLocalPayments(updated);
    saveToStorage('tada_local_payments', updated);
    fetch('/api/turso?type=payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    }).catch(() => { /* local copy already saved above — best-effort server sync */ });
    saveClaim({ ...claim, status: 'Paid', paymentStatus: 'Paid', pendingWith: 'None', lastActionAt: new Date().toISOString() });
    logAction({
      claimId: claim.claimId, entityType: 'Payment', entityId: claim.billNo,
      action: ACTION_TYPES.PAYMENT_PROCESSED,
      newValue: { amount: computeNetPayable(claim), mode: 'NEFT', date: today },
      remarks: 'Marked paid directly by HR Admin',
      performedBy: currentUser.name, performedByRole: currentUser.role,
    });
    setClaimsVersion(v => v + 1);
  }

  // A bill can legitimately be paid more than once against the same claimId — e.g. an initial
  // payment, then HR reopens/corrects the approved amount and a further payment covers the
  // difference. Return every entry (newest first), not just one, so past payments are never
  // hidden by a later one.
  function getPaymentRecords(claimId: string) {
    return localPayments
      .filter((p) => p.claimId === claimId)
      .sort((a, b) => (b.processedAt || '').localeCompare(a.processedAt || ''));
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

      <div className="px-6 pt-4">
        <VisaFeesBanner defaultOpen={statusFilter === 'ApprovedVisaFees'} />
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
              <option value="ApprovedVisaFees">Approved Visa Fees</option>
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
                {['Bill No', 'Trainer', 'Batch / Assignment', 'Client', 'Approved Amt', 'Advance', 'Misc', 'Recoverable', 'Net Payable', 'Currency', 'Status', 'HR Remarks', 'Bank Name', 'Account No.', 'IFSC', 'Bank Edit', 'Payment Date', 'Payment Status'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={18} className="px-4 py-12 text-center text-sm text-gray-400">
                    No payment records match the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((claim) => {
                // Driven by the claim's CURRENT status, not "has ever had a payment recorded" —
                // otherwise once a bill had any payment in its history, reopening it (e.g. to
                // correct the approved amount) could never show "Not Paid" again, and there'd
                // be no way to record the follow-up payment as its own history entry.
                const paid = claim.status === 'Paid';
                const paymentHistory = getPaymentRecords(claim.claimId);
                const rec = paymentHistory[0];
const bank = bankInfoMap[claim.trainerId] ?? bankInfoMap[claim.claimId] ?? { bankName: '', accountNumber: '', ifsc: '', loading: false };
                const isEditingBank = bankEditId === claim.claimId;
                return (
                  <tr key={claim.claimId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/claims/${claim.claimId}`)}
                        className="font-mono text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline underline-offset-2 transition-colors"
                        title="View full claim detail"
                      >
                        {claim.billNo}
                      </button>
                      {(claim as unknown as { rmsTABillId?: number }).rmsTABillId && (
                        <div className="text-[10px] text-gray-400 mt-0.5">RMS: {(claim as unknown as { rmsTABillId?: number }).rmsTABillId}</div>
                      )}
                      {hasDaOverlap(claim) && (
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200" title="Some DA dates in this claim were already paid in another approved/paid claim">
                          ⚠ DA Overlap
                        </div>
                      )}
                    </td>
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
                      {/* Flag right here, next to the badge, when the actual paid amount doesn't
                          match the claim's current Approved/Net Payable shown a few columns to
                          the left — visible without scrolling all the way to Payment Date.
                          Happens legitimately when HR reopens a paid claim and corrects the
                          approved amount before a follow-up payment is recorded. */}
                      {claim.status === 'Paid' && rec && Math.round(rec.paidAmount) !== Math.round(claim.netPayable ?? claim.approvedAmount ?? 0) && (
                        <div className="mt-1 text-[10px] font-semibold text-amber-600" title="The recorded payment doesn't match this claim's current Net Payable — see Payment Date column for full history">
                          ⚠ Actually paid: {claim.currency === 'AED' ? 'AED' : '₹'}{rec.paidAmount.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>
                    {/* HR Remarks */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {claim.adminRemark ? (
                        <span className="block text-xs text-gray-700 italic truncate" title={claim.adminRemark}>
                          {claim.adminRemark}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
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
                    {/* Payment Date — shows the most recent payment; if this bill has been
                        paid more than once (e.g. an initial payment, then a correction after
                        HR reopened/edited the claim), every entry is listed below rather than
                        the earlier one silently disappearing. */}
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {rec ? (
                        <div>
                          <div>{fmtDate(rec.paymentDate)} — {claim.currency === 'AED' ? 'AED' : '₹'}{rec.paidAmount.toLocaleString('en-IN')}</div>
                          {paymentHistory.length > 1 && (
                            <div className="mt-1 space-y-0.5" title="All payments recorded against this bill">
                              <div className="text-[10px] font-semibold text-amber-600">+{paymentHistory.length - 1} earlier payment{paymentHistory.length > 2 ? 's' : ''}:</div>
                              {paymentHistory.slice(1).map(p => (
                                <div key={p.paymentId} className="text-[10px] text-gray-400">
                                  {fmtDate(p.paymentDate)} — {claim.currency === 'AED' ? 'AED' : '₹'}{p.paidAmount.toLocaleString('en-IN')} ({p.paymentMode})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    {/* Payment Status — inline dropdown, no modal */}
                    <td className="px-4 py-3">
                      <select
                        value={paid ? 'paid' : 'not_paid'}
                        onChange={e => { if (e.target.value === 'paid') markPaidDirect(claim); }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          paid
                            ? 'bg-green-100 text-green-700 border-green-300 focus:ring-green-400'
                            : 'bg-orange-50 text-orange-600 border-orange-300 focus:ring-orange-400'
                        }`}
                      >
                        <option value="not_paid">Not Paid</option>
                        <option value="paid">Paid</option>
                      </select>
                      {paid && rec && (
                        <p className="mt-1 text-[10px] text-gray-400">{fmtDate(rec.paymentDate)}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}


