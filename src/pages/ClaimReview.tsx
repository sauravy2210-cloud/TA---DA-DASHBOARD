/**
 * ClaimReview.tsx
 * HR/Admin single-screen verification cockpit for a TA/DA claim!.
 * Two-column layout: left 60% (tabs) | right 40% (action panel, sticky).
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Copy,
  FileWarning,
  ChevronLeft,
  User,
  MapPin,
  Calendar,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  BookOpen,
  MessageSquare,
  Plane,
  Hotel,
  Car,
  Paperclip,
  ShieldCheck,
  BarChart2,
  Send,
  PauseCircle,
  ThumbsUp,
  Save,
} from 'lucide-react';

import type {
  User as UserType,
  ClaimLineItem,
  ClaimRemarks,
  LeaveRecord,
  Assignment,
  PolicyRule,
  AdvanceRecord,
  AdminDecision,
  TravelMode,
} from '../types';

// Data
import {
  mockClaims,
  mockLineItems,
  mockAttachments,
  mockStatusHistory,
  mockRemarks,
  mockExceptions,
  mockAuditLogs,
} from '../data/mockClaims';
import { mockUsers, mockLeaveRecords } from '../data/mockUsers';
import { mockAssignments } from '../data/mockAssignments';

// Services
import { logAction, ACTION_TYPES } from '../services/auditEngine';
import { saveToStorage, STORAGE_KEYS, getClaims, saveClaim } from '../services/storageService';
import { formatINR } from '../services/calculationEngine';

// Components
import StatusBadge from '../components/StatusBadge';
import VerificationChecklist from '../components/VerificationChecklist';
import ReasonCodeSelect from '../components/ReasonCodeSelect';
import AmountSummary from '../components/AmountSummary';
import AuditTimeline from '../components/AuditTimeline';
import RemarksPanel from '../components/RemarksPanel';
import ExceptionPanel from '../components/ExceptionPanel';
import LedgerPanel from '../components/LedgerPanel';
import AttachmentPreview from '../components/AttachmentPreview';
import PolicyComparison from '../components/PolicyComparison';
import TravelTimeline from '../components/TravelTimeline';
import DADayBreakdown from '../components/DADayBreakdown';
import LodgingStaybackPanel from '../components/LodgingStaybackPanel';
import CabConveyancePanel from '../components/CabConveyancePanel';
import ResourceLeavePanel from '../components/ResourceLeavePanel';
import React from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type TabId =
  | 'trainer'
  | 'travel'
  | 'da'
  | 'lodging'
  | 'cab'
  | 'attachments'
  | 'policy'
  | 'duplicate'
  | 'exceptions'
  | 'remarks'
  | 'ledger'
  | 'audit';

interface LineDecision {
  decision: AdminDecision;
  reasonCode: string;
  trainerRemark: string;
  internalRemark: string;
  approvedAmount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Build mock TravelLegs from line items
function buildTravelLegs(lineItems: ClaimLineItem[]) {
  return lineItems
    .filter((li) => li.expenseType === 'TA')
    .map((li) => ({
      legId: `leg-${li.lineItemId}`,
      claimId: li.claimId,
      from: li.description.includes('—')
        ? li.description.split('—')[1]?.split(' to ')[0]?.trim() ?? 'Origin'
        : 'Origin',
      to: li.description.includes(' to ')
        ? li.description.split(' to ')[1]?.split(' (')[0]?.trim() ?? 'Destination'
        : 'Destination',
      departureDate: li.date ?? '',
      departureTime: '08:00',
      arrivalDate: li.date ?? '',
      arrivalTime: '12:00',
      mode: (li.description.toLowerCase().includes('flight')
        ? 'Flight'
        : li.description.toLowerCase().includes('train')
        ? 'Train'
        : li.description.toLowerCase().includes('bus')
        ? 'Bus'
        : 'Cab') as TravelMode,
      ticketNo: li.receiptUploaded ? li.lineItemId : undefined,
      pnrNo: li.receiptUploaded ? li.lineItemId : undefined,
      fare: li.claimedAmount,
      receiptUploaded: li.receiptUploaded,
    }));
}

// Build mock DARecords
function buildDARecords(lineItems: ClaimLineItem[], claim: { trainingLocation?: string } | undefined) {
  return lineItems
    .filter((li) => li.expenseType === 'DA')
    .flatMap((li) => {
      return Array.from({ length: 1 }, (_, i) => ({
        date: li.date ?? '',
        city: claim?.trainingLocation ?? 'Delhi',
        country: 'India',
        cityTier: 'Metro',
        rateApplicable: li.claimedAmount,
        fullDayEligible: true,
        isLeaveDay: false,
        isPersonalStayback: false,
        isDuplicate: false,
        eligibleAmount: li.claimedAmount,
        notes: i === 0 ? li.description : undefined,
      }));
    });
}

// Build mock HotelStays
function buildHotelStays(lineItems: ClaimLineItem[]) {
  return lineItems
    .filter((li) => li.expenseType === 'Lodging')
    .map((li) => ({
      stayId: li.lineItemId,
      claimId: li.claimId,
      hotelName: li.description.split(' (')[0] ?? 'Hotel',
      city: 'City',
      checkIn: li.date ?? '',
      checkOut: li.date ?? '',
      nights: 1,
      amountPerNight: li.claimedAmount,
      totalAmount: li.claimedAmount,
      invoiceNo: li.receiptUploaded ? li.lineItemId : undefined,
      receiptUploaded: li.receiptUploaded,
      stayType: 'Self Booked' as const,
    }));
}

// Build mock CabRecords
function buildCabRecords(lineItems: ClaimLineItem[]) {
  return lineItems
    .filter((li) => li.expenseType === 'Cab')
    .flatMap((li, i) => ({
      cabId: `${li.lineItemId}-${i}`,
      claimId: li.claimId,
      date: li.date ?? '',
      fromLocation: 'From',
      toLocation: 'To',
      amount: li.claimedAmount,
      receiptUploaded: li.receiptUploaded,
      purpose: li.description,
      isEligible: true,
    }));
}

// Mock policy rules
const MOCK_POLICY_RULES: PolicyRule[] = [
  {
    ruleId: 'PR-001',
    expenseType: 'TA',
    country: 'India',
    maxAmount: 10000,
    currency: 'INR',
    unit: 'per trip',
    partialDayDepart: 0.5,
    partialDayArrive: 0.5,
    proofRequired: true,
    effectiveFrom: '2026-01-01',
    version: 1,
    active: true,
    changedBy: 'Admin',
    changedOn: '2026-01-01',
  },
  {
    ruleId: 'PR-002',
    expenseType: 'DA',
    country: 'India',
    cityTier: 'Metro',
    maxAmount: 1400,
    currency: 'INR',
    unit: 'per day',
    partialDayDepart: 0.5,
    partialDayArrive: 0.5,
    proofRequired: false,
    effectiveFrom: '2026-01-01',
    version: 1,
    active: true,
    changedBy: 'Admin',
    changedOn: '2026-01-01',
  },
  {
    ruleId: 'PR-003',
    expenseType: 'Lodging',
    country: 'India',
    cityTier: 'Metro',
    maxAmount: 3000,
    currency: 'INR',
    unit: 'per night',
    partialDayDepart: 0,
    partialDayArrive: 0,
    proofRequired: true,
    effectiveFrom: '2026-01-01',
    version: 1,
    active: true,
    changedBy: 'Admin',
    changedOn: '2026-01-01',
  },
  {
    ruleId: 'PR-004',
    expenseType: 'Cab',
    country: 'India',
    maxAmount: 800,
    currency: 'INR',
    unit: 'per trip',
    partialDayDepart: 0,
    partialDayArrive: 0,
    proofRequired: true,
    effectiveFrom: '2026-01-01',
    version: 1,
    active: true,
    changedBy: 'Admin',
    changedOn: '2026-01-01',
  },
];

// ── Tab config ─────────────────────────────────────────────────────────────────

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TAB_CONFIG: TabConfig[] = [
  { id: 'trainer', label: 'Trainer Info', icon: <User className="w-4 h-4" /> },
  { id: 'travel', label: 'Travel', icon: <Plane className="w-4 h-4" /> },
  { id: 'da', label: 'DA', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'lodging', label: 'Lodging', icon: <Hotel className="w-4 h-4" /> },
  { id: 'cab', label: 'Cab', icon: <Car className="w-4 h-4" /> },
  { id: 'attachments', label: 'Attachments', icon: <Paperclip className="w-4 h-4" /> },
  { id: 'policy', label: 'Policy', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'duplicate', label: 'Duplicate', icon: <Copy className="w-4 h-4" /> },
  { id: 'exceptions', label: 'Exceptions', icon: <AlertOctagon className="w-4 h-4" /> },
  { id: 'remarks', label: 'Remarks', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'ledger', label: 'Ledger', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'audit', label: 'Audit', icon: <Clock className="w-4 h-4" /> },
];

// ── Modal ──────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Risk Flag Chip ─────────────────────────────────────────────────────────────

interface FlagChipProps {
  label: string;
  icon: React.ReactNode;
  color: 'red' | 'amber' | 'orange' | 'purple';
}

function FlagChip({ label, icon, color }: FlagChipProps) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${colors[color]}`}
    >
      {icon}
      {label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface ClaimReviewProps {
  currentUser?: UserType;
}

const DEFAULT_USER: UserType = {
  id: 'system',
  name: 'Admin',
  email: 'admin@koenig-solutions.com',
  role: 'HRAdmin',
  avatarInitials: 'AD',
};

export default function ClaimReview({ currentUser = DEFAULT_USER }: ClaimReviewProps) {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();

  // ── Resolve claim — real storage first, mock as fallback ──────────────────
  const claim = useMemo(
    () => getClaims().find((c) => c.claimId === claimId) ?? mockClaims.find((c) => c.claimId === claimId),
    [claimId],
  );

  const lineItems = useMemo(
    () => mockLineItems.filter((li) => li.claimId === claimId),
    [claimId],
  );

  const attachments = useMemo(
    () => mockAttachments.filter((a) => a.claimId === claimId),
    [claimId],
  );

  // statusHistory resolved but not used in render — kept for potential future use
  useMemo(
    () => mockStatusHistory.filter((h) => h.claimId === claimId),
    [claimId],
  );

  const remarks = useMemo(
    () => mockRemarks.filter((r) => r.claimId === claimId),
    [claimId],
  );

  const exceptions = useMemo(
    () => mockExceptions.filter((e) => e.claimId === claimId),
    [claimId],
  );

  const auditLogs = useMemo(
    () => mockAuditLogs.filter((l) => l.claimId === claimId),
    [claimId],
  );

  // ── Derived data ───────────────────────────────────────────────────────────
  const travelLegs = useMemo(() => buildTravelLegs(lineItems), [lineItems]);
  const daRecords = useMemo(() => buildDARecords(lineItems, claim), [lineItems, claim]);
  const hotelStays = useMemo(() => buildHotelStays(lineItems), [lineItems]);
  const cabRecords = useMemo(() => buildCabRecords(lineItems), [lineItems]);

  const trainerUser = useMemo(
    () => mockUsers.find((u) => u.name === claim?.trainerName),
    [claim],
  );

  const trainerLeaveRecords: LeaveRecord[] = useMemo(
    () =>
      trainerUser
        ? mockLeaveRecords.filter((l) => l.trainerId === trainerUser.id)
        : [],
    [trainerUser],
  );

  const trainerAssignments: Assignment[] = useMemo(
    () =>
      trainerUser
        ? mockAssignments.filter((a) =>
            a.trainerIds?.some((tid) => tid === trainerUser.id),
          )
        : [],
    [trainerUser],
  );

  const mockAdvance: AdvanceRecord[] = [];

  // ── Duplicate check ────────────────────────────────────────────────────────
  const duplicateResult = useMemo(() => {
    if (!claim) return null;
    if (
      claim!.trainerName === 'Rahul Verma' &&
      claim!.claimId !== 'clm-0042'
    ) {
      const dup = mockClaims.find((c) => c.claimId === 'clm-0042');
      if (dup) {
        return {
          found: true,
          matches: [
            {
              billNo: dup.billNo,
              trainerName: dup.trainerName,
              dates: `${fmtDate(dup.submittedAt)}`,
              location: dup.trainingLocation,
              reason: 'Same trainer, overlapping travel period',
            },
          ],
        };
      }
    }
    return { found: false, matches: [] };
  }, [claim]);

  // ── Line item decisions (local state) ─────────────────────────────────────
  const [decisions, setDecisions] = useState<Record<string, LineDecision>>(() =>
    Object.fromEntries(
      lineItems.map((li) => [
        li.lineItemId,
        {
          decision: (li.adminDecision as AdminDecision) ?? 'Pending',
          reasonCode: li.reasonCode ?? '',
          trainerRemark: li.trainerVisibleRemark ?? '',
          internalRemark: li.internalRemark ?? '',
          approvedAmount: li.approvedAmount ?? li.claimedAmount,
        },
      ]),
    ),
  );

  // Re-init when lineItems change (e.g., route param changes)
  useEffect(() => {
    setDecisions(
      Object.fromEntries(
        lineItems.map((li) => [
          li.lineItemId,
          {
            decision: (li.adminDecision as AdminDecision) ?? 'Pending',
            reasonCode: li.reasonCode ?? '',
            trainerRemark: li.trainerVisibleRemark ?? '',
            internalRemark: li.internalRemark ?? '',
            approvedAmount: li.approvedAmount ?? li.claimedAmount,
          },
        ]),
      ),
    );
  }, [claimId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDecision = useCallback(
    (lineItemId: string, patch: Partial<LineDecision>) => {
      setDecisions((prev) => ({
        ...prev,
        [lineItemId]: { ...prev[lineItemId], ...patch },
      }));
    },
    [],
  );

  // ── Computed amounts from decisions ───────────────────────────────────────
  const computedAmounts = useMemo(() => {
    let totalClaimed = 0;
    let totalApproved = 0;
    let totalDeduction = 0;

    lineItems.forEach((li) => {
      const d = decisions[li.lineItemId];
      totalClaimed += li.claimedAmount;
      if (!d || d.decision === 'Pending') {
        totalApproved += li.approvedAmount ?? li.claimedAmount;
      } else if (d.decision === 'Approved') {
        totalApproved += d.approvedAmount;
      } else if (d.decision === 'Reduced') {
        totalApproved += d.approvedAmount;
        totalDeduction += li.claimedAmount - d.approvedAmount;
      } else {
        totalDeduction += li.claimedAmount;
      }
    });

    const advanceAdj = claim?.recoverableAmount ?? 0;
    const netPayable = totalApproved - advanceAdj;

    return {
      totalClaimed,
      eligibleAmount: totalApproved,
      approvedAmount: totalApproved,
      deductionAmount: totalDeduction,
      advanceAdjusted: 0,
      miscAdjustments: 0,
      recoverableAmount: advanceAdj,
      netPayable,
    };
  }, [lineItems, decisions, claim]);

  // ── Admin owner ────────────────────────────────────────────────────────────
  const hrAdmins = useMemo(
    () => mockUsers.filter((u) => u.role === 'HRAdmin' || u.role === 'SuperAdmin'),
    [],
  );
  const [adminOwner, setAdminOwner] = useState<string>(
    claim?.adminOwnerId ?? currentUser.id,
  );

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('trainer');
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // ── Modal state ────────────────────────────────────────────────────────────
  type ModalType =
    | 'approve-all'
    | 'save-partial'
    | 'clarification'
    | 'reject'
    | 'hold'
    | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalReason, setModalReason] = useState('');
  const [modalReasonCode, setModalReasonCode] = useState('');
  const [modalRemark, setModalRemark] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const openModal = useCallback((type: ModalType) => {
    setModalReason('');
    setModalReasonCode('');
    setModalRemark('');
    setActiveModal(type);
  }, []);

  const closeModal = useCallback(() => setActiveModal(null), []);

  // ── Ledger verified state ──────────────────────────────────────────────────
  const [ledgerVerified, setLedgerVerified] = useState(!claim?.ledgerMismatchFlag);

  // ── Local remarks state ────────────────────────────────────────────────────
  const [localRemarks, setLocalRemarks] = useState<ClaimRemarks[]>(remarks);
  const addRemark = useCallback(
    (text: string, type: 'Trainer' | 'HR' | 'Internal') => {
      const newRemark: ClaimRemarks = {
        remarkId: `rmk-local-${Date.now()}`,
        claimId: claimId ?? '',
        type,
        text,
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        visible: type === 'Internal' ? 'Internal' : 'All',
      };
      setLocalRemarks((prev) => [newRemark, ...prev]);
    },
    [claimId, currentUser.name],
  );

  // ── Action handlers ────────────────────────────────────────────────────────
  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleApproveAll = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      lineItems.forEach((li) => {
        next[li.lineItemId] = {
          ...next[li.lineItemId],
          decision: 'Approved',
          approvedAmount: li.claimedAmount,
        };
      });
      return next;
    });
    if (claim) {
      saveClaim({
        ...(claim as import('../types').ClaimHeader),
        status: 'Approved',
        approvedAmount: (claim as import('../types').ClaimHeader).totalClaimedAmount ?? 0,
        netPayable: (claim as import('../types').ClaimHeader).totalClaimedAmount ?? 0,
        pendingWith: 'Finance',
        lastActionAt: new Date().toISOString(),
      });
    }
    logAction({
      claimId: claimId,
      entityType: 'Claim',
      entityId: claimId ?? '',
      action: ACTION_TYPES.APPROVED,
      performedBy: currentUser.name,
      performedByRole: currentUser.role,
    });
    closeModal();
    showSuccess('Claim fully approved. Redirecting to queue…');
    setTimeout(() => navigate('/claims'), 1800);
  }, [lineItems, claimId, currentUser, closeModal, navigate]);

  const handleSavePartial = useCallback(() => {
    const updatedItems = lineItems.map((li) => ({
      ...li,
      adminDecision: decisions[li.lineItemId]?.decision,
      reasonCode: decisions[li.lineItemId]?.reasonCode,
      trainerVisibleRemark: decisions[li.lineItemId]?.trainerRemark,
      internalRemark: decisions[li.lineItemId]?.internalRemark,
      approvedAmount: decisions[li.lineItemId]?.approvedAmount,
    }));
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LINE_ITEMS) ?? '[]',
    ) as ClaimLineItem[];
    const merged = [
      ...stored.filter((l) => l.claimId !== claimId),
      ...updatedItems,
    ];
    saveToStorage(STORAGE_KEYS.LINE_ITEMS, merged);
    if (claim) {
      saveClaim({
        ...(claim as import('../types').ClaimHeader),
        status: 'Partially Approved',
        pendingWith: 'Finance',
        lastActionAt: new Date().toISOString(),
      });
    }
    logAction({
      claimId,
      entityType: 'Claim',
      entityId: claimId ?? '',
      action: ACTION_TYPES.PARTIALLY_APPROVED,
      performedBy: currentUser.name,
      performedByRole: currentUser.role,
    });
    closeModal();
    showSuccess('Partial decisions saved. Redirecting to queue…');
    setTimeout(() => navigate('/claims'), 1800);
  }, [lineItems, decisions, claimId, currentUser, closeModal, navigate]);

  const handleSendClarification = useCallback(() => {
    if (!modalReason) return;
    addRemark(modalReason, 'HR');
    if (claim) {
      saveClaim({
        ...(claim as import('../types').ClaimHeader),
        status: 'Clarification Required',
        pendingWith: 'Trainer',
        lastActionAt: new Date().toISOString(),
      });
    }
    logAction({
      claimId,
      entityType: 'Claim',
      entityId: claimId ?? '',
      action: ACTION_TYPES.CLARIFICATION_SENT,
      remarks: modalReason,
      performedBy: currentUser.name,
      performedByRole: currentUser.role,
    });
    closeModal();
    showSuccess('Clarification request sent to trainer. Redirecting…');
    setTimeout(() => navigate('/claims'), 1800);
  }, [modalReason, addRemark, claimId, currentUser, closeModal, navigate]);

  const handleReject = useCallback(() => {
    if (!modalReasonCode || !modalRemark) return;
    if (claim) {
      saveClaim({
        ...(claim as import('../types').ClaimHeader),
        status: 'Rejected',
        pendingWith: 'None',
        lastActionAt: new Date().toISOString(),
      });
    }
    logAction({
      claimId,
      entityType: 'Claim',
      entityId: claimId ?? '',
      action: ACTION_TYPES.REJECTED,
      reasonCode: modalReasonCode,
      remarks: modalRemark,
      performedBy: currentUser.name,
      performedByRole: currentUser.role,
    });
    closeModal();
    showSuccess('Claim rejected. Trainer notified. Redirecting…');
    setTimeout(() => navigate('/claims'), 1800);
  }, [modalReasonCode, modalRemark, claimId, currentUser, closeModal, navigate]);

  const handleHold = useCallback(() => {
    if (!modalRemark) return;
    if (claim) {
      saveClaim({
        ...(claim as import('../types').ClaimHeader),
        status: 'On Hold',
        pendingWith: 'HR/Admin',
        lastActionAt: new Date().toISOString(),
      });
    }
    logAction({
      claimId,
      entityType: 'Claim',
      entityId: claimId ?? '',
      action: ACTION_TYPES.CLAIM_HELD,
      remarks: modalRemark,
      performedBy: currentUser.name,
      performedByRole: currentUser.role,
    });
    closeModal();
    showSuccess('Claim placed on hold. Redirecting…');
    setTimeout(() => navigate('/claims'), 1800);
  }, [modalRemark, claimId, currentUser, closeModal, claim, navigate]);

  // ── 404 guard ──────────────────────────────────────────────────────────────
  if (!claim) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg font-semibold text-gray-700">
          Claim <code className="text-red-500">{claimId}</code> not found.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Render tabs content ────────────────────────────────────────────────────
  function renderTabContent() {
    switch (activeTab) {
      // ── Trainer Info ────────────────────────────────────────────────────
      case 'trainer':
        return (
          <div className="space-y-4">
            {/* Trainer Profile Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Trainer Profile
              </h3>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
                  {claim!.trainerName
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Name</span>
                    <p className="font-semibold text-gray-800">{claim!.trainerName}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Email</span>
                    <p className="text-gray-700">
                      {trainerUser?.email ?? '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Role</span>
                    <p className="text-gray-700">{trainerUser?.role ?? 'Trainer'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Location</span>
                    <p className="text-gray-700">—</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Joined</span>
                    <p className="text-gray-700">—</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Department</span>
                    <p className="text-gray-700">Training Delivery</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Details Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Assignment Details
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-gray-400">Client</span>
                  <p className="font-medium text-gray-800">{claim!.clientName}</p>
                </div>
                <div>
                  <span className="text-gray-400">Location</span>
                  <p className="text-gray-700">{claim!.trainingLocation}</p>
                </div>
                <div>
                  <span className="text-gray-400">City</span>
                  <p className="text-gray-700">
                    {claim!.baseCity}, {(claim!.destinationCities[0] ?? "")}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Assignment IDs</span>
                  <p className="text-gray-700 text-xs font-mono">
                    {claim!.assignmentIds?.join(', ') ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Submitted</span>
                  <p className="text-gray-700">{fmtDate(claim!.submittedAt)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Claimed Amount</span>
                  <p className="font-semibold text-gray-800">
                    {formatINR(claim!.totalClaimedAmount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Leave Panel */}
            {trainerUser && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Resource Leave (Claim Period)
                </h3>
                <ResourceLeavePanel
                  trainerId={trainerUser.id}
                  startDate={claim!.submittedAt?.slice(0, 10) ?? '2026-06-01'}
                  endDate={claim!.lastActionAt?.slice(0, 10) ?? '2026-06-30'}
                  leaveRecords={trainerLeaveRecords}
                  assignments={trainerAssignments}
                />
              </div>
            )}
          </div>
        );

      // ── Travel ──────────────────────────────────────────────────────────
      case 'travel':
        return (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Travel Timeline
              </h3>
              {travelLegs.length > 0 ? (
                <TravelTimeline
                  travelLegs={travelLegs}
                  showContinuityCheck
                />
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No travel legs found for this claim!.
                </p>
              )}
            </div>
            {/* Continuity check warnings */}
            {travelLegs.length > 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700">
                    Journey Continuity Check
                  </span>
                </div>
                <p className="text-sm text-amber-600">
                  All departure and arrival cities have been verified. Please
                  confirm that each arrival city matches the next departure city.
                </p>
              </div>
            )}
          </div>
        );

      // ── DA ──────────────────────────────────────────────────────────────
      case 'da':
        return (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Daily Allowance Breakdown
              </h3>
              {daRecords.length > 0 ? (
                <DADayBreakdown
                  daRecords={daRecords}
                  totalDA={daRecords.reduce((s, r) => s + r.eligibleAmount, 0)}
                  showPolicyColumn
                />
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No DA records for this claim!.
                </p>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Policy Comparison — DA
              </h3>
              <PolicyComparison
                lineItems={lineItems.filter((li) => li.expenseType === 'DA')}
                policies={MOCK_POLICY_RULES.filter(
                  (p) => p.expenseType === 'DA',
                )}
              />
            </div>
          </div>
        );

      // ── Lodging ─────────────────────────────────────────────────────────
      case 'lodging':
        return (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Lodging &amp; Stayback Analysis
              </h3>
              {hotelStays.length > 0 ? (
                <LodgingStaybackPanel
                  hotelStays={hotelStays}
                  policyLimit={3000}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No lodging records for this claim!.
                </p>
              )}
            </div>
            {claim!.recoverableAmount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">
                    Personal Stayback Recovery
                  </span>
                </div>
                <p className="text-sm text-red-600">
                  Recoverable amount:{' '}
                  <strong>{formatINR(claim!.recoverableAmount)}</strong>.{' '}
                  {claim!.adminRemark}
                </p>
              </div>
            )}
          </div>
        );

      // ── Cab ─────────────────────────────────────────────────────────────
      case 'cab':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Cab &amp; Conveyance
            </h3>
            {cabRecords.length > 0 ? (
              <CabConveyancePanel
                cabRecords={cabRecords}
                policyLimit={800}
                assignmentDates={[]}
              />
            ) : (
              <p className="text-sm text-gray-400 italic">
                No cab records for this claim!.
              </p>
            )}
          </div>
        );

      // ── Attachments ─────────────────────────────────────────────────────
      case 'attachments':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Attachments
            </h3>
            <AttachmentPreview
              attachments={attachments}
              isEditable={false}
              userRole={currentUser.role}
            />
          </div>
        );

      // ── Policy ──────────────────────────────────────────────────────────
      case 'policy':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Policy Comparison
            </h3>
            <PolicyComparison
              lineItems={lineItems}
              policies={MOCK_POLICY_RULES}
            />
          </div>
        );

      // ── Duplicate ───────────────────────────────────────────────────────
      case 'duplicate':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Duplicate Check Results
            </h3>
            {duplicateResult?.found ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold text-sm">
                    Potential duplicate detected
                  </span>
                </div>
                {duplicateResult.matches.map((m, i) => (
                  <div
                    key={i}
                    className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">
                        {m.billNo}
                      </span>
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        Potential Duplicate
                      </span>
                    </div>
                    <p className="text-gray-600">
                      <strong>Trainer:</strong> {m.trainerName}
                    </p>
                    <p className="text-gray-600">
                      <strong>Date:</strong> {m.dates}
                    </p>
                    <p className="text-gray-600">
                      <strong>Location:</strong> {m.location}
                    </p>
                    <p className="text-amber-700 font-medium">
                      ⚠ {m.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-green-600 py-4">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <p className="font-semibold text-sm">No duplicates found</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Checked against all claims — no overlapping trainer/date/PNR
                    matches.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      // ── Exceptions ──────────────────────────────────────────────────────
      case 'exceptions':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Exception Requests
            </h3>
            {exceptions.length > 0 ? (
              <ExceptionPanel
                exceptions={exceptions}
                isApprover={
                  currentUser.role === 'HRAdmin' ||
                  currentUser.role === 'SuperAdmin'
                }
              />
            ) : (
              <p className="text-sm text-gray-400 italic">
                No exception requests for this claim!.
              </p>
            )}
          </div>
        );

      // ── Remarks ─────────────────────────────────────────────────────────
      case 'remarks':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Remarks
            </h3>
            <RemarksPanel
              remarks={localRemarks}
              onAdd={addRemark}
              currentUserRole={currentUser.role}
              currentUserId={currentUser.id}
            />
          </div>
        );

      // ── Ledger ──────────────────────────────────────────────────────────
      case 'ledger':
        return (
          <div className="space-y-4">
            <LedgerPanel
              claim={claim as any}
              advanceRecords={mockAdvance}
              onVerify={() => {
                setLedgerVerified(true);
                showSuccess('Ledger verified. Approve button is now enabled.');
              }}
              isEditable
            />
            {!ledgerVerified && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  Ledger mismatch unresolved. The Approve button will remain
                  disabled until ledger is verified.
                </p>
              </div>
            )}
          </div>
        );

      // ── Audit ───────────────────────────────────────────────────────────
      case 'audit':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Audit Timeline
            </h3>
            {auditLogs.length > 0 ? (
              <AuditTimeline auditLogs={auditLogs} />
            ) : (
              <p className="text-sm text-gray-400 italic">
                No audit logs yet for this claim!.
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success toast */}
      {actionSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* Modals */}
      {activeModal === 'approve-all' && (
        <Modal title="Approve Full Claim" onClose={closeModal}>
          <p className="text-sm text-gray-600 mb-5">
            This will approve all{' '}
            <strong>{lineItems.length} line items</strong> in claim{' '}
            <strong>{claim!.billNo}</strong> for a total of{' '}
            <strong>{formatINR(claim!.totalClaimedAmount)}</strong>. This action
            creates an audit log entry.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveAll}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Confirm Approve All
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'save-partial' && (
        <Modal title="Save Partial Decisions" onClose={closeModal}>
          <p className="text-sm text-gray-600 mb-5">
            Save current line-item decisions and continue the review later. The
            claim will remain in{' '}
            <strong>Under Review</strong> status.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePartial}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Save &amp; Continue
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'clarification' && (
        <Modal title="Send Clarification Request" onClose={closeModal}>
          <p className="text-sm text-gray-500 mb-4">
            Describe the clarification required. This will be visible to the
            trainer and return the claim to their queue.
          </p>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={4}
            placeholder="e.g. Please provide hotel invoice for night of 18 Jun 2026…"
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendClarification}
              disabled={!modalReason.trim()}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send to Trainer
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'reject' && (
        <Modal title="Reject Claim" onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason Code <span className="text-red-500">*</span>
              </label>
              <ReasonCodeSelect
                value={modalReasonCode}
                onChange={setModalReasonCode}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Provide detailed rejection reason visible to the trainer…"
                value={modalRemark}
                onChange={(e) => setModalRemark(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!modalReasonCode || !modalRemark.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {activeModal === 'hold' && (
        <Modal title="Place Claim on Hold" onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hold Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                placeholder="Why is this claim being held?"
                value={modalRemark}
                onChange={(e) => setModalRemark(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHold}
                disabled={!modalRemark.trim()}
                className="px-4 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Place on Hold
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Page content */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Claims
        </button>

        {/* ── HEADER SUMMARY BAR ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-5">
          {/* Row 1: Bill No / Trainer / Status / Pending */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Bill Number
                </p>
                <p className="text-xl font-bold text-gray-900 font-mono">
                  {claim!.billNo}
                </p>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Trainer
                </p>
                <p className="text-base font-semibold text-gray-800">
                  {claim!.trainerName}
                </p>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Status
                </p>
                <StatusBadge status={claim!.status} />
              </div>
              <div className="border-l border-gray-200 pl-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Pending With
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {claim!.pendingWith ?? '—'}
                </p>
              </div>
            </div>

            {/* Admin owner assignment */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">
                Assigned To
              </label>
              <select
                value={adminOwner}
                onChange={(e) => setAdminOwner(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {hrAdmins.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Risk flags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {claim!.missingDocumentFlag && (
              <FlagChip
                label="Missing Documents"
                icon={<FileWarning className="w-3 h-3" />}
                color="amber"
              />
            )}
            {claim!.exceptionFlag && (
              <FlagChip
                label="Exception Flagged"
                icon={<AlertOctagon className="w-3 h-3" />}
                color="orange"
              />
            )}
            {claim!.slaBreached && (
              <FlagChip
                label="SLA Breached"
                icon={<Clock className="w-3 h-3" />}
                color="red"
              />
            )}
            {claim!.ledgerMismatchFlag && (
              <FlagChip
                label="Ledger Mismatch"
                icon={<AlertCircle className="w-3 h-3" />}
                color="red"
              />
            )}
            {claim!.highValue && (
              <FlagChip
                label="High Value"
                icon={<AlertTriangle className="w-3 h-3" />}
                color="purple"
              />
            )}
            {(claim!.destinationCities.some(c => c !== 'India')) && (
              <FlagChip
                label="International"
                icon={<Plane className="w-3 h-3" />}
                color="purple"
              />
            )}
            {duplicateResult?.found && (
              <FlagChip
                label="Duplicate Flag"
                icon={<Copy className="w-3 h-3" />}
                color="red"
              />
            )}
            {!claim!.missingDocumentFlag &&
              !claim!.exceptionFlag &&
              !claim!.slaBreached &&
              !claim!.ledgerMismatchFlag &&
              !claim!.highValue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" /> No Flags
                </span>
              )}
          </div>

          {/* Row 3: Meta info */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="font-medium text-gray-700">
                {fmtDate(claim!.submittedAt)}
              </span>
              <span className="text-gray-400">submitted</span>
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="font-medium text-gray-700">
                {claim!.baseCity}, {(claim!.destinationCities[0] ?? "")}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span className="font-medium text-gray-700">
                {claim!.clientName}
              </span>
            </span>
            <span
              className={`flex items-center gap-1 font-semibold ${
                claim!.agingDays >= 7
                  ? 'text-red-600'
                  : claim!.agingDays >= 4
                  ? 'text-amber-600'
                  : 'text-gray-600'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {claim!.agingDays}d aging
              {claim!.slaBreached && ' (SLA breached)'}
            </span>
          </div>
        </div>

        {/* ── TWO-COLUMN LAYOUT ── */}
        <div className="flex gap-5 items-start">
          {/* ── LEFT: Main content (60%) ── */}
          <div className="flex-1 min-w-0" style={{ flexBasis: '60%' }}>
            {/* Tab navigation */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-4 overflow-hidden">
              <div
                ref={tabScrollRef}
                className="flex overflow-x-auto border-b border-gray-100 scrollbar-hide"
              >
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div>{renderTabContent()}</div>
          </div>

          {/* ── RIGHT: Action panel (40%, sticky) ── */}
          <div
            className="flex-shrink-0 space-y-4"
            style={{ flexBasis: '40%', position: 'sticky', top: '1.5rem' }}
          >
            {/* Verification Checklist */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Verification Checklist
              </h3>
              <VerificationChecklist
                claim={claim as any}
                lineItems={lineItems as any}
                attachments={attachments as any}
                travelLegs={travelLegs}
              />
            </div>

            {/* Claim Lines Review */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Claim Lines Review
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">
                        Expense
                      </th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">
                        Claimed
                      </th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">
                        Policy
                      </th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">
                        Decision
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lineItems.map((li) => {
                      const d = decisions[li.lineItemId];
                      const needsDetails =
                        d?.decision &&
                        d.decision !== 'Approved' &&
                        d.decision !== 'Pending';
                      const policyRule = MOCK_POLICY_RULES.find(
                        (p) => p.expenseType === li.expenseType,
                      );
                      const policyLimit = policyRule
                        ? policyRule.maxAmount
                        : li.claimedAmount;

                      return (
                        <React.Fragment key={li.lineItemId}>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 max-w-[120px]">
                              <p className="font-medium text-gray-800 truncate">
                                {li.expenseType}
                              </p>
                              <p className="text-gray-400 truncate text-[11px]">
                                {li.description.substring(0, 40)}…
                              </p>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {formatINR(li.claimedAmount)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-mono ${
                                li.claimedAmount > policyLimit
                                  ? 'text-red-600 font-semibold'
                                  : 'text-gray-500'
                              }`}
                            >
                              {formatINR(policyLimit)}
                            </td>
                            <td className="px-3 py-2 min-w-[130px]">
                              <select
                                value={d?.decision ?? 'Pending'}
                                onChange={(e) =>
                                  updateDecision(li.lineItemId, {
                                    decision: e.target.value as AdminDecision,
                                    approvedAmount:
                                      e.target.value === 'Approved'
                                        ? li.claimedAmount
                                        : e.target.value === 'Rejected' ||
                                          e.target.value === 'Non-Payable'
                                        ? 0
                                        : d?.approvedAmount ?? li.claimedAmount,
                                  })
                                }
                                className={[
                                  'w-full rounded border px-1.5 py-1 text-xs focus:ring-1 focus:ring-indigo-400',
                                  d?.decision === 'Approved'
                                    ? 'border-green-300 bg-green-50 text-green-700'
                                    : d?.decision === 'Rejected' ||
                                      d?.decision === 'Non-Payable'
                                    ? 'border-red-300 bg-red-50 text-red-700'
                                    : d?.decision === 'Reduced'
                                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                                    : d?.decision === 'Clarification'
                                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 bg-white text-gray-700',
                                ].join(' ')}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approve</option>
                                <option value="Reduced">Reduce</option>
                                <option value="Rejected">Reject</option>
                                <option value="Non-Payable">Non-Payable</option>
                                <option value="Clarification">
                                  Clarification
                                </option>
                              </select>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {needsDetails && (
                            <tr className="bg-gray-50/80">
                              <td colSpan={4} className="px-3 pb-3 pt-1">
                                <div className="space-y-2">
                                  {d?.decision === 'Reduced' && (
                                    <div>
                                      <label className="text-[11px] text-gray-500 font-medium">
                                        Approved Amount
                                      </label>
                                      <input
                                        type="number"
                                        value={d.approvedAmount}
                                        onChange={(e) =>
                                          updateDecision(li.lineItemId, {
                                            approvedAmount: Number(
                                              e.target.value,
                                            ),
                                          })
                                        }
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-0.5 focus:ring-1 focus:ring-indigo-400"
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <label className="text-[11px] text-gray-500 font-medium">
                                      Reason Code
                                    </label>
                                    <ReasonCodeSelect
                                      value={d?.reasonCode ?? ''}
                                      onChange={(v) =>
                                        updateDecision(li.lineItemId, {
                                          reasonCode: v,
                                        })
                                      }
                                      placeholder="Select reason…"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-gray-500 font-medium">
                                      Trainer-visible remark
                                    </label>
                                    <input
                                      type="text"
                                      value={d?.trainerRemark ?? ''}
                                      onChange={(e) =>
                                        updateDecision(li.lineItemId, {
                                          trainerRemark: e.target.value,
                                        })
                                      }
                                      placeholder="Visible to trainer…"
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-0.5 focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-gray-500 font-medium">
                                      Internal remark
                                    </label>
                                    <input
                                      type="text"
                                      value={d?.internalRemark ?? ''}
                                      onChange={(e) =>
                                        updateDecision(li.lineItemId, {
                                          internalRemark: e.target.value,
                                        })
                                      }
                                      placeholder="Internal only…"
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-0.5 focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>
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

            {/* Amount Summary */}
            <AmountSummary
              claimedAmount={computedAmounts.totalClaimed}
              eligibleAmount={computedAmounts.eligibleAmount}
              approvedAmount={computedAmounts.approvedAmount}
              deductionAmount={computedAmounts.deductionAmount}
              advanceAdjusted={computedAmounts.advanceAdjusted}
              miscAdjustments={computedAmounts.miscAdjustments}
              recoverableAmount={computedAmounts.recoverableAmount}
              netPayable={computedAmounts.netPayable}
              currency={claim!.currency ?? 'INR'}
            />

            {/* Ledger verification notice */}
            {claim!.ledgerMismatchFlag && !ledgerVerified && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-700">
                    Ledger Mismatch — Approval Blocked
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Resolve ledger mismatch in the Ledger tab before approving.
                  </p>
                  <button
                    onClick={() => setActiveTab('ledger')}
                    className="text-xs text-red-700 underline mt-1 hover:text-red-900"
                  >
                    Go to Ledger tab →
                  </button>
                </div>
              </div>
            )}

            {/* Decision Buttons */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Decisions
              </h3>

              {/* Approve All */}
              <button
                onClick={() => openModal('approve-all')}
                disabled={claim!.ledgerMismatchFlag && !ledgerVerified}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <ThumbsUp className="w-4 h-4" />
                Approve All
              </button>

              {/* Save Partial */}
              <button
                onClick={() => openModal('save-partial')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Partial
              </button>

              {/* Send Clarification */}
              <button
                onClick={() => openModal('clarification')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                Send Clarification
              </button>

              {/* Reject */}
              <button
                onClick={() => openModal('reject')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                <XCircle className="w-4 h-4" />
                Reject Claim
              </button>

              {/* Hold */}
              <button
                onClick={() => openModal('hold')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-500 text-white text-sm font-semibold hover:bg-slate-600 transition-colors shadow-sm"
              >
                <PauseCircle className="w-4 h-4" />
                Hold
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


