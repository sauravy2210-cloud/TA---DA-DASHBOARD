import { useState, useEffect } from 'react';
import { User, Mail, BadgeCheck, Save, MapPin, Loader2, RefreshCw, AlertCircle, CreditCard, Calendar, Info, CheckCircle2, XCircle, Building2, Phone, ShieldCheck } from 'lucide-react';
import type { User as UserType, PmsEmployeeDetails } from '../types';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white';
const readonlyCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed select-none';

const STORAGE_KEY = (empCode: string) => `trainer_profile_manual_${empCode}`;

function Field({ label, children, required, fromPms }: { label: string; children: React.ReactNode; required?: boolean; fromPms?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {fromPms && <span className="text-[9px] text-blue-400 font-normal ml-1 bg-blue-50 px-1 rounded">PMS</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

async function refetchPmsDetails(empCode: string): Promise<PmsEmployeeDetails> {
  const code = empCode.replace(/^EMP-/i, '').trim();
  const res = await fetch(`/api/employee?empCode=${encodeURIComponent(code)}`);
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Could not load profile');
  if (!d.employee) throw new Error('No employee record found');
  return d.employee as PmsEmployeeDetails;
}

function pick(obj: PmsEmployeeDetails, ...keys: string[]): string {
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null') {
      return String(v).trim();
    }
  }
  return '';
}

function fmt(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface FormData {
  name: string; email: string; phone: string; empCode: string;
  designation: string; department: string; gender: string;
  dateOfBirth: string; joiningDate: string; reportingManager: string; panNumber: string;
  baseCity: string; state: string; country: string; address: string; pinCode: string;
  bankName: string; accountNumber: string; ifsc: string; branchName: string;
  accountType: string; upiId: string;
}

function buildForm(p: PmsEmployeeDetails | null, empCode: string, fallbackUser: UserType): FormData {
  if (!p) return {
    name: fallbackUser.name ?? '', email: fallbackUser.email ?? '',
    phone: '', empCode,
    designation: '', department: '', gender: '',
    dateOfBirth: '', joiningDate: '', reportingManager: '', panNumber: '',
    baseCity: '', state: '', country: '', address: '', pinCode: '',
    bankName: '', accountNumber: '', ifsc: '', branchName: '', accountType: '', upiId: '',
  };

  const firstName  = pick(p, 'first_name');
  const middleName = pick(p, 'middle_name');
  const lastName   = pick(p, 'last_name');
  const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || fallbackUser.name;

  return {
    name:             fullName,
    email:            pick(p, 'email_address') || fallbackUser.email,
    phone:            pick(p, 'mobile_number', 'phone_number', 'MobileNumber', 'PhoneNumber',
                          'contact_number', 'ContactNumber', 'mobile', 'phone', 'cell_number',
                          'CellNumber', 'cell', 'Cell', 'work_phone', 'WorkPhone'),
    empCode,
    designation:      pick(p, 'designation_name', 'designation', 'Designation',
                          'job_title', 'JobTitle', 'position', 'Position', 'role', 'Role'),
    department:       pick(p, 'deparment_name', 'department_name', 'department', 'Department',
                          'DepartmentName', 'dept_name', 'DeptName', 'dept', 'Dept'),
    baseCity:         pick(p, 'city_name', 'CityName', 'city', 'City', 'base_city', 'BaseCity',
                          'current_city', 'CurrentCity', 'work_city', 'WorkCity'),
    state:            pick(p, 'state_name', 'StateName', 'state', 'State', 'province', 'Province'),
    country:          pick(p, 'country_name', 'CountryName', 'country', 'Country', 'nationality', 'Nationality'),
    address:          pick(p, 'address_details', 'AddressDetails', 'address', 'Address',
                          'permanent_address', 'PermanentAddress', 'current_address', 'CurrentAddress',
                          'residential_address', 'ResidentialAddress', 'addr', 'Addr'),
    pinCode:          pick(p, 'address_pin_code', 'AddressPinCode', 'pin_code', 'PinCode',
                          'pincode', 'Pincode', 'postal_code', 'PostalCode', 'zip', 'Zip'),
    reportingManager: pick(p, 'manager_name', 'ManagerName', 'reporting_manager',
                          'ReportingManager', 'manager', 'Manager', 'supervisor', 'Supervisor',
                          'reporting_to', 'ReportingTo', 'reports_to', 'ReportsTo'),
    joiningDate:      pick(p, 'joining_date', 'JoiningDate', 'date_of_joining', 'DateOfJoining',
                          'doj', 'DOJ', 'join_date', 'JoinDate'),
    dateOfBirth:      pick(p, 'date_of_birth', 'DateOfBirth', 'dob', 'DOB',
                          'birth_date', 'BirthDate', 'birthday', 'Birthday'),
    gender:           pick(p, 'gender', 'Gender', 'sex', 'Sex', 'gender_name', 'GenderName'),
    panNumber:        pick(p, 'pan_number', 'PanNumber', 'pan', 'PAN', 'pan_no', 'PanNo',
                          'pan_card', 'PanCard', 'income_tax_pan', 'IncomeTaxPan'),
    bankName:         pick(p, 'bank_name', 'BankName', 'bank', 'Bank', 'bank_nm', 'BankNm'),
    accountNumber:    pick(p, 'bank_account_no', 'BankAccountNo', 'account_number', 'AccountNumber',
                          'account_no', 'AccountNo', 'acc_no', 'AccNo', 'account', 'Account'),
    ifsc:             pick(p, 'bank_ifsc_code', 'BankIfscCode', 'ifsc_code', 'IfscCode',
                          'ifsc', 'IFSC', 'bank_ifsc', 'BankIfsc'),
    branchName:       pick(p, 'bank_branch', 'BankBranch', 'branch_name', 'BranchName',
                          'branch', 'Branch'),
    accountType:      pick(p, 'account_type', 'AccountType', 'bank_account_type', 'BankAccountType'),
    upiId:            pick(p, 'upi_id', 'UpiId', 'upi', 'UPI', 'vpa', 'VPA'),
  };
}

function mergeWithSaved(base: FormData, saved: Partial<FormData>): FormData {
  const result = { ...base };
  for (const k of Object.keys(saved) as (keyof FormData)[]) {
    if (!result[k] && saved[k]) result[k] = saved[k] as string;
  }
  return result;
}

const MANUALLY_EDITABLE: (keyof FormData)[] = [
  'phone', 'gender', 'dateOfBirth', 'joiningDate', 'panNumber',
  'bankName', 'accountNumber', 'ifsc', 'branchName', 'accountType', 'upiId',
  'address', 'pinCode', 'state', 'country',
];

export default function TrainerProfile({ currentUser }: { currentUser: UserType }) {
  const empCode = (currentUser.trainerId ?? '').replace(/^EMP-/i, '').trim();

  const [pms, setPms] = useState<PmsEmployeeDetails | null>(currentUser.pmsDetails ?? null);
  const [loading, setLoading] = useState(!currentUser.pmsDetails);
  const [fetchError, setFetchError] = useState('');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<FormData>(() => {
    const base = buildForm(currentUser.pmsDetails ?? null, empCode, currentUser);
    try {
      const stored = localStorage.getItem(STORAGE_KEY(empCode));
      if (stored) return mergeWithSaved(base, JSON.parse(stored));
    } catch { /* ignore */ }
    return base;
  });

  // Track which fields came from PMS (non-empty after buildForm)
  const [pmsFields] = useState<Set<keyof FormData>>(() => {
    const base = buildForm(currentUser.pmsDetails ?? null, empCode, currentUser);
    return new Set(Object.keys(base).filter(k => !!(base as Record<string, string>)[k]) as (keyof FormData)[]);
  });

  useEffect(() => {
    if (currentUser.pmsDetails) {
      setPms(currentUser.pmsDetails);
      const base = buildForm(currentUser.pmsDetails, empCode, currentUser);
      try {
        const stored = localStorage.getItem(STORAGE_KEY(empCode));
        if (stored) { setForm(mergeWithSaved(base, JSON.parse(stored))); return; }
      } catch { /* ignore */ }
      setForm(base);
      setLoading(false);
      return;
    }
    if (!empCode) { setLoading(false); return; }
    setLoading(true);
    refetchPmsDetails(empCode)
      .then(data => {
        setPms(data);
        const base = buildForm(data, empCode, currentUser);
        try {
          const stored = localStorage.getItem(STORAGE_KEY(empCode));
          if (stored) { setForm(mergeWithSaved(base, JSON.parse(stored))); return; }
        } catch { /* ignore */ }
        setForm(base);
      })
      .catch(err => setFetchError(err.message || 'Could not load profile from PMS'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empCode]);

  function handleRefresh() {
    if (!empCode) return;
    setLoading(true); setFetchError('');
    refetchPmsDetails(empCode)
      .then(data => {
        setPms(data);
        const base = buildForm(data, empCode, currentUser);
        try {
          const stored = localStorage.getItem(STORAGE_KEY(empCode));
          if (stored) { setForm(mergeWithSaved(base, JSON.parse(stored))); return; }
        } catch { /* ignore */ }
        setForm(base);
      })
      .catch(err => setFetchError(err.message || 'Refresh failed'))
      .finally(() => setLoading(false));
  }

  function handleSave() {
    // Persist only manually-editable fields to localStorage
    const toSave: Partial<FormData> = {};
    for (const k of MANUALLY_EDITABLE) {
      if (form[k]) toSave[k] = form[k];
    }
    try {
      localStorage.setItem(STORAGE_KEY(empCode), JSON.stringify(toSave));
    } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const set = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }));

  const fromPms = (key: keyof FormData) => pmsFields.has(key);

  // Profile completeness
  const importantFields: (keyof FormData)[] = [
    'name', 'email', 'phone', 'designation', 'department', 'gender',
    'baseCity', 'state', 'country', 'address', 'pinCode',
    'bankName', 'accountNumber', 'ifsc',
  ];
  const filledCount = importantFields.filter(k => !!form[k]).length;
  const completeness = Math.round((filledCount / importantFields.length) * 100);

  const initials = form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || currentUser.avatarInitials || 'TR';

  function inputField(key: keyof FormData, placeholder: string, type = 'text') {
    const isFromPms = fromPms(key);
    return (
      <input
        className={isFromPms ? readonlyCls : inputCls}
        type={type}
        value={form[key] || ''}
        readOnly={isFromPms}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const accountTypeOptions = ['Savings', 'Current', 'Salary'];

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">My Profile</h1>
        <button type="button" onClick={handleRefresh} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh from PMS'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 mb-4">
          <Loader2 size={16} className="animate-spin flex-shrink-0" />
          Fetching your details from Koenig PMS…
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>{fetchError} — fields below may show incomplete data.</span>
        </div>
      )}

      {/* PMS badge */}
      {pms && !loading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 mb-4">
          <BadgeCheck size={13} />
          Profile auto-filled from Koenig PMS (EMP-{empCode})
          <span className="ml-auto text-gray-400">Fields marked <span className="text-blue-400 font-semibold">PMS</span> are system-managed</span>
        </div>
      )}

      {/* Profile completeness */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600">Profile Completeness</span>
          <span className={`text-xs font-bold ${completeness >= 80 ? 'text-green-600' : completeness >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
            {completeness}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${completeness >= 80 ? 'bg-green-500' : completeness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {importantFields.map(k => {
            const filled = !!form[k];
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            return (
              <span key={k} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${filled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                {filled ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Avatar card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 mb-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-gray-800">{form.name}</p>
          <p className="text-sm text-gray-500">
            {[form.designation, form.department].filter(Boolean).join(' · ') || 'Trainer'}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <BadgeCheck size={12} /> Active
            </span>
            {form.empCode && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-mono">
                EMP-{form.empCode}
              </span>
            )}
            {form.baseCity && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                <MapPin size={10} /> {form.baseCity}
              </span>
            )}
            {form.joiningDate && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                <Calendar size={10} /> Since {fmt(form.joiningDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <Section icon={<User size={13} />} title="Personal Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name" fromPms={fromPms('name')}>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Employee Code">
            <input className={readonlyCls} value={`EMP-${form.empCode}`} readOnly />
          </Field>
          <Field label="Designation" fromPms={fromPms('designation')}>
            {inputField('designation', 'e.g. Senior Trainer')}
          </Field>
          <Field label="Department" fromPms={fromPms('department')}>
            {inputField('department', 'e.g. Technical Training')}
          </Field>
          <Field label="Gender" required>
            {fromPms('gender') ? (
              <input className={readonlyCls} value={form.gender} readOnly />
            ) : (
              <select
                className={inputCls}
                value={form.gender || ''}
                onChange={e => set('gender', e.target.value)}
              >
                <option value="">— Select Gender —</option>
                {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
          </Field>
          <Field label="Reporting Manager" fromPms={fromPms('reportingManager')}>
            {inputField('reportingManager', '—')}
          </Field>
          <Field label="Date of Birth">
            {form.dateOfBirth && fromPms('dateOfBirth') ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                {fmt(form.dateOfBirth) || form.dateOfBirth}
              </div>
            ) : (
              <input className={inputCls} type="date" value={form.dateOfBirth || ''}
                onChange={e => set('dateOfBirth', e.target.value)} />
            )}
          </Field>
          <Field label="Date of Joining" fromPms={fromPms('joiningDate')}>
            {form.joiningDate && fromPms('joiningDate') ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                {fmt(form.joiningDate) || form.joiningDate}
              </div>
            ) : (
              <input className={inputCls} type="date" value={form.joiningDate || ''}
                onChange={e => set('joiningDate', e.target.value)} />
            )}
          </Field>
          <Field label="PAN Number" fromPms={fromPms('panNumber')}>
            <input
              className={fromPms('panNumber') ? readonlyCls : inputCls}
              value={form.panNumber || ''}
              readOnly={fromPms('panNumber')}
              onChange={e => set('panNumber', e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE1234F"
              maxLength={10}
            />
          </Field>
        </div>
      </Section>

      {/* Contact Details */}
      <Section icon={<Phone size={13} />} title="Contact Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email Address" fromPms>
            <input className={readonlyCls} value={form.email} readOnly />
          </Field>
          <Field label="Mobile Number" required>
            <input
              className={fromPms('phone') ? readonlyCls : inputCls}
              type="tel"
              value={form.phone || ''}
              readOnly={fromPms('phone')}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section icon={<MapPin size={13} />} title="Address">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Address" fromPms={fromPms('address')}>
              <input
                className={fromPms('address') ? readonlyCls : inputCls}
                value={form.address || ''}
                readOnly={fromPms('address')}
                onChange={e => set('address', e.target.value)}
                placeholder="House No., Street, Village, Locality"
              />
            </Field>
          </div>
          <Field label="City" fromPms={fromPms('baseCity')}>
            {inputField('baseCity', 'e.g. Bangalore')}
          </Field>
          <Field label="State" fromPms={fromPms('state')}>
            {inputField('state', 'e.g. Karnataka')}
          </Field>
          <Field label="Country" fromPms={fromPms('country')}>
            {inputField('country', 'e.g. India')}
          </Field>
          <Field label="PIN Code" fromPms={fromPms('pinCode')}>
            <input
              className={fromPms('pinCode') ? readonlyCls : inputCls}
              value={form.pinCode || ''}
              readOnly={fromPms('pinCode')}
              onChange={e => set('pinCode', e.target.value)}
              placeholder="e.g. 560001"
              maxLength={6}
            />
          </Field>
        </div>
      </Section>

      {/* Bank Details */}
      <Section icon={<CreditCard size={13} />} title="Bank Details (for TA/DA Payment)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank Name" required fromPms={fromPms('bankName')}>
            <input
              className={fromPms('bankName') ? readonlyCls : inputCls}
              value={form.bankName || ''}
              readOnly={fromPms('bankName')}
              onChange={e => set('bankName', e.target.value)}
              placeholder="e.g. HDFC Bank"
            />
          </Field>
          <Field label="Account Number" required fromPms={fromPms('accountNumber')}>
            <input
              className={fromPms('accountNumber') ? readonlyCls : inputCls}
              value={form.accountNumber || ''}
              readOnly={fromPms('accountNumber')}
              onChange={e => set('accountNumber', e.target.value)}
              placeholder="e.g. 1234 5678 9012"
            />
          </Field>
          <Field label="IFSC Code" required fromPms={fromPms('ifsc')}>
            <input
              className={fromPms('ifsc') ? readonlyCls : inputCls}
              value={form.ifsc || ''}
              readOnly={fromPms('ifsc')}
              onChange={e => set('ifsc', e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              maxLength={11}
            />
          </Field>
          <Field label="Branch Name" fromPms={fromPms('branchName')}>
            <input
              className={fromPms('branchName') ? readonlyCls : inputCls}
              value={form.branchName || ''}
              readOnly={fromPms('branchName')}
              onChange={e => set('branchName', e.target.value)}
              placeholder="e.g. MG Road, Bangalore"
            />
          </Field>
          <Field label="Account Type" fromPms={fromPms('accountType')}>
            {fromPms('accountType') ? (
              <input className={readonlyCls} value={form.accountType} readOnly />
            ) : (
              <select className={inputCls} value={form.accountType || ''}
                onChange={e => set('accountType', e.target.value)}>
                <option value="">— Select Type —</option>
                {accountTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </Field>
          <Field label="UPI ID / VPA">
            <input className={inputCls} value={form.upiId || ''}
              onChange={e => set('upiId', e.target.value)}
              placeholder="e.g. name@upi" />
          </Field>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-center gap-2">
          <Info size={12} className="flex-shrink-0" />
          Bank details are used for TA/DA disbursement. Contact HR to update account information if incorrect.
        </p>
      </Section>

      {/* Professional Summary — PMS-sourced read-only */}
      {pms && (form.reportingManager || form.joiningDate || form.designation) && (
        <Section icon={<ShieldCheck size={13} />} title="Professional Summary">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Designation', value: form.designation },
              { label: 'Department', value: form.department },
              { label: 'Reporting Manager', value: form.reportingManager },
              { label: 'Base City', value: form.baseCity },
              { label: 'Date of Joining', value: form.joiningDate ? fmt(form.joiningDate) : '' },
              { label: 'PAN Number', value: form.panNumber },
            ].filter(i => i.value).map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* All PMS raw fields — debug */}
      {pms && (
        <details className="mb-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 px-1 py-2 select-none">
            View all fields received from Koenig PMS ({Object.keys(pms).length} fields)
          </summary>
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl overflow-x-auto">
            <table className="min-w-full text-xs divide-y divide-gray-100">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Field</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(pms).map(([k, v]) => (
                  <tr key={k} className="hover:bg-white">
                    <td className="px-3 py-1.5 font-mono text-gray-500">{k}</td>
                    <td className="px-3 py-1.5 text-gray-700">
                      {v != null && String(v) !== '' ? String(v) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Save button */}
      <button type="button" onClick={handleSave}
        className="w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
        style={{ background: saved ? '#16a34a' : '#2563eb' }}>
        {saved
          ? <><BadgeCheck size={16} /> Profile Saved!</>
          : <><Save size={16} /> Save Profile</>}
      </button>
      <p className="text-center text-[11px] text-gray-400 mt-2">
        Manually entered fields (Gender, Mobile, Bank details) are saved locally on this device.
      </p>
    </div>
  );
}
