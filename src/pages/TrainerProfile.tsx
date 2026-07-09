import { useState, useEffect } from 'react';
import { User, Mail, BadgeCheck, Save, MapPin, Loader2, RefreshCw, AlertCircle, CreditCard, Calendar, Info } from 'lucide-react';
import type { User as UserType, PmsEmployeeDetails } from '../types';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white';
const readonlyCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed select-none';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
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

// Re-fetch employee details via server-side endpoint (credentials never in browser)
async function refetchPmsDetails(empCode: string): Promise<PmsEmployeeDetails> {
  const code = empCode.replace(/^EMP-/i, '').trim();
  const res = await fetch(`/api/employee?empCode=${encodeURIComponent(code)}`);
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Could not load profile');
  if (!d.employee) throw new Error('No employee record found');
  return d.employee as PmsEmployeeDetails;
}

// Safely pick first non-empty value from multiple field names
function pick(obj: PmsEmployeeDetails, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
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

export default function TrainerProfile({ currentUser }: { currentUser: UserType }) {
  const empCode = (currentUser.trainerId ?? '').replace(/^EMP-/i, '').trim();

  const [pms, setPms] = useState<PmsEmployeeDetails | null>(currentUser.pmsDetails ?? null);
  const [loading, setLoading] = useState(!currentUser.pmsDetails);
  const [fetchError, setFetchError] = useState('');
  const [saved, setSaved] = useState(false);

  // Derive display values from PMS data
  function buildForm(p: PmsEmployeeDetails | null) {
    if (!p) return {
      name: currentUser.name ?? '',
      email: currentUser.email ?? '',
      phone: '',
      empCode: empCode,
      designation: '',
      department: '',
      baseCity: '',
      state: '',
      country: '',
      address: '',
      pinCode: '',
      reportingManager: '',
      joiningDate: '',
      dateOfBirth: '',
      gender: '',
      panNumber: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
    };

    const firstName  = pick(p, 'first_name');
    const middleName = pick(p, 'middle_name');
    const lastName   = pick(p, 'last_name');
    const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || currentUser.name;

    return {
      name:             fullName,
      email:            pick(p, 'email_address') || currentUser.email,
      phone:            pick(p, 'mobile_number', 'phone_number', 'MobileNumber', 'PhoneNumber', 'contact_number', 'ContactNumber', 'mobile', 'phone'),
      empCode:          empCode,
      // "designation_name" is the actual field the API returns
      designation:      pick(p, 'designation_name', 'designation', 'Designation', 'job_title', 'JobTitle', 'position', 'Position'),
      // "deparment_name" is the actual field the API returns (note: API has a typo — no 't')
      department:       pick(p, 'deparment_name', 'department_name', 'department', 'Department', 'DepartmentName', 'dept_name', 'DeptName'),
      baseCity:         pick(p, 'city_name', 'CityName', 'city', 'City', 'base_city', 'BaseCity'),
      state:            pick(p, 'state_name', 'StateName', 'state', 'State'),
      country:          pick(p, 'country_name', 'CountryName', 'country', 'Country'),
      address:          pick(p, 'address_details', 'AddressDetails', 'address', 'Address', 'permanent_address', 'PermanentAddress'),
      pinCode:          pick(p, 'address_pin_code', 'AddressPinCode', 'pin_code', 'PinCode', 'pincode', 'Pincode', 'postal_code'),
      reportingManager: pick(p, 'manager_name', 'ManagerName', 'reporting_manager', 'ReportingManager', 'manager', 'Manager'),
      joiningDate:      pick(p, 'joining_date', 'JoiningDate', 'date_of_joining', 'DateOfJoining', 'doj', 'DOJ'),
      dateOfBirth:      pick(p, 'date_of_birth', 'DateOfBirth', 'dob', 'DOB', 'birth_date', 'BirthDate'),
      gender:           pick(p, 'gender', 'Gender', 'sex', 'Sex'),
      panNumber:        pick(p, 'pan_number', 'PanNumber', 'pan', 'PAN', 'pan_no', 'PanNo'),
      bankName:         pick(p, 'bank_name', 'BankName', 'bank', 'Bank'),
      accountNumber:    pick(p, 'bank_account_no', 'BankAccountNo', 'account_number', 'AccountNumber', 'account_no', 'AccountNo'),
      ifsc:             pick(p, 'bank_ifsc_code', 'BankIfscCode', 'ifsc_code', 'IfscCode', 'ifsc', 'IFSC'),
    };
  }

  const [form, setForm] = useState(() => buildForm(currentUser.pmsDetails ?? null));

  // Auto-fetch PMS details if not already available
  useEffect(() => {
    if (currentUser.pmsDetails) {
      setPms(currentUser.pmsDetails);
      setForm(buildForm(currentUser.pmsDetails));
      setLoading(false);
      return;
    }
    if (!empCode) { setLoading(false); return; }
    setLoading(true);
    refetchPmsDetails(empCode)
      .then(data => {
        setPms(data);
        setForm(buildForm(data));
      })
      .catch(err => setFetchError(err.message || 'Could not load profile from PMS'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empCode]);

  function handleRefresh() {
    if (!empCode) return;
    setLoading(true);
    setFetchError('');
    refetchPmsDetails(empCode)
      .then(data => {
        setPms(data);
        setForm(buildForm(data));
      })
      .catch(err => setFetchError(err.message || 'Refresh failed'))
      .finally(() => setLoading(false));
  }

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const initials = form.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || currentUser.avatarInitials || 'TR';

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">My Profile</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh from PMS'}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 mb-4">
          <Loader2 size={16} className="animate-spin flex-shrink-0" />
          Fetching your details from Koenig PMS…
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>{fetchError} — fields below may show incomplete data. Use "Refresh from PMS" to retry.</span>
        </div>
      )}

      {/* PMS source indicator */}
      {pms && !loading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 mb-4">
          <BadgeCheck size={13} />
          Profile auto-filled from Koenig PMS (EMP-{empCode}) · Read-only fields are system-managed
        </div>
      )}

      {/* Avatar card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 mb-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
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
          </div>
        </div>
      </div>

      {/* Personal details */}
      <Section icon={<User size={13} />} title="Personal Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name">
            <input className={inputCls} value={form.name}
              onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Employee Code">
            <input className={readonlyCls} value={`EMP-${form.empCode}`} readOnly />
          </Field>
          <Field label="Designation">
            <input className={form.designation ? readonlyCls : inputCls}
              value={form.designation || ''}
              readOnly={!!form.designation}
              onChange={e => set('designation', e.target.value)}
              placeholder="e.g. Senior Trainer" />
          </Field>
          <Field label="Department">
            <input className={form.department ? readonlyCls : inputCls}
              value={form.department || ''}
              readOnly={!!form.department}
              onChange={e => set('department', e.target.value)}
              placeholder="e.g. Technical Training" />
          </Field>
          <Field label="Gender">
            <input className={form.gender ? readonlyCls : inputCls}
              value={form.gender || ''}
              readOnly={!!form.gender}
              onChange={e => set('gender', e.target.value)}
              placeholder="—" />
          </Field>
          {form.dateOfBirth && (
            <Field label="Date of Birth">
              <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                {fmt(form.dateOfBirth) || form.dateOfBirth}
              </div>
            </Field>
          )}
          {form.joiningDate && (
            <Field label="Date of Joining">
              <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                {fmt(form.joiningDate) || form.joiningDate}
              </div>
            </Field>
          )}
          <Field label="Reporting Manager">
            <input className={form.reportingManager ? readonlyCls : inputCls}
              value={form.reportingManager || ''}
              readOnly={!!form.reportingManager}
              onChange={e => set('reportingManager', e.target.value)}
              placeholder="—" />
          </Field>
          {form.panNumber && (
            <Field label="PAN Number">
              <input className={readonlyCls} value={form.panNumber} readOnly />
            </Field>
          )}
        </div>
      </Section>

      {/* Contact details */}
      <Section icon={<Mail size={13} />} title="Contact Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email Address">
            <input className={readonlyCls} value={form.email} readOnly />
          </Field>
          <Field label="Mobile Number">
            <input className={form.phone ? readonlyCls : inputCls}
              type="tel"
              value={form.phone || ''}
              readOnly={!!form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. +91 98765 43210" />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section icon={<MapPin size={13} />} title="Address">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Address">
              <input className={form.address ? readonlyCls : inputCls}
                value={form.address || ''}
                readOnly={!!form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="—" />
            </Field>
          </div>
          <Field label="City">
            <input className={form.baseCity ? readonlyCls : inputCls}
              value={form.baseCity || ''}
              readOnly={!!form.baseCity}
              onChange={e => set('baseCity', e.target.value)}
              placeholder="—" />
          </Field>
          <Field label="State">
            <input className={form.state ? readonlyCls : inputCls}
              value={form.state || ''}
              readOnly={!!form.state}
              onChange={e => set('state', e.target.value)}
              placeholder="—" />
          </Field>
          <Field label="Country">
            <input className={form.country ? readonlyCls : inputCls}
              value={form.country || ''}
              readOnly={!!form.country}
              onChange={e => set('country', e.target.value)}
              placeholder="—" />
          </Field>
          <Field label="PIN Code">
            <input className={form.pinCode ? readonlyCls : inputCls}
              value={form.pinCode || ''}
              readOnly={!!form.pinCode}
              onChange={e => set('pinCode', e.target.value)}
              placeholder="—" />
          </Field>
        </div>
      </Section>

      {/* Bank details */}
      <Section icon={<CreditCard size={13} />} title="Bank Details (for TA/DA Payment)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank Name">
            <input className={form.bankName ? readonlyCls : inputCls}
              value={form.bankName || ''}
              readOnly={!!form.bankName}
              onChange={e => set('bankName', e.target.value)}
              placeholder="e.g. HDFC Bank" />
          </Field>
          <Field label="Account Number">
            <input className={form.accountNumber ? readonlyCls : inputCls}
              value={form.accountNumber || ''}
              readOnly={!!form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
              placeholder="e.g. XXXX XXXX 4321" />
          </Field>
          <Field label="IFSC Code">
            <input className={form.ifsc ? readonlyCls : inputCls}
              value={form.ifsc || ''}
              readOnly={!!form.ifsc}
              onChange={e => set('ifsc', e.target.value)}
              placeholder="e.g. HDFC0001234" />
          </Field>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-center gap-2">
          <Info size={12} className="flex-shrink-0" />
          Bank details are used for TA/DA disbursement. Contact HR to update account information if incorrect.
        </p>
      </Section>

      {/* All PMS fields — raw debug panel (collapsible) */}
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

      <button type="button" onClick={handleSave}
        className="w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-colors"
        style={{ background: saved ? '#16a34a' : '#2563eb' }}>
        {saved
          ? <><BadgeCheck size={16} /> Saved!</>
          : <><Save size={16} /> Save changes</>}
      </button>
    </div>
  );
}
