import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

// Mirrors the record shape saved by VisaEntry.tsx (Trainer's Visa Fees Entry page) and
// decided on by AdminDashboard.tsx's Visa Fees Submission section.
interface VisaDbRecord {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  entryType: 'travel' | 'misc';
  submittedAt: string;
  fromDate: string;
  toDate: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  reviewedAt?: string;
  paymentStatus?: 'Paid' | 'Not Paid';
  paymentDate?: string;
  data: {
    date: string;
    amount: number;
    currency: string;
    receiptData?: string;
    receiptName?: string;
    travelType?: string;
    from?: string;
    to?: string;
    expenseType?: string;
    remarks?: string;
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface BankInfo { bankName: string; accountNumber: string; ifsc: string; loading?: boolean }

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
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

// Mirrors PaymentProcessing.tsx's fetchBankFromPms — deliberately duplicated (self-contained
// component used on multiple pages) rather than imported. Also checks the SAME localStorage
// key (trainer_profile_manual_<trainerId>) the main Payment Processing table uses, so a bank
// edit made in either place is visible in both.
async function fetchBankFromPms(trainerId: string): Promise<BankInfo> {
  try {
    const raw = localStorage.getItem(`trainer_profile_manual_${trainerId}`);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      const b = extractBankInfo(p);
      if (b.bankName || b.accountNumber || b.ifsc) return b;
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch(`/api/employee?empCode=${encodeURIComponent(trainerId)}`);
    if (!res.ok) return { bankName: '', accountNumber: '', ifsc: '' };
    const data = await res.json() as { employee?: Record<string, unknown> };
    if (data.employee) return extractBankInfo(data.employee);
  } catch { /* ignore */ }
  return { bankName: '', accountNumber: '', ifsc: '' };
}

/** Lookup bank name from IFSC using Razorpay's free public IFSC API — mirrors PaymentProcessing.tsx */
async function fetchBankNameFromIfsc(ifsc: string): Promise<string> {
  if (!ifsc || ifsc.length < 4) return '';
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc.toUpperCase())}`, { cache: 'force-cache' });
    if (!res.ok) return '';
    const d = await res.json() as Record<string, unknown>;
    return String(d.BANK ?? d.bank ?? d.BankName ?? '');
  } catch { return ''; }
}

/** Compact banner showing Approved Visa Fees entries — used on Payment Processing and
 * Verification Queue so approved amounts are visible wherever HR/Finance process bills. */
export default function VisaFeesBanner({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [entries, setEntries] = useState<VisaDbRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  // React to the parent explicitly requesting the banner be expanded (e.g. the
  // "Approved Visa Fees" option in Payment Processing's status filter dropdown).
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  const reload = useCallback(() => {
    setLoading(true);
    fetch('/api/turso?type=visa')
      .then(r => r.json())
      .then(d => {
        const all: VisaDbRecord[] = Array.isArray(d.entries) ? d.entries : [];
        setEntries(all.filter(e => e.status === 'Approved'));
      })
      .catch(() => { /* keep previous entries on transient failure */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Fetch each approved trainer's bank details (once per trainerId) so HR Admin can see
  // exactly where to send the payment, same as the main Payment Processing bill table.
  const [bankInfoMap, setBankInfoMap] = useState<Record<string, BankInfo>>({});
  useEffect(() => {
    const uniqueTrainerIds = Array.from(new Set(entries.map(e => e.trainerId).filter(Boolean)));
    const toFetch = uniqueTrainerIds.filter(id => !(id in bankInfoMap));
    if (toFetch.length === 0) return;
    setBankInfoMap(prev => {
      const next = { ...prev };
      toFetch.forEach(id => { next[id] = { bankName: '', accountNumber: '', ifsc: '', loading: true }; });
      return next;
    });
    toFetch.forEach(id => {
      fetchBankFromPms(id).then(info => {
        setBankInfoMap(prev => ({ ...prev, [id]: { ...info, loading: false } }));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // ── Bank edit (mirrors PaymentProcessing.tsx's inline bank edit) ────────────────────────
  const [bankEditId, setBankEditId] = useState<string | null>(null);
  const [bankEditValues, setBankEditValues] = useState<{ bankName: string; accountNumber: string; ifsc: string }>({ bankName: '', accountNumber: '', ifsc: '' });

  function retryFetchBank(trainerId: string) {
    if (!trainerId) return;
    setBankInfoMap(prev => ({ ...prev, [trainerId]: { bankName: '', accountNumber: '', ifsc: '', loading: true } }));
    fetchBankFromPms(trainerId).then(async info => {
      if (!info.bankName && info.ifsc) info.bankName = await fetchBankNameFromIfsc(info.ifsc);
      setBankInfoMap(prev => ({ ...prev, [trainerId]: { ...info, loading: false } }));
    });
  }

  function saveManualBank(trainerId: string, values: { bankName: string; accountNumber: string; ifsc: string }) {
    try { localStorage.setItem(`trainer_profile_manual_${trainerId}`, JSON.stringify(values)); } catch { /* ignore */ }
    setBankInfoMap(prev => ({ ...prev, [trainerId]: { ...values, loading: false } }));
    setBankEditId(null);
  }

  // ── Payment status — persisted directly on the visa_entries record ─────────────────────
  const [payUpdatingId, setPayUpdatingId] = useState<string | null>(null);
  async function markVisaPaid(entry: VisaDbRecord) {
    setPayUpdatingId(entry.id);
    const today = new Date().toISOString().slice(0, 10);
    const updated: VisaDbRecord = { ...entry, paymentStatus: 'Paid', paymentDate: today };
    try {
      const r = await fetch('/api/turso?type=visa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEntries(prev => prev.map(e => (e.id === entry.id ? updated : e)));
    } catch { /* leave unchanged on failure — HR Admin can retry */ }
    finally { setPayUpdatingId(null); }
  }

  // Export in the EXACT same format as "Download Koenig File" (Kotak bulk-payment template:
  // InvoiceId | beneficiaryname | accountno | ifsc | amount | remark | payby), populated with
  // Approved Visa Fees data instead of claim data — so HR Admin can use it the same way.
  function handleExportExcel() {
    const rows = entries
      .filter(e => e.data.amount > 0)
      .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
      .map(e => {
        const bank = bankInfoMap[e.trainerId] ?? { bankName: '', accountNumber: '', ifsc: '' };
        return {
          InvoiceId: 0,
          beneficiaryname: e.trainerName,
          accountno: bank.accountNumber,
          ifsc: bank.ifsc,
          amount: e.data.amount,
          remark: `Visa Fee - ${e.entryType === 'travel' ? 'Travel' : 'Misc'} - ${e.trainerId}`,
          payby: 2,
        };
      });
    if (rows.length === 0) {
      alert('No approved visa fees with a positive amount to export.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [
      ['InvoiceId', 'beneficiaryname', 'accountno', 'ifsc', 'amount', 'remark', 'payby'],
      ...rows.map(r => [r.InvoiceId, r.beneficiaryname, r.accountno, r.ifsc, r.amount, r.remark, r.payby]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 12 }, // InvoiceId
      { wch: 28 }, // beneficiaryname
      { wch: 22 }, // accountno
      { wch: 16 }, // ifsc
      { wch: 14 }, // amount
      { wch: 42 }, // remark
      { wch: 8 },  // payby
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Visa_Fees_Payment_${today}.xlsx`);
  }

  if (!loading && entries.length === 0) return null;

  const totalInr = entries.filter(e => (e.data.currency || 'INR') === 'INR').reduce((s, e) => s + e.data.amount, 0);
  const foreignMap: Record<string, number> = {};
  entries.filter(e => e.data.currency && e.data.currency !== 'INR').forEach(e => {
    foreignMap[e.data.currency] = (foreignMap[e.data.currency] ?? 0) + e.data.amount;
  });

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm overflow-hidden mb-4">
      <div className="w-full flex items-center justify-between px-5 py-3">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-sm font-semibold text-green-800">🛂 Approved Visa Fees</span>
          <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-xs font-bold">
            {loading ? '…' : entries.length}
          </span>
        </button>
        <div className="flex items-center gap-3">
          {totalInr > 0 && <span className="text-sm font-bold text-green-700">₹{totalInr.toLocaleString('en-IN')}</span>}
          {Object.entries(foreignMap).map(([cur, amt]) => (
            <span key={cur} className="text-sm font-bold text-green-700">{cur} {amt.toLocaleString('en-IN')}</span>
          ))}
          {entries.length > 0 && (
            <button
              onClick={handleExportExcel}
              title="Download Excel for making payment"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
            >
              ⬇ Download Excel
            </button>
          )}
          <button onClick={() => setOpen(v => !v)} className="text-green-500 text-xs hover:text-green-700">{open ? '▲' : '▼'}</button>
        </div>
      </div>
      {open && (
        <div className="overflow-x-auto border-t border-green-200">
          <table className="min-w-full text-xs">
            <thead className="bg-white/60">
              <tr>
                {['Trainer', 'Emp Code', 'Type', 'Details', 'Date', 'Amount', 'Approved On', 'Attachment', 'Bank Name', 'Account No.', 'IFSC', 'Bank Edit', 'Payment Status'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-green-100 bg-white/40">
              {entries
                .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
                .map(e => {
                  const bank = bankInfoMap[e.trainerId] ?? { bankName: '', accountNumber: '', ifsc: '', loading: false };
                  return (
                  <tr key={e.id} className="hover:bg-white/70">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{e.trainerName || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-mono text-indigo-700">{e.trainerId || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.entryType === 'travel' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>
                        {e.entryType === 'travel' ? 'Travel' : 'Misc'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {e.entryType === 'travel'
                        ? `${e.data.travelType || '—'}: ${e.data.from || '—'} → ${e.data.to || '—'}`
                        : `${e.data.expenseType || 'Other'}${e.data.remarks ? ' — ' + e.data.remarks : ''}`}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatDate(e.data.date)}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-semibold text-gray-800">{e.data.currency} {e.data.amount}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatDate(e.reviewedAt)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {e.data.receiptData ? (
                        <a href={e.data.receiptData} download={e.data.receiptName || 'attachment'} className="text-blue-600 hover:underline font-medium">View</a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {(() => {
                      const isEditingBank = bankEditId === e.trainerId;
                      return (
                        <>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700 min-w-[120px]">
                            {bank.loading ? (
                              <span className="text-gray-400 animate-pulse">Fetching…</span>
                            ) : isEditingBank ? (
                              <input autoFocus value={bankEditValues.bankName}
                                onChange={ev => setBankEditValues(v => ({ ...v, bankName: ev.target.value }))}
                                placeholder="Bank Name"
                                className="w-full border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            ) : bank.bankName ? (
                              <span className="font-medium">{bank.bankName}</span>
                            ) : (
                              <button onClick={() => { setBankEditId(e.trainerId); setBankEditValues({ bankName: bank.bankName, accountNumber: bank.accountNumber, ifsc: bank.ifsc }); }}
                                className="text-amber-600 hover:text-amber-700 text-[11px] underline underline-offset-2">+ Enter</button>
                            )}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap font-mono text-gray-700 min-w-[130px]">
                            {bank.loading ? '' : isEditingBank ? (
                              <input value={bankEditValues.accountNumber}
                                onChange={ev => setBankEditValues(v => ({ ...v, accountNumber: ev.target.value }))}
                                placeholder="Account Number"
                                className="w-full border border-amber-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            ) : (bank.accountNumber || <span className="text-gray-300 font-sans">—</span>)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap font-mono text-indigo-600 min-w-[110px]">
                            {bank.loading ? '' : isEditingBank ? (
                              <input value={bankEditValues.ifsc}
                                onChange={ev => setBankEditValues(v => ({ ...v, ifsc: ev.target.value.toUpperCase() }))}
                                onBlur={async ev => {
                                  const ifsc = ev.target.value.trim().toUpperCase();
                                  if (ifsc.length >= 4 && !bankEditValues.bankName) {
                                    const name = await fetchBankNameFromIfsc(ifsc);
                                    if (name) setBankEditValues(v => ({ ...v, bankName: name }));
                                  }
                                }}
                                placeholder="IFSC Code"
                                className="w-full border border-amber-300 rounded px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            ) : (bank.ifsc || <span className="text-gray-300 font-sans">—</span>)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {bank.loading ? null : isEditingBank ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => saveManualBank(e.trainerId, bankEditValues)}
                                  className="px-2 py-1 rounded bg-green-600 text-white text-[10px] font-semibold hover:bg-green-700">Save</button>
                                <button onClick={() => setBankEditId(null)}
                                  className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-[10px] hover:bg-gray-300">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button title="Edit bank details"
                                  onClick={() => { setBankEditId(e.trainerId); setBankEditValues({ bankName: bank.bankName, accountNumber: bank.accountNumber, ifsc: bank.ifsc }); }}
                                  className="p-1 rounded hover:bg-amber-100 text-amber-500 transition-colors">✏️</button>
                                <button title="Retry fetch from PMS"
                                  onClick={() => retryFetchBank(e.trainerId)}
                                  className="p-1 rounded hover:bg-blue-100 text-blue-500 transition-colors text-[11px]">↻</button>
                              </div>
                            )}
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <select
                        value={e.paymentStatus === 'Paid' ? 'paid' : 'not_paid'}
                        disabled={payUpdatingId === e.id}
                        onChange={ev => { if (ev.target.value === 'paid') markVisaPaid(e); }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          e.paymentStatus === 'Paid'
                            ? 'bg-green-100 text-green-700 border-green-300 focus:ring-green-400'
                            : 'bg-orange-50 text-orange-600 border-orange-300 focus:ring-orange-400'
                        }`}
                      >
                        <option value="not_paid">Not Paid</option>
                        <option value="paid">Paid</option>
                      </select>
                      {e.paymentStatus === 'Paid' && e.paymentDate && (
                        <p className="mt-1 text-[10px] text-gray-400">{formatDate(e.paymentDate)}</p>
                      )}
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
