import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClaims } from '../services/storageService';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Search,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  TrendingUp,
  Download,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import type { User, ClaimHeader } from '../types';
import KpiCard from '../components/KpiCard';
import StatusBadge from '../components/StatusBadge';
import { RiskFlagBadge } from '../components/StatusBadge';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  const abs = Math.abs(Math.round(amount)).toString();
  if (abs.length <= 3) return `${amount < 0 ? '-' : ''}₹${abs}`;
  const last3 = abs.slice(-3);
  const rest = abs.slice(0, -3);
  const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}₹${pairs},${last3}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Attention items ────────────────────────────────────────────────────────
// (adminMockClaims removed — data comes from getClaims() in each useMemo)

/* placeholder to keep the comment block intact */
const _unused: ClaimHeader[] = [
  {
    claimId: 'clm-0051',
    billNo: 'TA-2026-0051',
    trainerId: 'TRN-IK-001',
    trainerName: 'Imran Khan',
    assignmentIds: ['asgn-HYD-2026-112'],
    batchIds: ['BATCH-HYD-112'],
    clientName: 'TechMah Solutions',
    courseName: 'DevOps Fundamentals',
    trainingLocation: 'Hyderabad',
    claimStartDate: '2026-06-18',
    claimEndDate: '2026-06-21',
    baseCity: 'Delhi',
    destinationCities: ['Hyderabad'],
    status: 'Submitted',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-21T10:15:00.000Z',
    lastActionAt: '2026-06-21T10:15:00.000Z',
    totalClaimedAmount: 28400,
    eligibleAmount: 28400,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: true,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 3,
  },
  {
    claimId: 'clm-0042',
    billNo: 'TA-2026-0042',
    trainerId: 'TRN-RV-002',
    trainerName: 'Rahul Verma',
    assignmentIds: ['asgn-GGN-2026-087'],
    batchIds: ['BATCH-GGN-087'],
    clientName: 'CyberCorp Technologies',
    courseName: 'Cloud Architecture',
    trainingLocation: 'Gurgaon',
    claimStartDate: '2026-06-15',
    claimEndDate: '2026-06-19',
    baseCity: 'Delhi',
    destinationCities: ['Gurgaon'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-19T09:30:00.000Z',
    lastActionAt: '2026-06-19T09:30:00.000Z',
    totalClaimedAmount: 42800,
    eligibleAmount: 42800,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: true,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 5,
  },
  {
    claimId: 'clm-0039',
    billNo: 'TA-2026-0039',
    trainerId: 'TRN-AR-003',
    trainerName: 'Anita Rao',
    assignmentIds: ['asgn-PNE-2026-055'],
    batchIds: ['BATCH-PNE-055'],
    clientName: 'Globant India',
    courseName: 'Agile & Scrum',
    trainingLocation: 'Pune',
    claimStartDate: '2026-06-08',
    claimEndDate: '2026-06-13',
    baseCity: 'Pune',
    destinationCities: ['Pune'],
    status: 'Clarification Required',
    pendingWith: 'Trainer',
    submittedAt: '2026-06-16T11:00:00.000Z',
    lastActionAt: '2026-06-16T11:00:00.000Z',
    totalClaimedAmount: 31200,
    eligibleAmount: 31200,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 8,
  },
  {
    claimId: 'clm-0033',
    billNo: 'TA-2026-0033',
    trainerId: 'TRN-PN-004',
    trainerName: 'Priya Nair',
    assignmentIds: ['asgn-BLR-2026-041'],
    batchIds: ['BATCH-BLR-041'],
    clientName: 'Infosys Limited',
    courseName: 'Java Enterprise',
    trainingLocation: 'Bangalore',
    claimStartDate: '2026-06-06',
    claimEndDate: '2026-06-08',
    baseCity: 'Kochi',
    destinationCities: ['Bangalore'],
    status: 'Approved',
    pendingWith: 'Finance',
    submittedAt: '2026-06-10T10:00:00.000Z',
    lastActionAt: '2026-06-14T15:30:00.000Z',
    totalClaimedAmount: 18600,
    eligibleAmount: 17200,
    approvedAmount: 17200,
    deductionAmount: 1400,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 17200,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 0,
  },
  {
    claimId: 'clm-0028',
    billNo: 'TA-2026-0028',
    trainerId: 'TRN-VJ-005',
    trainerName: 'Vikram Joshi',
    assignmentIds: ['asgn-MUM-2026-033'],
    batchIds: ['BATCH-MUM-033'],
    clientName: 'Accenture Solutions',
    courseName: 'SAP HANA',
    trainingLocation: 'Mumbai',
    claimStartDate: '2026-05-28',
    claimEndDate: '2026-06-01',
    baseCity: 'Pune',
    destinationCities: ['Mumbai'],
    status: 'Payment Pending',
    pendingWith: 'Finance',
    submittedAt: '2026-06-05T09:00:00.000Z',
    lastActionAt: '2026-06-11T12:00:00.000Z',
    totalClaimedAmount: 37800,
    eligibleAmount: 36500,
    approvedAmount: 36500,
    deductionAmount: 1300,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 34000,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 0,
  },
  {
    claimId: 'clm-0044',
    billNo: 'TA-2026-0044',
    trainerId: 'TRN-RV-002',
    trainerName: 'Rahul Verma',
    assignmentIds: ['asgn-DXB-2026-009'],
    batchIds: ['BATCH-DXB-009'],
    clientName: 'Emirates NBD Bank',
    courseName: 'Risk Management',
    trainingLocation: 'Dubai',
    claimStartDate: '2026-06-16',
    claimEndDate: '2026-06-20',
    baseCity: 'Delhi',
    destinationCities: ['Dubai'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-22T07:45:00.000Z',
    lastActionAt: '2026-06-22T07:45:00.000Z',
    totalClaimedAmount: 96400,
    eligibleAmount: 96400,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: true,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 2,
  },
  {
    claimId: 'clm-0047',
    billNo: 'TA-2026-0047',
    trainerId: 'TRN-PN-004',
    trainerName: 'Priya Nair',
    assignmentIds: ['asgn-MUM-2026-048', 'asgn-MUM-2026-049'],
    batchIds: ['BATCH-MUM-048', 'BATCH-MUM-049'],
    clientName: 'KPMG India',
    courseName: 'Data Analytics',
    trainingLocation: 'Mumbai',
    claimStartDate: '2026-06-20',
    claimEndDate: '2026-06-23',
    baseCity: 'Kochi',
    destinationCities: ['Mumbai'],
    status: 'Draft',
    pendingWith: 'Trainer',
    submittedAt: undefined,
    lastActionAt: '2026-06-23T09:00:00.000Z',
    totalClaimedAmount: 0,
    eligibleAmount: 0,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 0,
  },
  {
    claimId: 'clm-0049',
    billNo: 'TA-2026-0049',
    trainerId: 'TRN-AR-003',
    trainerName: 'Anita Rao',
    assignmentIds: ['asgn-PNE-2026-044'],
    batchIds: ['BATCH-PNE-044'],
    clientName: 'Globant India',
    courseName: 'UI/UX Design',
    trainingLocation: 'Pune',
    claimStartDate: '2026-06-03',
    claimEndDate: '2026-06-07',
    baseCity: 'Pune',
    destinationCities: ['Pune'],
    status: 'Paid',
    pendingWith: 'None',
    submittedAt: '2026-06-03T10:00:00.000Z',
    lastActionAt: '2026-06-15T09:30:00.000Z',
    totalClaimedAmount: 30200,
    eligibleAmount: 29400,
    approvedAmount: 29400,
    deductionAmount: 800,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 29400,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Paid',
    agingDays: 0,
  },
  {
    claimId: 'clm-0035',
    billNo: 'TA-2026-0035',
    trainerId: 'TRN-VJ-005',
    trainerName: 'Vikram Joshi',
    assignmentIds: ['asgn-CHN-2026-022'],
    batchIds: ['BATCH-CHN-022'],
    clientName: 'Tata Consultancy Services',
    courseName: 'Project Management',
    trainingLocation: 'Chennai',
    claimStartDate: '2026-06-01',
    claimEndDate: '2026-06-05',
    baseCity: 'Pune',
    destinationCities: ['Chennai'],
    status: 'Rejected',
    pendingWith: 'None',
    submittedAt: '2026-06-12T14:00:00.000Z',
    lastActionAt: '2026-06-13T10:00:00.000Z',
    totalClaimedAmount: 22500,
    eligibleAmount: 0,
    approvedAmount: 0,
    deductionAmount: 22500,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 0,
  },
  {
    claimId: 'clm-0038',
    billNo: 'TA-2026-0038',
    trainerId: 'TRN-RV-002',
    trainerName: 'Rahul Verma',
    assignmentIds: ['asgn-HYD-2026-098'],
    batchIds: ['BATCH-HYD-098'],
    clientName: 'Wipro Technologies',
    courseName: 'Cybersecurity Basics',
    trainingLocation: 'Hyderabad',
    claimStartDate: '2026-06-08',
    claimEndDate: '2026-06-11',
    baseCity: 'Delhi',
    destinationCities: ['Hyderabad'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-12T08:00:00.000Z',
    lastActionAt: '2026-06-20T11:00:00.000Z',
    totalClaimedAmount: 33600,
    eligibleAmount: 33600,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: true,
    paymentStatus: 'Unpaid',
    agingDays: 12,
  },
  {
    claimId: 'clm-0045',
    billNo: 'TA-2026-0045',
    trainerId: 'TRN-IK-001',
    trainerName: 'Imran Khan',
    assignmentIds: ['asgn-NOI-2026-061'],
    batchIds: ['BATCH-NOI-061'],
    clientName: 'HCL Technologies',
    courseName: 'Linux Administration',
    trainingLocation: 'Noida',
    claimStartDate: '2026-06-17',
    claimEndDate: '2026-06-19',
    baseCity: 'Delhi',
    destinationCities: ['Noida'],
    status: 'Under Review',
    pendingWith: 'Finance',
    submittedAt: '2026-06-20T12:00:00.000Z',
    lastActionAt: '2026-06-20T12:00:00.000Z',
    totalClaimedAmount: 19800,
    eligibleAmount: 19800,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: true,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 4,
  },
  {
    claimId: 'clm-0046',
    billNo: 'TA-2026-0046',
    trainerId: 'TRN-PN-004',
    trainerName: 'Priya Nair',
    assignmentIds: ['asgn-HYD-2026-105'],
    batchIds: ['BATCH-HYD-105'],
    clientName: 'Deloitte India',
    courseName: 'Business Analytics',
    trainingLocation: 'Hyderabad',
    claimStartDate: '2026-06-18',
    claimEndDate: '2026-06-20',
    baseCity: 'Kochi',
    destinationCities: ['Hyderabad'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-21T11:30:00.000Z',
    lastActionAt: '2026-06-21T11:30:00.000Z',
    totalClaimedAmount: 27800,
    eligibleAmount: 27800,
    approvedAmount: 0,
    deductionAmount: 0,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 5400,
    netPayable: 0,
    currency: 'INR',
    exceptionFlag: true,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 3,
  },
  {
    claimId: 'clm-0050',
    billNo: 'TA-2026-0050',
    trainerId: 'TRN-VJ-005',
    trainerName: 'Vikram Joshi',
    assignmentIds: ['asgn-PNE-2026-067'],
    batchIds: ['BATCH-PNE-067'],
    clientName: 'Tech Mahindra',
    courseName: 'Microservices & Docker',
    trainingLocation: 'Pune',
    claimStartDate: '2026-06-10',
    claimEndDate: '2026-06-13',
    baseCity: 'Pune',
    destinationCities: ['Pune'],
    status: 'Partially Approved',
    pendingWith: 'Finance',
    submittedAt: '2026-06-14T09:00:00.000Z',
    lastActionAt: '2026-06-20T16:00:00.000Z',
    totalClaimedAmount: 41200,
    eligibleAmount: 31800,
    approvedAmount: 31800,
    deductionAmount: 9400,
    advanceAdjusted: 0,
    miscAdjustments: 0,
    recoverableAmount: 0,
    netPayable: 31800,
    currency: 'INR',
    exceptionFlag: false,
    missingDocumentFlag: false,
    duplicateFlag: false,
    ledgerMismatchFlag: false,
    slaBreached: false,
    paymentStatus: 'Unpaid',
    agingDays: 0,
  },
];
void _unused; // suppress unused warning

// ── Attention items ────────────────────────────────────────────────────────

interface AttentionItem {
  claimId: string;
  billNo: string;
  trainerName: string;
  issueType: 'sla' | 'missing-doc' | 'exception' | 'ledger';
  issueLabel: string;
  agingDays: number;
  actionLabel: string;
}

// ── Chart colors ───────────────────────────────────────────────────────────

const PIE_COLORS: Record<string, string> = {
  Draft: '#94a3b8',
  Submitted: '#3b82f6',
  'Under Review': '#6366f1',
  'Clarification Required': '#f97316',
  Approved: '#22c55e',
  'Partially Approved': '#14b8a6',
  Rejected: '#ef4444',
  Paid: '#10b981',
};

const AGING_COLOR = '#3b82f6';

// ── Props ──────────────────────────────────────────────────────────────────

interface AdminDashboardProps {
  currentUser: User;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const navigate = useNavigate();

  // ── Aggregations from mock data ──────────────────────────────────────────

  const kpis = useMemo(() => {
    const claims = getClaims();

    const newBills = claims.filter((c) => c.status === 'Submitted').length;
    const underReview = claims.filter((c) => c.status === 'Under Review').length;
    const clarification = claims.filter((c) => c.status === 'Clarification Required').length;
    const approved = claims.filter((c) => c.status === 'Approved' || c.status === 'Partially Approved').length;
    const paymentPending = claims
      .filter((c) => c.status === 'Payment Pending')
      .reduce((s, c) => s + c.netPayable, 0);
    const missingDocs = claims.filter((c) => c.missingDocumentFlag).length;
    const exceptions = claims.filter((c) => c.exceptionFlag).length;
    const slaBreached = claims.filter((c) => c.slaBreached).length;
    const ledgerMismatch = claims.filter((c) => c.ledgerMismatchFlag).length;
    const totalClaimed = claims.reduce((s, c) => s + c.totalClaimedAmount, 0);
    const totalApproved = claims.reduce((s, c) => s + c.approvedAmount, 0);
    const recoverable = claims.reduce((s, c) => s + c.recoverableAmount, 0);

    return {
      newBills,
      underReview,
      clarification,
      approved,
      paymentPending,
      missingDocs,
      exceptions,
      slaBreached,
      ledgerMismatch,
      totalClaimed,
      totalApproved,
      recoverable,
    };
  }, []);

  // ── Pie chart data ───────────────────────────────────────────────────────

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of getClaims()) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  // ── Aging bucket data ────────────────────────────────────────────────────

  const agingData = useMemo(() => {
    const buckets = { '<1 day': 0, '1-2 days': 0, '2-3 days': 0, '3-5 days': 0, '>5 days': 0 };
    for (const c of getClaims()) {
      if (c.agingDays < 1) buckets['<1 day']++;
      else if (c.agingDays <= 2) buckets['1-2 days']++;
      else if (c.agingDays <= 3) buckets['2-3 days']++;
      else if (c.agingDays <= 5) buckets['3-5 days']++;
      else buckets['>5 days']++;
    }
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, []);

  // ── Attention items ──────────────────────────────────────────────────────

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const c of getClaims()) {
      if (c.slaBreached) {
        items.push({
          claimId: c.claimId,
          billNo: c.billNo,
          trainerName: c.trainerName,
          issueType: 'sla',
          issueLabel: 'SLA Breached',
          agingDays: c.agingDays,
          actionLabel: 'Escalate',
        });
      }
      if (c.missingDocumentFlag) {
        items.push({
          claimId: c.claimId,
          billNo: c.billNo,
          trainerName: c.trainerName,
          issueType: 'missing-doc',
          issueLabel: 'Missing Docs',
          agingDays: c.agingDays,
          actionLabel: 'Request',
        });
      }
      if (c.exceptionFlag) {
        items.push({
          claimId: c.claimId,
          billNo: c.billNo,
          trainerName: c.trainerName,
          issueType: 'exception',
          issueLabel: 'Exception',
          agingDays: c.agingDays,
          actionLabel: 'Review',
        });
      }
      if (c.ledgerMismatchFlag) {
        items.push({
          claimId: c.claimId,
          billNo: c.billNo,
          trainerName: c.trainerName,
          issueType: 'ledger',
          issueLabel: 'Ledger Mismatch',
          agingDays: c.agingDays,
          actionLabel: 'Reconcile',
        });
      }
    }
    return items.slice(0, 8);
  }, []);

  // ── Recent submissions (last 5 by submittedAt) ────────────────────────────

  const recentClaims = useMemo(
    () =>
      [...getClaims()]
        .filter((c) => c.submittedAt)
        .sort((a, b) =>
          new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime()
        )
        .slice(0, 5),
    []
  );

  // ── MTD amounts ──────────────────────────────────────────────────────────

  const mtd = useMemo(() => {
    const claims = getClaims();
    const totalClaimed = claims.reduce((s, c) => s + c.totalClaimedAmount, 0);
    const eligible = claims.reduce((s, c) => s + c.eligibleAmount, 0);
    const totalApproved = claims.reduce((s, c) => s + c.approvedAmount, 0);
    const deductions = claims.reduce((s, c) => s + c.deductionAmount, 0);
    const recoverable = claims.reduce((s, c) => s + c.recoverableAmount, 0);
    const paymentPending = claims
      .filter((c) => c.status === 'Payment Pending')
      .reduce((s, c) => s + c.netPayable, 0);
    const paid = claims
      .filter((c) => c.paymentStatus === 'Paid')
      .reduce((s, c) => s + c.netPayable, 0);
    return { totalClaimed, eligible, totalApproved, deductions, recoverable, paymentPending, paid };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function goToQueue(filter?: string) {
    navigate(filter ? `/admin/queue?filter=${filter}` : '/admin/queue');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-6 py-8 md:px-10 md:py-10">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 left-1/3 h-80 w-80 rounded-full bg-white/5" />
        </div>

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Left: text + actions */}
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white/90 uppercase tracking-wider">
                {currentUser.role}
              </span>
              <span className="text-white/50 text-xs">|</span>
              <span className="text-white/70 text-xs">Welcome, {currentUser.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">HR / Admin Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100 leading-relaxed">
              Workload, SLA aging, missing documents, exceptions, ledger mismatch and payment-pending
              — your approval cockpit.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => goToQueue()}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                Open Queue
              </button>
              <button
                onClick={() => navigate('/admin/export')}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Right: circular stat */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 border-white/30 bg-white/10 shadow-lg backdrop-blur-sm">
              <span className="text-3xl font-extrabold text-white leading-none">
                {kpis.newBills + kpis.underReview + kpis.clarification}
              </span>
              <span className="mt-1 text-center text-xs font-medium text-blue-100 leading-tight px-2">
                Bills
                <br />
                Pending
              </span>
              <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 shadow">
                <AlertCircle className="w-4 h-4 text-amber-900" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="px-4 py-6 md:px-8 md:py-8 space-y-6">

        {/* ── KPI Row 1 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            title="New Bills"
            value={kpis.newBills}
            subtitle="Submitted, awaiting review"
            icon={FileText}
            accentColor="blue"
            onClick={() => goToQueue('Submitted')}
          />
          <KpiCard
            title="Under Review"
            value={kpis.underReview}
            subtitle="Being processed by HR"
            icon={Search}
            accentColor="indigo"
            onClick={() => goToQueue('Under+Review')}
          />
          <KpiCard
            title="Clarification Pending"
            value={kpis.clarification}
            subtitle="Awaiting trainer response"
            icon={AlertCircle}
            accentColor="yellow"
            onClick={() => goToQueue('Clarification+Required')}
          />
          <KpiCard
            title="Approved"
            value={kpis.approved}
            subtitle="Approved / partially approved"
            icon={CheckCircle2}
            accentColor="green"
            onClick={() => goToQueue('Approved')}
          />
        </div>

        {/* ── KPI Row 2 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            title="Payment Pending"
            value={kpis.paymentPending}
            subtitle="Approved, awaiting disbursement"
            icon={IndianRupee}
            accentColor="yellow"
            isAmount
            onClick={() => goToQueue('Payment+Pending')}
          />
          <KpiCard
            title="Total Claimed"
            value={kpis.totalClaimed}
            subtitle="Gross MTD claimed amount"
            icon={IndianRupee}
            accentColor="blue"
            isAmount
            onClick={() => goToQueue()}
          />
          <KpiCard
            title="Total Approved"
            value={kpis.totalApproved}
            subtitle="MTD net approved"
            icon={TrendingUp}
            accentColor="green"
            isAmount
            onClick={() => goToQueue('Approved')}
          />
          <KpiCard
            title="Recoverable"
            value={kpis.recoverable}
            subtitle="Flagged for recovery"
            icon={AlertTriangle}
            accentColor="teal"
            isAmount
            onClick={() => goToQueue('recoverable')}
          />
        </div>

        {/* ── Charts Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pie Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Claims by Status
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[entry.name] ?? '#94a3b8'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={((value: unknown) => [`${(value as number)} claim${(value as number) !== 1 ? 's' : ''}`, '']) as never}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Aging Buckets (SLA)
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={((value: unknown) => [`${(value as number)} claim${(value as number) !== 1 ? 's' : ''}`, 'Count']) as never}
                />
                <Bar dataKey="count" fill={AGING_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bottom Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* Attention Required */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Attention Required
              </h2>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                {attentionItems.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {attentionItems.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">All clear — no issues found.</p>
              ) : (
                attentionItems.map((item, i) => (
                  <div
                    key={`${item.claimId}-${item.issueType}-${i}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/claims/${item.claimId}`)}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          {item.billNo}
                        </button>
                        <RiskFlagBadge type={item.issueType} label={item.issueLabel} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{item.trainerName}</p>
                      <p className="text-xs text-gray-400">
                        Aging: <span className={item.issueType === 'sla' ? 'font-semibold text-red-600' : 'text-gray-600'}>{item.agingDays}d</span>
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/claims/${item.claimId}`)}
                      className="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {item.actionLabel}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Submissions */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Recent Submissions
              </h2>
              <button
                onClick={() => goToQueue()}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                View all
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Bill No</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Trainer</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {recentClaims.map((c) => (
                    <tr
                      key={c.claimId}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => navigate(`/claims/${c.claimId}`)}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-blue-600">{c.billNo}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{c.trainerName}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-800 font-medium">
                        {formatINR(c.totalClaimedAmount)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">
                        {formatDate(c.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount Breakdown MTD */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Amount Breakdown (MTD)
              </h2>
            </div>
            <div className="divide-y divide-gray-50 px-5 py-2">
              {[
                { label: 'Total Claimed', value: mtd.totalClaimed, color: 'text-gray-900', bgBar: 'bg-blue-400', pct: 100 },
                { label: 'Eligible', value: mtd.eligible, color: 'text-gray-700', bgBar: 'bg-blue-300', pct: mtd.totalClaimed ? (mtd.eligible / mtd.totalClaimed) * 100 : 0 },
                { label: 'Approved', value: mtd.totalApproved, color: 'text-green-700', bgBar: 'bg-green-400', pct: mtd.totalClaimed ? (mtd.totalApproved / mtd.totalClaimed) * 100 : 0 },
                { label: 'Deductions', value: mtd.deductions, color: 'text-red-600', bgBar: 'bg-red-400', pct: mtd.totalClaimed ? (mtd.deductions / mtd.totalClaimed) * 100 : 0 },
                { label: 'Recoverable', value: mtd.recoverable, color: 'text-amber-600', bgBar: 'bg-amber-400', pct: mtd.totalClaimed ? (mtd.recoverable / mtd.totalClaimed) * 100 : 0 },
                { label: 'Payment Pending', value: mtd.paymentPending, color: 'text-purple-700', bgBar: 'bg-purple-400', pct: mtd.totalClaimed ? (mtd.paymentPending / mtd.totalClaimed) * 100 : 0 },
                { label: 'Paid', value: mtd.paid, color: 'text-emerald-700', bgBar: 'bg-emerald-400', pct: mtd.totalClaimed ? (mtd.paid / mtd.totalClaimed) * 100 : 0 },
              ].map(({ label, value, color, bgBar, pct }) => (
                <div key={label} className="py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={`text-xs font-semibold ${color}`}>{formatINR(value)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full ${bgBar} transition-all duration-500`}
                      style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}


