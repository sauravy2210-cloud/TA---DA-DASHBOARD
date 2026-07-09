import { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Plane, Hotel, Car,
  IndianRupee, Clock, AlertTriangle, CheckCircle2, FileText,
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function Accordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          {section.icon}
        </span>
        <span className="flex-1 font-semibold text-gray-800 text-sm">{section.title}</span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 text-sm text-gray-600 leading-relaxed space-y-2">
          {section.content}
        </div>
      )}
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: 'eligibility',
    icon: <CheckCircle2 size={16} />,
    title: 'Eligibility for TA/DA Claims',
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li>Claims can be raised only for completed or ongoing assignments.</li>
        <li>Trainer must be officially assigned to the batch in the CRM system.</li>
        <li>Claims must be submitted within <strong>30 days</strong> of the assignment end date.</li>
        <li>International assignments require prior approval from HR before travel.</li>
      </ul>
    ),
  },
  {
    id: 'travel',
    icon: <Plane size={16} />,
    title: 'Travel Allowance Policy',
    content: (
      <div className="space-y-3">
        <p>Travel reimbursement is provided for the most economical mode of transport available.</p>
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              {['Mode', 'Class Allowed', 'Max Reimbursable'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Flight', 'Economy', 'As per actuals with approval'],
              ['Train', 'AC 2-Tier (2A)', 'As per actuals'],
              ['Bus', 'AC Sleeper / Volvo', '₹2,000 per leg'],
              ['Cab / Own Vehicle', '—', '₹12 per km'],
            ].map(([mode, cls, max]) => (
              <tr key={mode}>
                <td className="px-3 py-2 font-medium text-gray-700">{mode}</td>
                <td className="px-3 py-2 text-gray-500">{cls}</td>
                <td className="px-3 py-2 text-gray-700">{max}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <strong>Note:</strong> Flight bookings above ₹15,000 require prior approval. Original tickets/PNR must be attached.
        </p>
      </div>
    ),
  },
  {
    id: 'da',
    icon: <IndianRupee size={16} />,
    title: 'Daily Allowance (DA) Policy',
    content: (
      <div className="space-y-2">
        <p>DA is provided for each working day of the assignment at the following rates:</p>
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              {['Day Type', 'Rate'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Full day (outstation)', '₹1,000'],
              ['Half day (travel day — first/last)', '₹500'],
              ['International assignment', '₹3,000 / day or as per country policy'],
              ['Leave / personal stayback', 'No DA'],
            ].map(([type, rate]) => (
              <tr key={type}>
                <td className="px-3 py-2 text-gray-700">{type}</td>
                <td className="px-3 py-2 font-semibold text-green-700">{rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'lodging',
    icon: <Hotel size={16} />,
    title: 'Lodging / Hotel Policy',
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li>Hotel reimbursement is allowed for outstation assignments only (city ≠ base city).</li>
        <li>Maximum rate: <strong>₹3,500 per night</strong> for Tier-1 cities; <strong>₹2,500</strong> for Tier-2/3.</li>
        <li>Company-provided or client-provided accommodation — no reimbursement allowed.</li>
        <li>Original hotel invoice/GST bill must be attached.</li>
        <li>Stay claimed must match assignment dates (± 1 day for travel).</li>
      </ul>
    ),
  },
  {
    id: 'conveyance',
    icon: <Car size={16} />,
    title: 'Local Conveyance Policy',
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li>Cab/auto receipts are required for all claims above ₹200.</li>
        <li>App-based cab receipts (Ola, Uber) are accepted.</li>
        <li>Maximum conveyance per day: <strong>₹1,500</strong> (domestic), <strong>₹3,000</strong> (international).</li>
        <li>Personal vehicle usage: ₹12 per km with odometer proof.</li>
      </ul>
    ),
  },
  {
    id: 'deadlines',
    icon: <Clock size={16} />,
    title: 'Submission Deadlines',
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li>Claims must be submitted within <strong>30 calendar days</strong> of assignment completion.</li>
        <li>Late submissions require HOD approval and will be processed in the next payment cycle.</li>
        <li>Claims older than 90 days will not be accepted under any circumstances.</li>
        <li>Claim period start date: earliest 1 day before assignment start.</li>
      </ul>
    ),
  },
  {
    id: 'docs',
    icon: <FileText size={16} />,
    title: 'Required Documents',
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li>Travel tickets / PNR for all legs of journey.</li>
        <li>Hotel invoice with GST number and trainer name.</li>
        <li>Cab/conveyance receipts for each trip.</li>
        <li>Meal/other expense receipts where applicable.</li>
        <li>Visa/travel insurance copies for international travel.</li>
        <li>Accepted formats: PDF, JPG, PNG (max 5 MB per file).</li>
      </ul>
    ),
  },
  {
    id: 'escalation',
    icon: <AlertTriangle size={16} />,
    title: 'Escalation & Disputes',
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li>If a claim is rejected, the trainer receives a notification with the reason.</li>
        <li>Disputes can be raised within <strong>7 days</strong> of rejection via the Clarification module.</li>
        <li>Escalate unresolved disputes to <a href="mailto:hr@koenig-solutions.com" className="text-blue-600 hover:underline">hr@koenig-solutions.com</a>.</li>
        <li>SLA for HR review: <strong>5 working days</strong> from submission.</li>
        <li>SLA for Finance payment: <strong>10 working days</strong> from approval.</li>
      </ul>
    ),
  },
];

export default function HelpPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Help & Policy Guidelines</h1>
          <p className="text-sm text-gray-500">Koenig Solutions — TA/DA reimbursement policies</p>
        </div>
      </div>

      <div className="mt-2 mb-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        Click any section below to expand and read the policy details.
      </div>

      <div className="space-y-3">
        {SECTIONS.map(s => <Accordion key={s.id} section={s} />)}
      </div>

      <p className="text-xs text-gray-400 text-center mt-8">
        Last updated: June 2026 · For queries contact <a href="mailto:hr@koenig-solutions.com" className="text-blue-500 hover:underline">hr@koenig-solutions.com</a>
      </p>
    </div>
  );
}
