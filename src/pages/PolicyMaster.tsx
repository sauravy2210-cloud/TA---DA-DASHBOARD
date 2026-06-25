import React, { useState, useMemo } from 'react';
import type { User } from '../types';
import { mockPolicies } from '../data/mockMasters';
import { logAction, ACTION_TYPES } from '../services/auditEngine';
import { saveToStorage, getFromStorage } from '../services/storageService';

interface PolicyMasterProps {
  currentUser: User;
}

// Local policy shape (based on actual mockPolicies structure)
interface LocalPolicy {
  id: string;
  name: string;
  category: string;
  applicableTo: string;
  currency: string;
  maxAmountPerDay?: number;
  maxAmountPerNight?: number;
  notes?: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
  changedBy: string;
  changedOn?: string;
  reason?: string;
}

interface EditForm {
  name: string;
  category: string;
  applicableTo: string;
  currency: string;
  maxAmount: string;
  notes: string;
  effectiveFrom: string;
  effectiveTo: string;
  active: boolean;
  reason: string;
}

const STORAGE_KEY = 'tada_local_policies';
const HISTORY_KEY = 'tada_policy_history';

const EXPENSE_TYPES = ['All', 'DA', 'Hotel', 'Cab', 'Flight', 'Train', 'Other'];
const CURRENCIES = ['INR', 'AED', 'USD', 'EUR', 'GBP', 'SGD'];

function fmt(n: number | undefined, curr: string) {
  if (n === undefined || n === null) return '—';
  const sym = curr === 'INR' ? '₹' : curr === 'AED' ? 'AED ' : curr === 'USD' ? '$' : curr;
  return `${sym}${n.toLocaleString()}`;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PolicyMaster({ currentUser }: PolicyMasterProps) {
  const isSuperAdmin = currentUser.role === 'SuperAdmin';

  const [localPolicies, setLocalPolicies] = useState<LocalPolicy[]>(
    () => getFromStorage<LocalPolicy[]>(STORAGE_KEY, mockPolicies as unknown as LocalPolicy[])
  );
  const [policyHistory, setPolicyHistory] = useState<Record<string, LocalPolicy[]>>(
    () => getFromStorage<Record<string, LocalPolicy[]>>(HISTORY_KEY, {})
  );

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dateFilter, setDateFilter] = useState('');

  const [editTarget, setEditTarget] = useState<LocalPolicy | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<EditForm>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = useMemo(() => {
    return localPolicies.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (activeFilter === 'active' && !p.active) return false;
      if (activeFilter === 'inactive' && p.active) return false;
      if (dateFilter && p.effectiveFrom > dateFilter) return false;
      return true;
    });
  }, [localPolicies, categoryFilter, activeFilter, dateFilter]);

  const EMPTY_FORM: EditForm = {
    name: '', category: 'DA', applicableTo: '', currency: 'INR',
    maxAmount: '', notes: '', effectiveFrom: '2026-01-01', effectiveTo: '',
    active: true, reason: '',
  };

  function openEdit(policy: LocalPolicy) {
    setEditTarget(policy);
    setForm({
      name: policy.name,
      category: policy.category,
      applicableTo: policy.applicableTo,
      currency: policy.currency,
      maxAmount: String(policy.maxAmountPerDay ?? policy.maxAmountPerNight ?? ''),
      notes: policy.notes ?? '',
      effectiveFrom: policy.effectiveFrom,
      effectiveTo: policy.effectiveTo ?? '',
      active: policy.active,
      reason: '',
    });
    setFormErrors({});
    setShowAddModal(false);
  }

  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setShowAddModal(true);
  }

  function closeModal() {
    setEditTarget(null);
    setForm(null);
    setFormErrors({});
    setShowAddModal(false);
  }

  function validate(): boolean {
    if (!form) return false;
    const errors: Partial<EditForm> = {};
    if (!form.name.trim()) errors.name = 'Required';
    if (!form.applicableTo.trim()) errors.applicableTo = 'Required';
    if (!form.effectiveFrom) errors.effectiveFrom = 'Required';
    if (!form.reason.trim()) errors.reason = 'Reason is required for audit trail';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSave() {
    if (!form || !validate()) return;
    setSaving(true);
    setTimeout(() => {
      const maxAmt = form.maxAmount ? Number(form.maxAmount) : undefined;
      const isDA = form.category === 'DA';
      const isHotel = form.category === 'Hotel';

      if (editTarget) {
        // Save history
        const hist = policyHistory[editTarget.id] ?? [];
        const updatedHist = { ...policyHistory, [editTarget.id]: [...hist, { ...editTarget }] };
        setPolicyHistory(updatedHist);
        saveToStorage(HISTORY_KEY, updatedHist);

        const updated: LocalPolicy = {
          ...editTarget,
          name: form.name,
          category: form.category,
          applicableTo: form.applicableTo,
          currency: form.currency,
          maxAmountPerDay: isDA ? maxAmt : undefined,
          maxAmountPerNight: isHotel ? maxAmt : undefined,
          notes: form.notes,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
          active: form.active,
          version: editTarget.version + 1,
          changedBy: currentUser.name,
          changedOn: new Date().toISOString(),
          reason: form.reason,
        };

        const updatedList = localPolicies.map((p) => (p.id === editTarget.id ? updated : p));
        setLocalPolicies(updatedList);
        saveToStorage(STORAGE_KEY, updatedList);

        logAction({
          entityType: 'Policy',
          entityId: editTarget.id,
          action: ACTION_TYPES.POLICY_CHANGED,
          oldValue: { version: editTarget.version, maxAmount: editTarget.maxAmountPerDay ?? editTarget.maxAmountPerNight },
          newValue: { version: updated.version, maxAmount: maxAmt },
          remarks: form.reason,
          performedBy: currentUser.name,
          performedByRole: currentUser.role,
        });
      } else {
        // Add new
        const newPol: LocalPolicy = {
          id: `pol-${Date.now()}`,
          name: form.name,
          category: form.category,
          applicableTo: form.applicableTo,
          currency: form.currency,
          maxAmountPerDay: isDA ? maxAmt : undefined,
          maxAmountPerNight: isHotel ? maxAmt : undefined,
          notes: form.notes,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
          active: form.active,
          version: 1,
          changedBy: currentUser.name,
          changedOn: new Date().toISOString(),
          reason: form.reason,
        };
        const updatedList = [...localPolicies, newPol];
        setLocalPolicies(updatedList);
        saveToStorage(STORAGE_KEY, updatedList);

        logAction({
          entityType: 'Policy',
          entityId: newPol.id,
          action: ACTION_TYPES.POLICY_CHANGED,
          newValue: { name: form.name, category: form.category, maxAmount: maxAmt },
          remarks: form.reason,
          performedBy: currentUser.name,
          performedByRole: currentUser.role,
        });
      }

      setSaving(false);
      closeModal();
    }, 500);
  }

  const showModal = editTarget !== null || showAddModal;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Policy Master</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              TA/DA policy rules — {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
              {!isSuperAdmin && <span className="ml-2 text-amber-600">(Read-only)</span>}
            </p>
          </div>
          {isSuperAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add New Rule
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Expense Type</label>
            <div className="flex gap-1.5">
              {EXPENSE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCategoryFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    categoryFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as any)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Effective From (before)</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Rule ID', 'Name', 'Category', 'Applicable To', 'Max Amount', 'Currency', 'Partial Day', 'Proof Req.', 'Effective From', 'Effective To', 'Ver.', 'Status', 'Changed By', 'Changed On', 'Actions'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-sm text-gray-400">
                    No policy rules match the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((policy) => {
                const maxAmt = policy.maxAmountPerDay ?? policy.maxAmountPerNight;
                const isExpanded = expandedRow === policy.id;
                const history = policyHistory[policy.id] ?? [];

                return (
                  <React.Fragment key={policy.id}>
                    <tr className={`hover:bg-gray-50 transition-colors ${!policy.active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-600">{policy.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{policy.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {policy.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{policy.applicableTo}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {maxAmt !== undefined ? fmt(maxAmt, policy.currency) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-500">{policy.currency}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {policy.category === 'DA' ? 'Yes (50%)' : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${policy.category !== 'DA' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {['Hotel', 'Flight', 'Train', 'Cab'].includes(policy.category) ? 'Yes' : 'Optional'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDate(policy.effectiveFrom)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(policy.effectiveTo)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {policy.version}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${policy.active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                          {policy.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{policy.changedBy}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(policy.changedOn)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isSuperAdmin && (
                            <button
                              onClick={() => openEdit(policy)}
                              className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {history.length > 0 && (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : policy.id)}
                              className="rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              {isExpanded ? 'Hide' : `History (${history.length})`}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Historical versions */}
                    {isExpanded && history.length > 0 && (
                      <tr>
                        <td colSpan={15} className="bg-amber-50/50 px-8 py-3">
                          <div className="text-xs font-semibold text-amber-800 mb-2">Version History</div>
                          <div className="space-y-2">
                            {[...history].reverse().map((ver, idx) => (
                              <div key={idx} className="flex items-start gap-4 rounded-lg bg-white border border-amber-200 px-4 py-2.5 text-xs">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold flex-shrink-0">
                                  v{ver.version}
                                </span>
                                <div className="flex-1 grid grid-cols-4 gap-2">
                                  <div><span className="text-gray-400">Max Amount:</span> <span className="font-medium">{fmt(ver.maxAmountPerDay ?? ver.maxAmountPerNight, ver.currency)}</span></div>
                                  <div><span className="text-gray-400">Effective:</span> <span className="font-medium">{fmtDate(ver.effectiveFrom)}</span></div>
                                  <div><span className="text-gray-400">Changed By:</span> <span className="font-medium">{ver.changedBy}</span></div>
                                  <div><span className="text-gray-400">Reason:</span> <span className="italic text-gray-600">{ver.reason ?? '—'}</span></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {showModal && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-indigo-50 px-6 py-4 border-b border-indigo-100">
              <div>
                <h2 className="text-base font-bold text-indigo-900">
                  {editTarget ? 'Edit Policy Rule' : 'Add New Rule'}
                </h2>
                {editTarget && (
                  <p className="mt-0.5 text-xs text-indigo-600">{editTarget.name} — v{editTarget.version} → v{editTarget.version + 1}</p>
                )}
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rule Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expense Type</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {EXPENSE_TYPES.filter((t) => t !== 'All').map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Applicable To <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. India Metro, International Dubai"
                    value={form.applicableTo} onChange={(e) => setForm({ ...form, applicableTo: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.applicableTo ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.applicableTo && <p className="mt-1 text-xs text-red-500">{formErrors.applicableTo}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Amount</label>
                  <input type="number" placeholder="0" value={form.maxAmount}
                    onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Effective From <span className="text-red-500">*</span></label>
                  <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.effectiveFrom ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.effectiveFrom && <p className="mt-1 text-xs text-red-500">{formErrors.effectiveFrom}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Effective To</label>
                  <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Policy notes visible to admins..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason for Change <span className="text-red-500">*</span>
                  </label>
                  <textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Provide a reason for this change (required for audit trail)..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${formErrors.reason ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.reason && <p className="mt-1 text-xs text-red-500">{formErrors.reason}</p>}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60">
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  editTarget ? 'Save Changes' : 'Create Rule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

