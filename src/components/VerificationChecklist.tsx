import React, { useState, useCallback, useMemo } from 'react';
import {
  CheckSquare, Square, ChevronDown, ChevronRight,
  User, MapPin, DollarSign, Hotel, Car, Paperclip,
  ShieldCheck, Copy, AlertOctagon, BookOpen, MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import type { ClaimHeader, ClaimLineItem, ClaimAttachment, TravelLeg } from '../types';

interface VerificationChecklistProps {
  claim: ClaimHeader;
  lineItems: ClaimLineItem[];
  attachments: ClaimAttachment[];
  travelLegs: TravelLeg[];
  onCheckChange?: (key: string, checked: boolean) => void;
}

interface CheckItem {
  key: string;
  label: string;
  hint?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: CheckItem[];
}

function buildSections(
  claim: ClaimHeader,
  lineItems: ClaimLineItem[],
  attachments: ClaimAttachment[],
  travelLegs: TravelLeg[],
): Section[] {
  const missingReceipts = lineItems.filter((l) => l.receiptRequired && !l.receiptUploaded).length;
  const exceptions = lineItems.filter((l) => l.exceptionRequired).length;
  const cabItems = lineItems.filter((l) => l.expenseType === 'Cab').length;
  const duplicateFlag = claim.duplicateFlag ? ' ⚠ Duplicate flag active' : '';
  const mismatchFlag = claim.ledgerMismatchFlag ? ' ⚠ Ledger mismatch flag' : '';

  return [
    {
      id: 'trainer-info',
      title: 'Trainer & Assignment Info',
      icon: <User className="w-4 h-4" />,
      items: [
        { key: 'trainer-verified', label: 'Trainer identity and employee code verified' },
        { key: 'assignment-match', label: `Assignment IDs confirmed (${claim.assignmentIds.length} assignment${claim.assignmentIds.length !== 1 ? 's' : ''})` },
        { key: 'batch-match', label: `Batch IDs matched: ${claim.batchIds.join(', ')}` },
        { key: 'base-city', label: `Base city recorded: ${claim.baseCity}` },
        { key: 'claim-period', label: `Claim period verified: ${claim.claimStartDate} – ${claim.claimEndDate}` },
      ],
    },
    {
      id: 'travel-legs',
      title: 'Travel Legs & Journey Continuity',
      icon: <MapPin className="w-4 h-4" />,
      items: [
        { key: 'legs-count', label: `All ${travelLegs.length} travel leg${travelLegs.length !== 1 ? 's' : ''} reviewed` },
        { key: 'journey-continuity', label: 'Journey continuity verified (arrival city = next departure city)' },
        { key: 'mode-checked', label: 'Travel modes confirmed (Flight/Train/Bus/Cab)' },
        { key: 'pnr-checked', label: 'PNR/ticket numbers recorded for all legs' },
        { key: 'fares-policy', label: 'Fares compared against policy limits' },
      ],
    },
    {
      id: 'da-calculation',
      title: 'DA Calculation',
      icon: <DollarSign className="w-4 h-4" />,
      items: [
        { key: 'da-rate', label: 'DA rates applied per city tier (Metro/Tier1/Tier2/International)' },
        { key: 'leave-excluded', label: 'Leave days identified and excluded from DA' },
        { key: 'stayback-excluded', label: 'Personal stayback days excluded from DA' },
        { key: 'partial-day', label: 'Partial-day DA applied for departure and arrival days' },
        { key: 'da-total', label: `Total DA amount verified: ₹${claim.eligibleAmount.toLocaleString('en-IN')}` },
      ],
    },
    {
      id: 'lodging',
      title: 'Lodging Review',
      icon: <Hotel className="w-4 h-4" />,
      items: [
        { key: 'hotel-invoices', label: 'Hotel invoices reviewed for all nights' },
        { key: 'hotel-rate', label: 'Nightly rate within policy limit for city tier' },
        { key: 'stayback-lodging', label: 'Personal stayback nights excluded from lodging claim' },
        { key: 'company-booking', label: 'Company-provided accommodation deducted where applicable' },
      ],
    },
    {
      id: 'cab-conveyance',
      title: 'Cab & Conveyance',
      icon: <Car className="w-4 h-4" />,
      items: [
        { key: 'cab-eligible', label: `${cabItems} cab/conveyance item${cabItems !== 1 ? 's' : ''} reviewed for eligibility` },
        { key: 'cab-purpose', label: 'Purpose of each cab ride verified (business travel only)' },
        { key: 'cab-receipts', label: 'Cab receipts uploaded and legible' },
        { key: 'cab-limit', label: 'Per-trip cab amounts within policy cap' },
      ],
    },
    {
      id: 'attachments',
      title: 'Attachments & Documents',
      icon: <Paperclip className="w-4 h-4" />,
      items: [
        { key: 'attachments-count', label: `${attachments.length} attachment${attachments.length !== 1 ? 's' : ''} reviewed`, hint: 'Check all categories: Ticket, Boarding Pass, Hotel Invoice, Cab Receipt' },
        { key: 'missing-docs', label: `Missing documents addressed (${missingReceipts} item${missingReceipts !== 1 ? 's' : ''} without receipt)` },
        { key: 'attachments-legible', label: 'All uploaded files are legible and complete' },
        { key: 'boarding-pass', label: 'Boarding passes present for all flight legs' },
      ],
    },
    {
      id: 'policy-comparison',
      title: 'Policy Comparison',
      icon: <ShieldCheck className="w-4 h-4" />,
      items: [
        { key: 'policy-limits', label: 'Each line item compared against applicable policy limits' },
        { key: 'policy-version', label: 'Correct policy version applied for claim period' },
        { key: 'overruns-flagged', label: 'All policy overruns flagged with reason codes' },
        { key: 'currency-conversion', label: 'Currency conversions verified for international claims' },
      ],
    },
    {
      id: 'duplicate-check',
      title: 'Duplicate Check',
      icon: <Copy className="w-4 h-4" />,
      items: [
        { key: 'duplicate-scan', label: `Duplicate scan completed${duplicateFlag}` },
        { key: 'pnr-unique', label: 'PNR/ticket numbers are unique across claims' },
        { key: 'date-overlap', label: 'No overlapping claim periods for this trainer' },
      ],
    },
    {
      id: 'exceptions',
      title: 'Exception Handling',
      icon: <AlertOctagon className="w-4 h-4" />,
      items: [
        { key: 'exceptions-identified', label: `${exceptions} exception${exceptions !== 1 ? 's' : ''} identified and processed` },
        { key: 'exceptions-approved', label: 'All exceptions reviewed by authorized approver' },
        { key: 'exceptions-documented', label: 'Exception justifications documented' },
      ],
    },
    {
      id: 'ledger',
      title: 'Ledger Reconciliation',
      icon: <BookOpen className="w-4 h-4" />,
      items: [
        { key: 'ledger-match', label: `Claimed amount reconciled with accounting ledger${mismatchFlag}` },
        { key: 'advance-adjusted', label: `Advance adjusted: ₹${claim.advanceAdjusted.toLocaleString('en-IN')}` },
        { key: 'misc-adjustments', label: `Miscellaneous adjustments reviewed: ₹${claim.miscAdjustments.toLocaleString('en-IN')}` },
        { key: 'net-payable', label: `Net payable confirmed: ₹${claim.netPayable.toLocaleString('en-IN')}` },
      ],
    },
    {
      id: 'remarks',
      title: 'Employee Remarks',
      icon: <MessageSquare className="w-4 h-4" />,
      items: [
        { key: 'remarks-read', label: 'Trainer remarks read and noted' },
        { key: 'clarification-resolved', label: 'All clarification requests resolved' },
        { key: 'internal-notes', label: 'Internal HR/Finance notes added where needed' },
      ],
    },
  ];
}

export const VerificationChecklist: React.FC<VerificationChecklistProps> = ({
  claim,
  lineItems,
  attachments,
  travelLegs,
  onCheckChange,
}) => {
  const sections = useMemo(
    () => buildSections(claim, lineItems, attachments, travelLegs),
    [claim, lineItems, attachments, travelLegs],
  );

  const allKeys = useMemo(() => sections.flatMap((s) => s.items.map((i) => i.key)), [sections]);

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allKeys.map((k) => [k, false])),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true])),
  );

  const toggle = useCallback((key: string) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      onCheckChange?.(key, next[key]);
      return next;
    });
  }, [onCheckChange]);

  const toggleSection = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const totalChecked = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const totalItems = allKeys.length;
  const pct = Math.round((totalChecked / totalItems) * 100);

  const sectionProgress = useCallback((section: Section) => {
    const keys = section.items.map((i) => i.key);
    const done = keys.filter((k) => checked[k]).length;
    return { done, total: keys.length };
  }, [checked]);

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-5 h-5 ${pct === 100 ? 'text-green-500' : 'text-gray-300'}`} />
            <span className="font-semibold text-gray-800">Verification Progress</span>
          </div>
          <span className={`text-sm font-bold ${pct === 100 ? 'text-green-600' : 'text-indigo-600'}`}>
            {totalChecked}/{totalItems} ({pct}%)
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct === 100 && (
          <div className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            All checks complete — ready for approval
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const { done, total } = sectionProgress(section);
          const isOpen = expanded[section.id];
          const allDone = done === total;

          return (
            <div key={section.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${allDone ? 'border-green-200' : 'border-gray-200'}`}>
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${allDone ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'}`}
              >
                <span className={`flex-shrink-0 ${allDone ? 'text-green-600' : 'text-indigo-500'}`}>{section.icon}</span>
                <span className="flex-1 font-semibold text-sm text-gray-800">{section.title}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allDone ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {done}/{total}
                </span>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
              </button>

              {/* Section items */}
              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {section.items.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors group"
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked[item.key] ?? false}
                        onChange={() => toggle(item.key)}
                      />
                      <span className={`flex-shrink-0 mt-0.5 ${checked[item.key] ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                        {checked[item.key] ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${checked[item.key] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {item.label}
                        </span>
                        {item.hint && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.hint}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VerificationChecklist;

