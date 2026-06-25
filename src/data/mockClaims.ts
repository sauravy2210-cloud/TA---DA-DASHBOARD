import type {
  ClaimHeader,
  ClaimLineItem,
  ClaimAttachment,
  ClaimStatusHistory,
  ClaimRemarks,
  ExceptionRequest,
  PaymentRecord,
  AuditLog,
} from '../types';

// ── Claim Headers ───────────────────────────────────────────────────────────────────────────

export const mockClaims: ClaimHeader[] = [
  // 1. Imran Khan – TechMah, Hyderabad – Submitted, missing docs, aging 3d
  {
    claimId: 'clm-0051',
    billNo: 'TA-2026-0051',
    trainerId: 'trainer-001',
    trainerName: 'Imran Khan',
    assignmentIds: ['asgn-HYD-2026-112'],
    batchIds: ['batch-HYD-112'],
    clientName: 'TechMah Solutions',
    courseName: 'DevOps Fundamentals',
    trainingLocation: 'TechMah Office, Hitech City',
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

  // 2. Rahul Verma – CyberCorp, Gurgaon – Under Review, exception, aging 5d
  {
    claimId: 'clm-0042',
    billNo: 'TA-2026-0042',
    trainerId: 'trainer-002',
    trainerName: 'Rahul Verma',
    assignmentIds: ['asgn-GGN-2026-087'],
    batchIds: ['batch-GGN-087'],
    clientName: 'CyberCorp Technologies',
    courseName: 'Cybersecurity Advanced',
    trainingLocation: 'CyberCorp Campus, Sector 44',
    claimStartDate: '2026-06-15',
    claimEndDate: '2026-06-19',
    baseCity: 'Mumbai',
    destinationCities: ['Gurgaon'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-19T09:30:00.000Z',
    lastActionAt: '2026-06-19T14:00:00.000Z',
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

  // 3. Anita Rao – Globant, Pune – Clarification Required, pendingWith Trainer, aging 8d
  {
    claimId: 'clm-0039',
    billNo: 'TA-2026-0039',
    trainerId: 'trainer-003',
    trainerName: 'Anita Rao',
    assignmentIds: ['asgn-PNE-2026-055'],
    batchIds: ['batch-PNE-055'],
    clientName: 'Globant India',
    courseName: 'Agile & Scrum',
    trainingLocation: 'Globant Office, Baner',
    claimStartDate: '2026-06-08',
    claimEndDate: '2026-06-13',
    baseCity: 'Pune',
    destinationCities: ['Pune'],
    status: 'Clarification Required',
    pendingWith: 'Trainer',
    submittedAt: '2026-06-16T11:00:00.000Z',
    lastActionAt: '2026-06-18T14:30:00.000Z',
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

  // 4. Priya Nair – Infosys, Bangalore – Approved, deduction 1400
  {
    claimId: 'clm-0033',
    billNo: 'TA-2026-0033',
    trainerId: 'trainer-004',
    trainerName: 'Priya Nair',
    assignmentIds: ['asgn-BLR-2026-041'],
    batchIds: ['batch-BLR-041'],
    clientName: 'Infosys Limited',
    courseName: 'Cloud Architecture',
    trainingLocation: 'Infosys Electronics City Campus',
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

  // 5. Vikram Joshi – Accenture, Mumbai – Payment Pending
  {
    claimId: 'clm-0028',
    billNo: 'TA-2026-0028',
    trainerId: 'trainer-005',
    trainerName: 'Vikram Joshi',
    assignmentIds: ['asgn-MUM-2026-033'],
    batchIds: ['batch-MUM-033'],
    clientName: 'Accenture Solutions',
    courseName: 'SAP S/4HANA',
    trainingLocation: 'Accenture Bandra Kurla Complex',
    claimStartDate: '2026-05-28',
    claimEndDate: '2026-06-01',
    baseCity: 'Pune',
    destinationCities: ['Mumbai'],
    status: 'Payment Pending',
    pendingWith: 'Finance',
    submittedAt: '2026-06-05T09:00:00.000Z',
    lastActionAt: '2026-06-11T12:05:00.000Z',
    totalClaimedAmount: 37800,
    eligibleAmount: 36500,
    approvedAmount: 36500,
    deductionAmount: 1300,
    advanceAdjusted: 0,
    miscAdjustments: 2500,
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

  // 6. Rahul Verma – Emirates NBD, Dubai – Under Review, international, high value, aging 2d
  {
    claimId: 'clm-0044',
    billNo: 'TA-2026-0044',
    trainerId: 'trainer-002',
    trainerName: 'Rahul Verma',
    assignmentIds: ['asgn-DXB-2026-009'],
    batchIds: ['batch-DXB-009'],
    clientName: 'Emirates NBD Bank',
    courseName: 'Digital Banking Transformation',
    trainingLocation: 'Emirates NBD Tower, DIFC',
    claimStartDate: '2026-06-16',
    claimEndDate: '2026-06-20',
    baseCity: 'Mumbai',
    destinationCities: ['Dubai'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-22T07:45:00.000Z',
    lastActionAt: '2026-06-22T11:00:00.000Z',
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

  // 7. Priya Nair – KPMG multi-assignment – Draft
  {
    claimId: 'clm-0047',
    billNo: 'TA-2026-0047',
    trainerId: 'trainer-004',
    trainerName: 'Priya Nair',
    assignmentIds: ['asgn-MUM-2026-048', 'asgn-MUM-2026-049'],
    batchIds: ['batch-MUM-048', 'batch-MUM-049'],
    clientName: 'KPMG India',
    courseName: 'Risk & Compliance',
    trainingLocation: 'KPMG Office, Lodha Supremus',
    claimStartDate: '2026-06-23',
    claimEndDate: '2026-06-23',
    baseCity: 'Kochi',
    destinationCities: ['Mumbai'],
    status: 'Draft',
    pendingWith: 'Trainer',
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

  // 8. Anita Rao – Globant – Paid
  {
    claimId: 'clm-0049',
    billNo: 'TA-2026-0049',
    trainerId: 'trainer-003',
    trainerName: 'Anita Rao',
    assignmentIds: ['asgn-PNE-2026-044'],
    batchIds: ['batch-PNE-044'],
    clientName: 'Globant India',
    courseName: 'React & Next.js',
    trainingLocation: 'Globant Office, Magarpatta',
    claimStartDate: '2026-05-25',
    claimEndDate: '2026-05-28',
    baseCity: 'Pune',
    destinationCities: ['Delhi'],
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

  // 9. Vikram Joshi – TCS Chennai – Rejected, deadline expired
  {
    claimId: 'clm-0035',
    billNo: 'TA-2026-0035',
    trainerId: 'trainer-005',
    trainerName: 'Vikram Joshi',
    assignmentIds: ['asgn-CHN-2026-022'],
    batchIds: ['batch-CHN-022'],
    clientName: 'Tata Consultancy Services',
    courseName: 'Java Enterprise',
    trainingLocation: 'TCS Sholinganallur Campus',
    claimStartDate: '2026-05-10',
    claimEndDate: '2026-05-15',
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

  // 10. Rahul Verma – Wipro Hyderabad – SLA Breached, aging 12d
  {
    claimId: 'clm-0038',
    billNo: 'TA-2026-0038',
    trainerId: 'trainer-002',
    trainerName: 'Rahul Verma',
    assignmentIds: ['asgn-HYD-2026-098'],
    batchIds: ['batch-HYD-098'],
    clientName: 'Wipro Technologies',
    courseName: 'DevSecOps',
    trainingLocation: 'Wipro SEZ, Gachibowli',
    claimStartDate: '2026-06-08',
    claimEndDate: '2026-06-11',
    baseCity: 'Mumbai',
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

  // 11. Imran Khan – HCL Noida – Ledger Mismatch, Under Review
  {
    claimId: 'clm-0045',
    billNo: 'TA-2026-0045',
    trainerId: 'trainer-001',
    trainerName: 'Imran Khan',
    assignmentIds: ['asgn-NOI-2026-061'],
    batchIds: ['batch-NOI-061'],
    clientName: 'HCL Technologies',
    courseName: 'Kubernetes & Docker',
    trainingLocation: 'HCL Noida Sector 60',
    claimStartDate: '2026-06-16',
    claimEndDate: '2026-06-19',
    baseCity: 'Delhi',
    destinationCities: ['Noida'],
    status: 'Under Review',
    pendingWith: 'Finance',
    submittedAt: '2026-06-20T12:00:00.000Z',
    lastActionAt: '2026-06-20T15:00:00.000Z',
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

  // 12. Priya Nair – Deloitte Hyderabad – Exception (personal stay-back), recoverable 5400
  {
    claimId: 'clm-0046',
    billNo: 'TA-2026-0046',
    trainerId: 'trainer-004',
    trainerName: 'Priya Nair',
    assignmentIds: ['asgn-HYD-2026-105'],
    batchIds: ['batch-HYD-105'],
    clientName: 'Deloitte India',
    courseName: 'Data Analytics',
    trainingLocation: 'Deloitte USI, Hyderabad',
    claimStartDate: '2026-06-14',
    claimEndDate: '2026-06-18',
    baseCity: 'Kochi',
    destinationCities: ['Hyderabad'],
    status: 'Under Review',
    pendingWith: 'HR/Admin',
    submittedAt: '2026-06-21T11:30:00.000Z',
    lastActionAt: '2026-06-21T14:00:00.000Z',
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

  // 13. Vikram Joshi – Tech Mahindra Pune – Partially Approved
  {
    claimId: 'clm-0050',
    billNo: 'TA-2026-0050',
    trainerId: 'trainer-005',
    trainerName: 'Vikram Joshi',
    assignmentIds: ['asgn-PNE-2026-067'],
    batchIds: ['batch-PNE-067'],
    clientName: 'Tech Mahindra',
    courseName: 'ServiceNow ITSM',
    trainingLocation: 'Tech Mahindra SEZ, Pune',
    claimStartDate: '2026-06-08',
    claimEndDate: '2026-06-12',
    baseCity: 'Pune',
    destinationCities: ['Bangalore'],
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

// ── Line Items ────────────────────────────────────────────────────────────────────────────────

export const mockLineItems: ClaimLineItem[] = [
  // TA-2026-0051 – Imran Khan, Hyderabad
  { lineItemId: 'li-0051-01', claimId: 'clm-0051', expenseType: 'TA', description: 'Train ticket – Nizamuddin to Secunderabad (AC 2T)', date: '2026-06-18', claimedAmount: 3800, policyLimit: 5000, eligibleAmount: 3800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0051-02', claimId: 'clm-0051', expenseType: 'DA', description: 'Daily allowance – Hyderabad (4 days × ₹1,200)', date: '2026-06-18', claimedAmount: 4800, policyLimit: 4800, eligibleAmount: 4800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0051-03', claimId: 'clm-0051', expenseType: 'Lodging', description: 'Hotel Novotel Hyderabad (4 nights)', date: '2026-06-18', claimedAmount: 16800, policyLimit: 16800, eligibleAmount: 16800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0051-04', claimId: 'clm-0051', expenseType: 'Cab', description: 'Airport–Hotel–Venue–Airport local cabs', date: '2026-06-18', claimedAmount: 3000, policyLimit: 3000, eligibleAmount: 3000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },

  // TA-2026-0042 – Rahul Verma, Gurgaon
  { lineItemId: 'li-0042-01', claimId: 'clm-0042', expenseType: 'TA', description: 'Flight – Delhi IGI to Gurgaon area + cab', date: '2026-06-15', claimedAmount: 5600, policyLimit: 8000, eligibleAmount: 5600, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0042-02', claimId: 'clm-0042', expenseType: 'DA', description: 'Daily allowance – Gurgaon Metro (5 days × ₹1,400)', date: '2026-06-15', claimedAmount: 7000, policyLimit: 7000, eligibleAmount: 7000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0042-03', claimId: 'clm-0042', expenseType: 'Lodging', description: 'Marriott Gurgaon (5 nights)', date: '2026-06-15', claimedAmount: 24000, policyLimit: 24000, eligibleAmount: 24000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0042-04', claimId: 'clm-0042', expenseType: 'Other', description: 'Client dinner – pre-approved BD event (exception)', date: '2026-06-17', claimedAmount: 6200, policyLimit: 3000, eligibleAmount: 3000, approvedAmount: 0, deductionAmount: 3200, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: true },

  // TA-2026-0039 – Anita Rao, Pune
  { lineItemId: 'li-0039-01', claimId: 'clm-0039', expenseType: 'TA', description: 'Train – Pune to Hyderabad return (AC 3T)', date: '2026-06-08', claimedAmount: 4200, policyLimit: 5000, eligibleAmount: 4200, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0039-02', claimId: 'clm-0039', expenseType: 'DA', description: 'Daily allowance – Pune (6 days × ₹1,000)', date: '2026-06-08', claimedAmount: 6000, policyLimit: 6000, eligibleAmount: 6000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0039-03', claimId: 'clm-0039', expenseType: 'Lodging', description: 'Hyatt Regency Pune (6 nights)', date: '2026-06-08', claimedAmount: 19200, policyLimit: 19200, eligibleAmount: 19200, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0039-04', claimId: 'clm-0039', expenseType: 'Cab', description: 'Local cab charges (receipts partially available)', date: '2026-06-10', claimedAmount: 1800, policyLimit: 1800, eligibleAmount: 1800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: false, exceptionRequired: false },

  // TA-2026-0033 – Priya Nair, Bangalore
  { lineItemId: 'li-0033-01', claimId: 'clm-0033', expenseType: 'TA', description: 'Flight – Kochi to Bangalore return', date: '2026-06-06', claimedAmount: 5400, policyLimit: 8000, eligibleAmount: 5400, approvedAmount: 5400, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0033-02', claimId: 'clm-0033', expenseType: 'DA', description: 'Daily allowance – Bangalore Metro (3 days × ₹1,400)', date: '2026-06-06', claimedAmount: 4200, policyLimit: 4200, eligibleAmount: 4200, approvedAmount: 4200, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0033-03', claimId: 'clm-0033', expenseType: 'Lodging', description: 'Taj Vivanta Bangalore (3 nights)', date: '2026-06-06', claimedAmount: 9000, policyLimit: 7600, eligibleAmount: 7600, approvedAmount: 7600, deductionAmount: 1400, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Hotel rate ₹3,000/night exceeds Metro policy limit ₹2,533/night. Approved at policy cap.', reasonCode: 'RC020_HOTEL_RATE_EXCEEDED' },

  // TA-2026-0028 – Vikram Joshi, Mumbai
  { lineItemId: 'li-0028-01', claimId: 'clm-0028', expenseType: 'TA', description: 'Flight – Pune to Mumbai return', date: '2026-05-28', claimedAmount: 4800, policyLimit: 8000, eligibleAmount: 4800, approvedAmount: 4800, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0028-02', claimId: 'clm-0028', expenseType: 'DA', description: 'Daily allowance – Mumbai Metro (5 days × ₹1,400)', date: '2026-05-28', claimedAmount: 7000, policyLimit: 7000, eligibleAmount: 7000, approvedAmount: 7000, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0028-03', claimId: 'clm-0028', expenseType: 'Lodging', description: 'Trident Hotel BKC (5 nights)', date: '2026-05-28', claimedAmount: 21000, policyLimit: 21000, eligibleAmount: 21000, approvedAmount: 21000, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0028-04', claimId: 'clm-0028', expenseType: 'Cab', description: 'Airport cab charges (1 receipt missing)', date: '2026-05-28', claimedAmount: 5000, policyLimit: 5000, eligibleAmount: 3700, approvedAmount: 3700, deductionAmount: 1300, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'One cab receipt of ₹1,300 not provided. Deducted.', reasonCode: 'RC002_NO_RECEIPT' },

  // TA-2026-0044 – Rahul Verma, Dubai (international)
  { lineItemId: 'li-0044-01', claimId: 'clm-0044', expenseType: 'TA', description: 'Return flight – Delhi IGI to Dubai DXB (Economy)', date: '2026-06-15', claimedAmount: 38000, policyLimit: 50000, eligibleAmount: 38000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0044-02', claimId: 'clm-0044', expenseType: 'DA', description: 'Daily allowance – Dubai International (5 days × ₹3,500)', date: '2026-06-16', claimedAmount: 17500, policyLimit: 17500, eligibleAmount: 17500, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0044-03', claimId: 'clm-0044', expenseType: 'Lodging', description: 'Radisson Blu DIFC Dubai (5 nights)', date: '2026-06-16', claimedAmount: 34000, policyLimit: 22000, eligibleAmount: 22000, approvedAmount: 0, deductionAmount: 12000, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: true },
  { lineItemId: 'li-0044-04', claimId: 'clm-0044', expenseType: 'Cab', description: 'Airport–Hotel–Client office transfers Dubai', date: '2026-06-16', claimedAmount: 6900, policyLimit: 6900, eligibleAmount: 6900, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },

  // TA-2026-0047 – Priya Nair, KPMG (draft – placeholder only)
  { lineItemId: 'li-0047-01', claimId: 'clm-0047', expenseType: 'TA', description: 'Placeholder – travel details pending (draft)', date: '2026-06-23', claimedAmount: 0, policyLimit: 0, eligibleAmount: 0, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },

  // TA-2026-0049 – Anita Rao, Delhi (paid)
  { lineItemId: 'li-0049-01', claimId: 'clm-0049', expenseType: 'TA', description: 'Flight – Pune to Delhi return', date: '2026-05-25', claimedAmount: 7200, policyLimit: 8000, eligibleAmount: 7200, approvedAmount: 7200, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0049-02', claimId: 'clm-0049', expenseType: 'DA', description: 'Daily allowance – Delhi Metro (4 days × ₹1,400)', date: '2026-05-25', claimedAmount: 5600, policyLimit: 5600, eligibleAmount: 5600, approvedAmount: 5600, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0049-03', claimId: 'clm-0049', expenseType: 'Lodging', description: 'Leela Palace Delhi (4 nights)', date: '2026-05-25', claimedAmount: 15200, policyLimit: 14400, eligibleAmount: 14400, approvedAmount: 14400, deductionAmount: 800, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Rate ₹3,800/night exceeds Delhi Tier-1 cap ₹3,600/night. Adjusted ₹800.', reasonCode: 'RC020_HOTEL_RATE_EXCEEDED' },
  { lineItemId: 'li-0049-04', claimId: 'clm-0049', expenseType: 'Cab', description: 'Uber/Ola local cabs Delhi', date: '2026-05-26', claimedAmount: 2200, policyLimit: 2200, eligibleAmount: 2200, approvedAmount: 2200, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },

  // TA-2026-0035 – Vikram Joshi, TCS Chennai (rejected)
  { lineItemId: 'li-0035-01', claimId: 'clm-0035', expenseType: 'TA', description: 'Train – Pune to Chennai (AC 2T)', date: '2026-05-10', claimedAmount: 4200, policyLimit: 5000, eligibleAmount: 0, approvedAmount: 0, deductionAmount: 4200, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Claim rejected – submission deadline expired', reasonCode: 'RC008_DATE_OUT_OF_RANGE' },
  { lineItemId: 'li-0035-02', claimId: 'clm-0035', expenseType: 'DA', description: 'Daily allowance – Chennai Tier-1 (6 days × ₹1,200)', date: '2026-05-10', claimedAmount: 7200, policyLimit: 7200, eligibleAmount: 0, approvedAmount: 0, deductionAmount: 7200, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false, trainerVisibleRemark: 'Claim rejected – submission deadline expired', reasonCode: 'RC008_DATE_OUT_OF_RANGE' },
  { lineItemId: 'li-0035-03', claimId: 'clm-0035', expenseType: 'Lodging', description: 'ITC Grand Chola Chennai (6 nights)', date: '2026-05-10', claimedAmount: 11100, policyLimit: 11100, eligibleAmount: 0, approvedAmount: 0, deductionAmount: 11100, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Claim rejected – submission deadline expired', reasonCode: 'RC008_DATE_OUT_OF_RANGE' },

  // TA-2026-0038 – Rahul Verma, Wipro Hyderabad (SLA breached)
  { lineItemId: 'li-0038-01', claimId: 'clm-0038', expenseType: 'TA', description: 'Flight – Mumbai to Hyderabad return', date: '2026-06-08', claimedAmount: 7800, policyLimit: 8000, eligibleAmount: 7800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0038-02', claimId: 'clm-0038', expenseType: 'DA', description: 'Daily allowance – Hyderabad Tier-1 (4 days × ₹1,200)', date: '2026-06-08', claimedAmount: 4800, policyLimit: 4800, eligibleAmount: 4800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0038-03', claimId: 'clm-0038', expenseType: 'Lodging', description: 'Novotel Hyderabad Convention (4 nights)', date: '2026-06-08', claimedAmount: 15200, policyLimit: 15200, eligibleAmount: 15200, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0038-04', claimId: 'clm-0038', expenseType: 'Cab', description: 'Local cab and auto charges', date: '2026-06-09', claimedAmount: 1800, policyLimit: 1800, eligibleAmount: 1800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0038-05', claimId: 'clm-0038', expenseType: 'Other', description: 'Stationery and miscellaneous training expenses', date: '2026-06-10', claimedAmount: 4000, policyLimit: 4000, eligibleAmount: 4000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: false, exceptionRequired: false },

  // TA-2026-0045 – Imran Khan, HCL Noida (ledger mismatch)
  { lineItemId: 'li-0045-01', claimId: 'clm-0045', expenseType: 'TA', description: 'Delhi Metro pass – Rajiv Chowk to Noida Sec 62 (5 days)', date: '2026-06-16', claimedAmount: 1000, policyLimit: 1000, eligibleAmount: 1000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0045-02', claimId: 'clm-0045', expenseType: 'DA', description: 'Daily allowance – Noida Tier-1 (4 days × ₹1,200)', date: '2026-06-16', claimedAmount: 4800, policyLimit: 4800, eligibleAmount: 4800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0045-03', claimId: 'clm-0045', expenseType: 'Lodging', description: 'Crowne Plaza Noida (4 nights)', date: '2026-06-16', claimedAmount: 12800, policyLimit: 12800, eligibleAmount: 12800, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Vendor ledger shows ₹3,800/night, claimed ₹4,200/night. Discrepancy ₹1,600 total. Pending reconciliation.', reasonCode: 'RC022_LEDGER_MISMATCH' },
  { lineItemId: 'li-0045-04', claimId: 'clm-0045', expenseType: 'Cab', description: 'Cab from Delhi railway station to Noida and return', date: '2026-06-16', claimedAmount: 1200, policyLimit: 1200, eligibleAmount: 1200, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },

  // TA-2026-0046 – Priya Nair, Deloitte Hyderabad (exception – personal stayback)
  { lineItemId: 'li-0046-01', claimId: 'clm-0046', expenseType: 'TA', description: 'Flight – Mumbai to Hyderabad return', date: '2026-06-14', claimedAmount: 6200, policyLimit: 8000, eligibleAmount: 6200, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0046-02', claimId: 'clm-0046', expenseType: 'DA', description: 'Daily allowance – Hyderabad (5 days × ₹1,200)', date: '2026-06-14', claimedAmount: 6000, policyLimit: 6000, eligibleAmount: 6000, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0046-03', claimId: 'clm-0046', expenseType: 'Lodging', description: 'Lemon Tree Hyderabad – 5 official + 2 personal nights (exception flagged)', date: '2026-06-14', claimedAmount: 15400, policyLimit: 11000, eligibleAmount: 11000, approvedAmount: 0, deductionAmount: 5400, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: true, trainerVisibleRemark: 'Two personal stayback nights totalling ₹5,400 flagged as recoverable. Pending exception approval.', reasonCode: 'RC005_PERSONAL_STAYBACK' },
  { lineItemId: 'li-0046-04', claimId: 'clm-0046', expenseType: 'Cab', description: 'Airport and local cabs Hyderabad', date: '2026-06-15', claimedAmount: 2200, policyLimit: 2200, eligibleAmount: 2200, approvedAmount: 0, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: false, exceptionRequired: false },

  // TA-2026-0050 – Vikram Joshi, Tech Mahindra Pune (partial approval)
  { lineItemId: 'li-0050-01', claimId: 'clm-0050', expenseType: 'TA', description: 'Flight – Pune to Bangalore return (Business class, economy approved)', date: '2026-06-08', claimedAmount: 14200, policyLimit: 8000, eligibleAmount: 8000, approvedAmount: 8000, deductionAmount: 6200, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Business class not permitted per policy. Approved at economy benchmark ₹8,000. Deducted ₹6,200.', reasonCode: 'RC001_OVER_POLICY_LIMIT' },
  { lineItemId: 'li-0050-02', claimId: 'clm-0050', expenseType: 'DA', description: 'Daily allowance – Pune (5 days × ₹1,000)', date: '2026-06-08', claimedAmount: 5000, policyLimit: 5000, eligibleAmount: 5000, approvedAmount: 5000, deductionAmount: 0, currency: 'INR', receiptRequired: false, receiptUploaded: false, exceptionRequired: false },
  { lineItemId: 'li-0050-03', claimId: 'clm-0050', expenseType: 'Lodging', description: 'Novotel Pune (5 nights)', date: '2026-06-08', claimedAmount: 15000, policyLimit: 15000, eligibleAmount: 15000, approvedAmount: 15000, deductionAmount: 0, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false },
  { lineItemId: 'li-0050-04', claimId: 'clm-0050', expenseType: 'Cab', description: 'Local cab charges – 7 trips, 2 without receipts', date: '2026-06-09', claimedAmount: 7000, policyLimit: 7000, eligibleAmount: 3800, approvedAmount: 3800, deductionAmount: 3200, currency: 'INR', receiptRequired: true, receiptUploaded: true, exceptionRequired: false, trainerVisibleRemark: 'Two cab trips totalling ₹3,200 lack receipts. Deducted per policy.', reasonCode: 'RC002_NO_RECEIPT' },
];

// ── Attachments ────────────────────────────────────────────────────────────────────────────

export const mockAttachments: ClaimAttachment[] = [
  // TA-2026-0051 – missing hotel invoice flagged
  { attachmentId: 'att-0051-01', claimId: 'clm-0051', fileName: 'IRCTC_Train_Ticket_18Jun2026.pdf', fileType: 'pdf', fileSize: 142000, uploadedAt: '2026-06-21T10:00:00.000Z', uploadedBy: 'Imran Khan', category: 'Ticket', verified: true },
  { attachmentId: 'att-0051-02', claimId: 'clm-0051', fileName: 'Hotel_Novotel_Hyderabad_Invoice.pdf', fileType: 'pdf', fileSize: 0, uploadedAt: '2026-06-21T10:05:00.000Z', uploadedBy: 'Imran Khan', category: 'Hotel Invoice', verified: false },
  { attachmentId: 'att-0051-03', claimId: 'clm-0051', fileName: 'Cab_Receipts_OLA_Hyderabad.jpg', fileType: 'jpg', fileSize: 210000, uploadedAt: '2026-06-21T10:08:00.000Z', uploadedBy: 'Imran Khan', category: 'Cab Receipt', verified: true },

  // TA-2026-0042 – Rahul Verma Gurgaon
  { attachmentId: 'att-0042-01', claimId: 'clm-0042', fileName: 'IndiGo_6E_BoardingPass_15Jun2026.pdf', fileType: 'pdf', fileSize: 188000, uploadedAt: '2026-06-19T09:20:00.000Z', uploadedBy: 'Rahul Verma', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0042-02', claimId: 'clm-0042', fileName: 'Marriott_Gurgaon_Folio_Invoice.pdf', fileType: 'pdf', fileSize: 302000, uploadedAt: '2026-06-19T09:22:00.000Z', uploadedBy: 'Rahul Verma', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0042-03', claimId: 'clm-0042', fileName: 'Client_Dinner_Exception_Justification.pdf', fileType: 'pdf', fileSize: 95000, uploadedAt: '2026-06-19T09:25:00.000Z', uploadedBy: 'Rahul Verma', category: 'Other', verified: false },

  // TA-2026-0039 – Anita Rao Pune
  { attachmentId: 'att-0039-01', claimId: 'clm-0039', fileName: 'IRCTC_Ticket_PuneHyderabadReturn.pdf', fileType: 'pdf', fileSize: 176000, uploadedAt: '2026-06-16T10:45:00.000Z', uploadedBy: 'Anita Rao', category: 'Ticket', verified: true },
  { attachmentId: 'att-0039-02', claimId: 'clm-0039', fileName: 'Hyatt_Regency_Pune_Invoice.pdf', fileType: 'pdf', fileSize: 261000, uploadedAt: '2026-06-16T10:48:00.000Z', uploadedBy: 'Anita Rao', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0039-03', claimId: 'clm-0039', fileName: 'Cab_Receipts_Pune_Partial.jpg', fileType: 'jpg', fileSize: 189000, uploadedAt: '2026-06-16T10:50:00.000Z', uploadedBy: 'Anita Rao', category: 'Cab Receipt', verified: false },

  // TA-2026-0033 – Priya Nair Bangalore
  { attachmentId: 'att-0033-01', claimId: 'clm-0033', fileName: 'IndiGo_Kochi_Bangalore_Ticket.pdf', fileType: 'pdf', fileSize: 155000, uploadedAt: '2026-06-10T09:30:00.000Z', uploadedBy: 'Priya Nair', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0033-02', claimId: 'clm-0033', fileName: 'TajVivanta_Bangalore_Folio.pdf', fileType: 'pdf', fileSize: 284000, uploadedAt: '2026-06-10T09:33:00.000Z', uploadedBy: 'Priya Nair', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0033-03', claimId: 'clm-0033', fileName: 'Expense_Summary_TA20260033.xlsx', fileType: 'xlsx', fileSize: 48000, uploadedAt: '2026-06-10T09:35:00.000Z', uploadedBy: 'Priya Nair', category: 'Other', verified: true },

  // TA-2026-0028 – Vikram Joshi Mumbai
  { attachmentId: 'att-0028-01', claimId: 'clm-0028', fileName: 'IndiGo_Pune_Mumbai_BoardingPass.pdf', fileType: 'pdf', fileSize: 163000, uploadedAt: '2026-06-05T09:00:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0028-02', claimId: 'clm-0028', fileName: 'Trident_BKC_Hotel_Invoice.pdf', fileType: 'pdf', fileSize: 317000, uploadedAt: '2026-06-05T09:03:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0028-03', claimId: 'clm-0028', fileName: 'Cab_4of5_Receipts_Mumbai.jpg', fileType: 'jpg', fileSize: 221000, uploadedAt: '2026-06-05T09:06:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Cab Receipt', verified: true },

  // TA-2026-0044 – Rahul Verma Dubai
  { attachmentId: 'att-0044-01', claimId: 'clm-0044', fileName: 'Emirates_EK_Boarding_Pass_Dubai.pdf', fileType: 'pdf', fileSize: 420000, uploadedAt: '2026-06-22T07:30:00.000Z', uploadedBy: 'Rahul Verma', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0044-02', claimId: 'clm-0044', fileName: 'Radisson_DIFC_Dubai_Invoice.pdf', fileType: 'pdf', fileSize: 398000, uploadedAt: '2026-06-22T07:33:00.000Z', uploadedBy: 'Rahul Verma', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0044-03', claimId: 'clm-0044', fileName: 'Exception_Approval_Request_Dubai.pdf', fileType: 'pdf', fileSize: 112000, uploadedAt: '2026-06-22T07:36:00.000Z', uploadedBy: 'Rahul Verma', category: 'Other', verified: false },

  // TA-2026-0047 – Priya Nair KPMG (draft)
  { attachmentId: 'att-0047-01', claimId: 'clm-0047', fileName: 'KPMG_Assignment_Confirmation.pdf', fileType: 'pdf', fileSize: 78000, uploadedAt: '2026-06-23T09:00:00.000Z', uploadedBy: 'Priya Nair', category: 'Other', verified: false },
  { attachmentId: 'att-0047-02', claimId: 'clm-0047', fileName: 'Travel_Plan_KPMG_Mumbai.pdf', fileType: 'pdf', fileSize: 64000, uploadedAt: '2026-06-23T09:02:00.000Z', uploadedBy: 'Priya Nair', category: 'Other', verified: false },

  // TA-2026-0049 – Anita Rao PAID
  { attachmentId: 'att-0049-01', claimId: 'clm-0049', fileName: 'AirIndia_Pune_Delhi_Ticket.pdf', fileType: 'pdf', fileSize: 199000, uploadedAt: '2026-06-03T09:50:00.000Z', uploadedBy: 'Anita Rao', category: 'Ticket', verified: true },
  { attachmentId: 'att-0049-02', claimId: 'clm-0049', fileName: 'Leela_Palace_Delhi_Invoice.pdf', fileType: 'pdf', fileSize: 345000, uploadedAt: '2026-06-03T09:53:00.000Z', uploadedBy: 'Anita Rao', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0049-03', claimId: 'clm-0049', fileName: 'Uber_Receipts_Delhi.png', fileType: 'png', fileSize: 188000, uploadedAt: '2026-06-03T09:55:00.000Z', uploadedBy: 'Anita Rao', category: 'Cab Receipt', verified: true },

  // TA-2026-0035 – Vikram Joshi Chennai (rejected)
  { attachmentId: 'att-0035-01', claimId: 'clm-0035', fileName: 'IRCTC_Pune_Chennai_Ticket.pdf', fileType: 'pdf', fileSize: 141000, uploadedAt: '2026-06-12T13:45:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Ticket', verified: false },
  { attachmentId: 'att-0035-02', claimId: 'clm-0035', fileName: 'ITC_GrandChola_Chennai_Invoice.pdf', fileType: 'pdf', fileSize: 278000, uploadedAt: '2026-06-12T13:48:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Hotel Invoice', verified: false },
  { attachmentId: 'att-0035-03', claimId: 'clm-0035', fileName: 'Late_Submission_Explanation.pdf', fileType: 'pdf', fileSize: 55000, uploadedAt: '2026-06-12T13:50:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Other', verified: false },

  // TA-2026-0038 – Rahul Verma Wipro Hyderabad (SLA breached)
  { attachmentId: 'att-0038-01', claimId: 'clm-0038', fileName: 'SpiceJet_Mumbai_Hyderabad_Boarding.pdf', fileType: 'pdf', fileSize: 171000, uploadedAt: '2026-06-12T08:00:00.000Z', uploadedBy: 'Rahul Verma', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0038-02', claimId: 'clm-0038', fileName: 'Novotel_Hyderabad_Convention_Folio.pdf', fileType: 'pdf', fileSize: 309000, uploadedAt: '2026-06-12T08:03:00.000Z', uploadedBy: 'Rahul Verma', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0038-03', claimId: 'clm-0038', fileName: 'Misc_Stationery_Bills.jpg', fileType: 'jpg', fileSize: 148000, uploadedAt: '2026-06-12T08:06:00.000Z', uploadedBy: 'Rahul Verma', category: 'Other', verified: false },

  // TA-2026-0045 – Imran Khan HCL Noida (ledger mismatch)
  { attachmentId: 'att-0045-01', claimId: 'clm-0045', fileName: 'Crowne_Plaza_Noida_Invoice.pdf', fileType: 'pdf', fileSize: 288000, uploadedAt: '2026-06-20T11:45:00.000Z', uploadedBy: 'Imran Khan', category: 'Hotel Invoice', verified: false },
  { attachmentId: 'att-0045-02', claimId: 'clm-0045', fileName: 'Delhi_Noida_Metro_Receipts.jpg', fileType: 'jpg', fileSize: 99000, uploadedAt: '2026-06-20T11:48:00.000Z', uploadedBy: 'Imran Khan', category: 'Ticket', verified: true },
  { attachmentId: 'att-0045-03', claimId: 'clm-0045', fileName: 'Ledger_Reconciliation_Note.pdf', fileType: 'pdf', fileSize: 72000, uploadedAt: '2026-06-20T12:00:00.000Z', uploadedBy: 'Imran Khan', category: 'Other', verified: false },

  // TA-2026-0046 – Priya Nair Deloitte Hyderabad (exception)
  { attachmentId: 'att-0046-01', claimId: 'clm-0046', fileName: 'IndiGo_Mumbai_Hyderabad_BoardingPass.pdf', fileType: 'pdf', fileSize: 158000, uploadedAt: '2026-06-21T11:15:00.000Z', uploadedBy: 'Priya Nair', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0046-02', claimId: 'clm-0046', fileName: 'LemonTree_Hyderabad_7Night_Invoice.pdf', fileType: 'pdf', fileSize: 312000, uploadedAt: '2026-06-21T11:18:00.000Z', uploadedBy: 'Priya Nair', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0046-03', claimId: 'clm-0046', fileName: 'Personal_Stayback_Exception_Request.pdf', fileType: 'pdf', fileSize: 88000, uploadedAt: '2026-06-21T11:20:00.000Z', uploadedBy: 'Priya Nair', category: 'Other', verified: false },

  // TA-2026-0050 – Vikram Joshi Tech Mahindra (partial approval)
  { attachmentId: 'att-0050-01', claimId: 'clm-0050', fileName: 'Vistara_BusinessClass_Boarding_PuneBlr.pdf', fileType: 'pdf', fileSize: 204000, uploadedAt: '2026-06-14T08:45:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Boarding Pass', verified: true },
  { attachmentId: 'att-0050-02', claimId: 'clm-0050', fileName: 'Novotel_Pune_Invoice_5Nights.pdf', fileType: 'pdf', fileSize: 277000, uploadedAt: '2026-06-14T08:48:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Hotel Invoice', verified: true },
  { attachmentId: 'att-0050-03', claimId: 'clm-0050', fileName: 'Partial_Cab_Receipts_Pune.jpg', fileType: 'jpg', fileSize: 168000, uploadedAt: '2026-06-14T08:50:00.000Z', uploadedBy: 'Vikram Joshi', category: 'Cab Receipt', verified: true },
];

// ── Status History ──────────────────────────────────────────────────────────────────────────

export const mockStatusHistory: ClaimStatusHistory[] = [
  // TA-2026-0051
  { historyId: 'sh-0051-01', claimId: 'clm-0051', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Imran Khan', changedByRole: 'Trainer', changedAt: '2026-06-20T08:00:00.000Z', remarks: 'Draft created after assignment completion.' },
  { historyId: 'sh-0051-02', claimId: 'clm-0051', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Imran Khan', changedByRole: 'Trainer', changedAt: '2026-06-21T10:15:00.000Z', remarks: 'Submitted for review. Hotel invoice to be shared separately.' },

  // TA-2026-0042
  { historyId: 'sh-0042-01', claimId: 'clm-0042', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Rahul Verma', changedByRole: 'Trainer', changedAt: '2026-06-18T14:00:00.000Z' },
  { historyId: 'sh-0042-02', claimId: 'clm-0042', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Rahul Verma', changedByRole: 'Trainer', changedAt: '2026-06-19T09:00:00.000Z', remarks: 'Submitted with exception request for client dinner.' },
  { historyId: 'sh-0042-03', claimId: 'clm-0042', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-19T14:00:00.000Z', remarks: 'Picked up for review. Exception amount under scrutiny.' },

  // TA-2026-0039
  { historyId: 'sh-0039-01', claimId: 'clm-0039', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Anita Rao', changedByRole: 'Trainer', changedAt: '2026-06-15T09:00:00.000Z' },
  { historyId: 'sh-0039-02', claimId: 'clm-0039', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Anita Rao', changedByRole: 'Trainer', changedAt: '2026-06-16T11:00:00.000Z', remarks: 'Submitted. Cab receipts partially available.' },
  { historyId: 'sh-0039-03', claimId: 'clm-0039', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-17T10:00:00.000Z' },
  { historyId: 'sh-0039-04', claimId: 'clm-0039', fromStatus: 'Under Review', toStatus: 'Clarification Required', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-18T14:30:00.000Z', remarks: 'Cab receipt amounts do not match bank statement. Please provide all 4 cab receipts.' },

  // TA-2026-0033
  { historyId: 'sh-0033-01', claimId: 'clm-0033', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Priya Nair', changedByRole: 'Trainer', changedAt: '2026-06-09T08:00:00.000Z' },
  { historyId: 'sh-0033-02', claimId: 'clm-0033', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Priya Nair', changedByRole: 'Trainer', changedAt: '2026-06-10T10:00:00.000Z' },
  { historyId: 'sh-0033-03', claimId: 'clm-0033', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-11T09:30:00.000Z' },
  { historyId: 'sh-0033-04', claimId: 'clm-0033', fromStatus: 'Under Review', toStatus: 'Approved', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-14T15:30:00.000Z', remarks: 'Approved with deduction of ₹1,400 on hotel (exceeds Metro city limit).' },

  // TA-2026-0028
  { historyId: 'sh-0028-01', claimId: 'clm-0028', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Vikram Joshi', changedByRole: 'Trainer', changedAt: '2026-06-04T10:00:00.000Z' },
  { historyId: 'sh-0028-02', claimId: 'clm-0028', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Vikram Joshi', changedByRole: 'Trainer', changedAt: '2026-06-05T09:00:00.000Z' },
  { historyId: 'sh-0028-03', claimId: 'clm-0028', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-06T10:00:00.000Z' },
  { historyId: 'sh-0028-04', claimId: 'clm-0028', fromStatus: 'Under Review', toStatus: 'Approved', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-11T12:00:00.000Z', remarks: 'Approved. One cab receipt missing – ₹1,300 deducted.' },
  { historyId: 'sh-0028-05', claimId: 'clm-0028', fromStatus: 'Approved', toStatus: 'Payment Pending', changedBy: 'System', changedByRole: 'SuperAdmin', changedAt: '2026-06-11T12:05:00.000Z', remarks: 'Moved to Finance queue for disbursement.' },

  // TA-2026-0044
  { historyId: 'sh-0044-01', claimId: 'clm-0044', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Rahul Verma', changedByRole: 'Trainer', changedAt: '2026-06-21T06:00:00.000Z' },
  { historyId: 'sh-0044-02', claimId: 'clm-0044', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Rahul Verma', changedByRole: 'Trainer', changedAt: '2026-06-22T07:45:00.000Z', remarks: 'International claim – Dubai assignment. Exception for accommodation upgrade.' },
  { historyId: 'sh-0044-03', claimId: 'clm-0044', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-22T11:00:00.000Z', remarks: 'High-value international claim. Escalated for senior review.' },

  // TA-2026-0047 – draft only
  { historyId: 'sh-0047-01', claimId: 'clm-0047', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Priya Nair', changedByRole: 'Trainer', changedAt: '2026-06-23T09:00:00.000Z', remarks: 'Draft started for KPMG multi-assignment claim.' },

  // TA-2026-0049 – full lifecycle to Paid
  { historyId: 'sh-0049-01', claimId: 'clm-0049', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Anita Rao', changedByRole: 'Trainer', changedAt: '2026-06-02T08:00:00.000Z' },
  { historyId: 'sh-0049-02', claimId: 'clm-0049', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Anita Rao', changedByRole: 'Trainer', changedAt: '2026-06-03T10:00:00.000Z' },
  { historyId: 'sh-0049-03', claimId: 'clm-0049', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-04T10:00:00.000Z' },
  { historyId: 'sh-0049-04', claimId: 'clm-0049', fromStatus: 'Under Review', toStatus: 'Approved', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-08T14:00:00.000Z', remarks: 'Hotel adjusted to policy cap. Approved ₹29,400.' },
  { historyId: 'sh-0049-05', claimId: 'clm-0049', fromStatus: 'Approved', toStatus: 'Payment Pending', changedBy: 'System', changedByRole: 'SuperAdmin', changedAt: '2026-06-08T14:05:00.000Z' },
  { historyId: 'sh-0049-06', claimId: 'clm-0049', fromStatus: 'Payment Pending', toStatus: 'Paid', changedBy: 'Finance Team', changedByRole: 'Finance', changedAt: '2026-06-15T09:30:00.000Z', remarks: 'Payment disbursed via NEFT. UTR: UTR20260615001.' },

  // TA-2026-0035 – rejected
  { historyId: 'sh-0035-01', claimId: 'clm-0035', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Vikram Joshi', changedByRole: 'Trainer', changedAt: '2026-06-12T14:00:00.000Z', remarks: 'Late submission – assignment ended on 25 May 2026.' },
  { historyId: 'sh-0035-02', claimId: 'clm-0035', fromStatus: 'Submitted', toStatus: 'Rejected', changedBy: 'Admin', changedByRole: 'HRAdmin', changedAt: '2026-06-13T10:00:00.000Z', remarks: 'Submission received 18 days after assignment end. Policy deadline is 15 days. Claim rejected.' },

  // TA-2026-0038 – SLA breached
  { historyId: 'sh-0038-01', claimId: 'clm-0038', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Rahul Verma', changedByRole: 'Trainer', changedAt: '2026-06-11T10:00:00.000Z' },
  { historyId: 'sh-0038-02', claimId: 'clm-0038', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Rahul Verma', changedByRole: 'Trainer', changedAt: '2026-06-12T08:00:00.000Z' },
  { historyId: 'sh-0038-03', claimId: 'clm-0038', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-12T15:00:00.000Z' },
  { historyId: 'sh-0038-04', claimId: 'clm-0038', fromStatus: 'Under Review', toStatus: 'Under Review', changedBy: 'System', changedByRole: 'SuperAdmin', changedAt: '2026-06-20T08:00:00.000Z', remarks: 'SLA breached – 7 business days elapsed without resolution. Auto-escalated to Finance Head.' },

  // TA-2026-0045 – ledger mismatch
  { historyId: 'sh-0045-01', claimId: 'clm-0045', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Imran Khan', changedByRole: 'Trainer', changedAt: '2026-06-19T09:00:00.000Z' },
  { historyId: 'sh-0045-02', claimId: 'clm-0045', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Imran Khan', changedByRole: 'Trainer', changedAt: '2026-06-20T12:00:00.000Z' },
  { historyId: 'sh-0045-03', claimId: 'clm-0045', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Finance Team', changedByRole: 'Finance', changedAt: '2026-06-20T15:00:00.000Z', remarks: 'Vendor ledger mismatch detected. Claim sent for reconciliation.' },

  // TA-2026-0046 – exception personal stayback
  { historyId: 'sh-0046-01', claimId: 'clm-0046', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Priya Nair', changedByRole: 'Trainer', changedAt: '2026-06-20T10:00:00.000Z' },
  { historyId: 'sh-0046-02', claimId: 'clm-0046', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Priya Nair', changedByRole: 'Trainer', changedAt: '2026-06-21T11:30:00.000Z', remarks: 'Submitted with 2-night personal stayback included. Exception request attached.' },
  { historyId: 'sh-0046-03', claimId: 'clm-0046', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Neha Sharma', changedByRole: 'HRAdmin', changedAt: '2026-06-21T14:00:00.000Z', remarks: 'Personal stayback flagged as recoverable. Exception under review.' },

  // TA-2026-0050 – partial approval
  { historyId: 'sh-0050-01', claimId: 'clm-0050', fromStatus: 'Draft', toStatus: 'Draft', changedBy: 'Vikram Joshi', changedByRole: 'Trainer', changedAt: '2026-06-13T08:00:00.000Z' },
  { historyId: 'sh-0050-02', claimId: 'clm-0050', fromStatus: 'Draft', toStatus: 'Submitted', changedBy: 'Vikram Joshi', changedByRole: 'Trainer', changedAt: '2026-06-14T09:00:00.000Z' },
  { historyId: 'sh-0050-03', claimId: 'clm-0050', fromStatus: 'Submitted', toStatus: 'Under Review', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-15T10:00:00.000Z' },
  { historyId: 'sh-0050-04', claimId: 'clm-0050', fromStatus: 'Under Review', toStatus: 'Partially Approved', changedBy: 'Amit Kulkarni', changedByRole: 'HRAdmin', changedAt: '2026-06-20T16:00:00.000Z', remarks: 'Partial approval – business class fare over limit (₹6,200 deducted) and 2 unreceipted cab trips (₹3,200 deducted).' },
];

// ── Remarks ──────────────────────────────────────────────────────────────────────────────────

export const mockRemarks: ClaimRemarks[] = [
  // TA-2026-0051
  { remarkId: 'rmk-0051-01', claimId: 'clm-0051', type: 'HR', text: 'Hotel invoice for Novotel Hyderabad is missing. Please upload it to proceed with review.', createdBy: 'Neha Sharma', createdAt: '2026-06-21T14:00:00.000Z', visible: 'All' },
  { remarkId: 'rmk-0051-02', claimId: 'clm-0051', type: 'Internal', text: 'DA amount correctly calculated for 4 days at ₹1,200/day. No issue on that line.', createdBy: 'Neha Sharma', createdAt: '2026-06-21T14:05:00.000Z', visible: 'Internal' },

  // TA-2026-0042
  { remarkId: 'rmk-0042-01', claimId: 'clm-0042', type: 'HR', text: 'Client dinner amount of ₹6,200 exceeds the ₹3,000 entertainment policy limit. Exception approval required from Finance Head before this line can be cleared.', createdBy: 'Neha Sharma', createdAt: '2026-06-19T14:30:00.000Z', visible: 'All' },
  { remarkId: 'rmk-0042-02', claimId: 'clm-0042', type: 'Trainer', text: 'The client dinner was a pre-approved business development event attended by 8 CyberCorp leadership members. BDM Pradeep Singh can confirm via email on record.', createdBy: 'Rahul Verma', createdAt: '2026-06-20T10:00:00.000Z', visible: 'All' },

  // TA-2026-0039
  { remarkId: 'rmk-0039-01', claimId: 'clm-0039', type: 'HR', text: 'Cab receipts show only 2 of 4 trips. Claimed ₹1,800 but receipts only support ₹900. Please provide all receipts or revise the claim amount downward.', createdBy: 'Neha Sharma', createdAt: '2026-06-18T14:30:00.000Z', visible: 'All' },

  // TA-2026-0033
  { remarkId: 'rmk-0033-01', claimId: 'clm-0033', type: 'HR', text: 'Hotel rate of ₹3,000/night exceeds Metro city policy cap of ₹2,533/night. Deduction of ₹1,400 (3 nights × ₹467) applied. Remaining ₹17,200 approved.', createdBy: 'Amit Kulkarni', createdAt: '2026-06-14T15:30:00.000Z', visible: 'All' },

  // TA-2026-0038 – SLA escalation
  { remarkId: 'rmk-0038-01', claimId: 'clm-0038', type: 'System', text: 'SYSTEM ALERT: Claim TA-2026-0038 has exceeded the 7-business-day SLA. Auto-escalated to Finance Head (Sunita Mehta) on 20 Jun 2026.', createdBy: 'System', createdAt: '2026-06-20T08:00:00.000Z', visible: 'Internal' },
  { remarkId: 'rmk-0038-02', claimId: 'clm-0038', type: 'HR', text: 'Miscellaneous stationery bill of ₹4,000 lacks supporting context or itemised breakdown. Awaiting trainer clarification before this line can be approved.', createdBy: 'Neha Sharma', createdAt: '2026-06-13T11:00:00.000Z', visible: 'All' },

  // TA-2026-0045 – ledger mismatch
  { remarkId: 'rmk-0045-01', claimId: 'clm-0045', type: 'HR', text: 'Vendor ledger from Crowne Plaza Noida shows room rate ₹3,800/night, but claimed amount implies ₹4,200/night. Discrepancy of ₹400/night × 4 nights = ₹1,600. Sent for reconciliation with vendor.', createdBy: 'Finance Team', createdAt: '2026-06-20T15:00:00.000Z', visible: 'All' },

  // TA-2026-0046 – personal stayback
  { remarkId: 'rmk-0046-01', claimId: 'clm-0046', type: 'HR', text: 'Hotel nights 6 and 7 are confirmed as personal stayback. ₹5,400 (2 × ₹2,700) flagged as recoverable. Trainer must either withdraw these nights or obtain exception approval.', createdBy: 'Neha Sharma', createdAt: '2026-06-21T14:30:00.000Z', visible: 'All' },
  { remarkId: 'rmk-0046-02', claimId: 'clm-0046', type: 'Trainer', text: 'I missed my return flight because the client session ran 4 hours over schedule. No earlier flights were available. The 2 extra nights were unavoidable. Exception justification document has been uploaded.', createdBy: 'Priya Nair', createdAt: '2026-06-22T09:00:00.000Z', visible: 'All' },

  // TA-2026-0050 – partial approval
  { remarkId: 'rmk-0050-01', claimId: 'clm-0050', type: 'HR', text: 'Business class fare approved only at economy equivalent of ₹8,000 using Vistara Economy benchmark. Deducted ₹6,200. Two cab trips without receipts (₹3,200) also deducted per policy. Total deduction ₹9,400.', createdBy: 'Amit Kulkarni', createdAt: '2026-06-20T16:00:00.000Z', visible: 'All' },
];

// ── Exception Requests ──────────────────────────────────────────────────────────────────────

export const mockExceptions: ExceptionRequest[] = [
  // TA-2026-0042 – client dinner over limit
  {
    exceptionId: 'exc-0042-01',
    claimId: 'clm-0042',
    requestedBy: 'Rahul Verma',
    requestedAt: '2026-06-19T09:00:00.000Z',
    reason: 'Client dinner at CyberCorp was a pre-approved BD event with 8 senior stakeholders present. Total bill ₹6,200 shared across participants. BDM email approval on record.',
    amount: 3200,
    status: 'Pending',
  },

  // TA-2026-0044 – Dubai accommodation upgrade
  {
    exceptionId: 'exc-0044-01',
    claimId: 'clm-0044',
    requestedBy: 'Rahul Verma',
    requestedAt: '2026-06-22T07:45:00.000Z',
    reason: 'Emirates NBD required trainer to stay within the DIFC cluster for security clearance and proximity to the venue. Radisson Blu was the most economical DIFC-compliant option at the time of booking.',
    amount: 12000,
    status: 'Pending',
  },

  // TA-2026-0046 – personal stayback
  {
    exceptionId: 'exc-0046-01',
    claimId: 'clm-0046',
    requestedBy: 'Priya Nair',
    requestedAt: '2026-06-21T11:20:00.000Z',
    reason: 'Client session overran by 4 hours, causing missed return flight. Next available direct flight was 2 days later. Hotel extension of 2 nights (₹5,400) is requested as exception due to client-caused delay beyond trainer control.',
    amount: 5400,
    status: 'Pending',
  },

  // TA-2026-0035 – late submission (rejected)
  {
    exceptionId: 'exc-0035-01',
    claimId: 'clm-0035',
    requestedBy: 'Vikram Joshi',
    requestedAt: '2026-06-12T13:00:00.000Z',
    reason: 'Was on back-to-back assignments in Chennai and Bangalore without a break between engagements. Administrative processing of claim paperwork was delayed as a result.',
    amount: 22500,
    approvedBy: 'Admin',
    approvedAt: '2026-06-13T09:30:00.000Z',
    status: 'Rejected',
  },

  // TA-2026-0050 – business class over limit (rejected)
  {
    exceptionId: 'exc-0050-01',
    claimId: 'clm-0050',
    requestedBy: 'Vikram Joshi',
    requestedAt: '2026-06-14T09:00:00.000Z',
    reason: 'Business class booked on account of a documented back condition (medical note available) and unavailability of economy seats at time of booking 72 hours before travel.',
    amount: 6200,
    approvedBy: 'Amit Kulkarni',
    approvedAt: '2026-06-20T15:00:00.000Z',
    status: 'Rejected',
  },
];

// ── Payment Records ──────────────────────────────────────────────────────────────────────────

export const mockPayments: PaymentRecord[] = [
  // TA-2026-0028 – Vikram Joshi Mumbai – Payment initiated
  {
    paymentId: 'pay-0028-01',
    claimId: 'clm-0028',
    paidAmount: 34000,
    paymentDate: '2026-06-28',
    paymentMode: 'NEFT',
    referenceUTR: 'UTR20260628001',
    financeRemarks: 'Payment initiated. Expected credit to trainer account within 2 working days.',
    processedBy: 'Finance Team',
    processedAt: '2026-06-24T09:00:00.000Z',
  },

  // TA-2026-0049 – Anita Rao – Paid
  {
    paymentId: 'pay-0049-01',
    claimId: 'clm-0049',
    paidAmount: 29400,
    paymentDate: '2026-06-15',
    paymentMode: 'NEFT',
    referenceUTR: 'UTR20260615001',
    financeRemarks: 'Full approved amount credited to trainer account.',
    processedBy: 'Finance Team',
    processedAt: '2026-06-15T09:28:00.000Z',
  },

  // TA-2026-0033 – Priya Nair – Approved, awaiting Finance cycle
  {
    paymentId: 'pay-0033-01',
    claimId: 'clm-0033',
    paidAmount: 17200,
    paymentDate: '2026-06-30',
    paymentMode: 'IMPS',
    referenceUTR: 'PENDING-0033',
    financeRemarks: 'Scheduled for end-of-month payment cycle.',
    processedBy: 'Finance Team',
    processedAt: '2026-06-24T09:00:00.000Z',
  },

  // TA-2026-0050 – Vikram Joshi partial approval
  {
    paymentId: 'pay-0050-01',
    claimId: 'clm-0050',
    paidAmount: 31800,
    paymentDate: '2026-06-30',
    paymentMode: 'NEFT',
    referenceUTR: 'PENDING-0050',
    financeRemarks: 'Partial approval disbursement queued for Finance processing.',
    processedBy: 'Finance Team',
    processedAt: '2026-06-24T09:00:00.000Z',
  },
];

// ── Audit Logs ───────────────────────────────────────────────────────────────────────────────

export const mockAuditLogs: AuditLog[] = [
  // Claim submissions
  { logId: 'aud-001', claimId: 'clm-0051', entityType: 'ClaimHeader', entityId: 'clm-0051', action: 'CLAIM_SUBMITTED', performedBy: 'Imran Khan', performedByRole: 'Trainer', performedAt: '2026-06-21T10:15:00.000Z', ipAddress: '192.168.1.54', newValue: { claimedAmount: 28400, attachmentsUploaded: 3, missingDocumentFlag: true } },
  { logId: 'aud-002', claimId: 'clm-0042', entityType: 'ClaimHeader', entityId: 'clm-0042', action: 'CLAIM_SUBMITTED', performedBy: 'Rahul Verma', performedByRole: 'Trainer', performedAt: '2026-06-19T09:00:00.000Z', ipAddress: '10.0.0.22', newValue: { claimedAmount: 42800, exceptionFlagged: true } },
  { logId: 'aud-003', claimId: 'clm-0039', entityType: 'ClaimHeader', entityId: 'clm-0039', action: 'CLAIM_SUBMITTED', performedBy: 'Anita Rao', performedByRole: 'Trainer', performedAt: '2026-06-16T11:00:00.000Z', ipAddress: '10.0.0.31', newValue: { claimedAmount: 31200 } },
  { logId: 'aud-004', claimId: 'clm-0033', entityType: 'ClaimHeader', entityId: 'clm-0033', action: 'CLAIM_SUBMITTED', performedBy: 'Priya Nair', performedByRole: 'Trainer', performedAt: '2026-06-10T10:00:00.000Z', ipAddress: '172.16.0.45', newValue: { claimedAmount: 18600 } },
  { logId: 'aud-005', claimId: 'clm-0028', entityType: 'ClaimHeader', entityId: 'clm-0028', action: 'CLAIM_SUBMITTED', performedBy: 'Vikram Joshi', performedByRole: 'Trainer', performedAt: '2026-06-05T09:00:00.000Z', ipAddress: '10.0.0.18', newValue: { claimedAmount: 37800 } },
  { logId: 'aud-006', claimId: 'clm-0044', entityType: 'ClaimHeader', entityId: 'clm-0044', action: 'CLAIM_SUBMITTED', performedBy: 'Rahul Verma', performedByRole: 'Trainer', performedAt: '2026-06-22T07:45:00.000Z', ipAddress: '10.0.0.22', newValue: { claimedAmount: 96400, isInternational: true, highValue: true } },
  { logId: 'aud-007', claimId: 'clm-0049', entityType: 'ClaimHeader', entityId: 'clm-0049', action: 'CLAIM_SUBMITTED', performedBy: 'Anita Rao', performedByRole: 'Trainer', performedAt: '2026-06-03T10:00:00.000Z', ipAddress: '10.0.0.31', newValue: { claimedAmount: 30200 } },
  { logId: 'aud-008', claimId: 'clm-0035', entityType: 'ClaimHeader', entityId: 'clm-0035', action: 'CLAIM_SUBMITTED', performedBy: 'Vikram Joshi', performedByRole: 'Trainer', performedAt: '2026-06-12T14:00:00.000Z', ipAddress: '10.0.0.18', newValue: { claimedAmount: 22500, lateSubmission: true, daysSinceAssignmentEnd: 18 } },

  // Review actions
  { logId: 'aud-009', claimId: 'clm-0042', entityType: 'ClaimHeader', entityId: 'clm-0042', action: 'REVIEW_STARTED', performedBy: 'Neha Sharma', performedByRole: 'HRAdmin', performedAt: '2026-06-19T14:00:00.000Z', ipAddress: '10.0.1.11', newValue: { assignedTo: 'Neha Sharma' } },
  { logId: 'aud-010', claimId: 'clm-0033', entityType: 'ClaimHeader', entityId: 'clm-0033', action: 'CLAIM_APPROVED', performedBy: 'Amit Kulkarni', performedByRole: 'HRAdmin', performedAt: '2026-06-14T15:30:00.000Z', ipAddress: '10.0.1.12', newValue: { approvedAmount: 17200, deductionAmount: 1400, deductionReason: 'Hotel rate over Metro city limit' } },
  { logId: 'aud-011', claimId: 'clm-0028', entityType: 'ClaimHeader', entityId: 'clm-0028', action: 'CLAIM_APPROVED', performedBy: 'Neha Sharma', performedByRole: 'HRAdmin', performedAt: '2026-06-11T12:00:00.000Z', ipAddress: '10.0.1.11', newValue: { approvedAmount: 36500, deductionAmount: 1300 } },
  { logId: 'aud-012', claimId: 'clm-0049', entityType: 'ClaimHeader', entityId: 'clm-0049', action: 'CLAIM_APPROVED', performedBy: 'Amit Kulkarni', performedByRole: 'HRAdmin', performedAt: '2026-06-08T14:00:00.000Z', ipAddress: '10.0.1.12', newValue: { approvedAmount: 29400, deductionAmount: 800 } },
  { logId: 'aud-013', claimId: 'clm-0035', entityType: 'ClaimHeader', entityId: 'clm-0035', action: 'CLAIM_REJECTED', performedBy: 'Admin', performedByRole: 'HRAdmin', performedAt: '2026-06-13T10:00:00.000Z', ipAddress: '10.0.1.99', newValue: { rejectionReason: 'Late submission – deadline exceeded', daysBeyondDeadline: 3 } },
  { logId: 'aud-014', claimId: 'clm-0050', entityType: 'ClaimHeader', entityId: 'clm-0050', action: 'CLAIM_PARTIALLY_APPROVED', performedBy: 'Amit Kulkarni', performedByRole: 'HRAdmin', performedAt: '2026-06-20T16:00:00.000Z', ipAddress: '10.0.1.12', newValue: { approvedAmount: 31800, deductionAmount: 9400, businessClassDeduction: 6200, missingReceiptDeduction: 3200 } },
  { logId: 'aud-015', claimId: 'clm-0039', entityType: 'ClaimHeader', entityId: 'clm-0039', action: 'CLARIFICATION_REQUESTED', performedBy: 'Neha Sharma', performedByRole: 'HRAdmin', performedAt: '2026-06-18T14:30:00.000Z', ipAddress: '10.0.1.11', newValue: { clarificationItems: 1, pendingWith: 'Trainer' } },

  // SLA breach
  { logId: 'aud-016', claimId: 'clm-0038', entityType: 'ClaimHeader', entityId: 'clm-0038', action: 'SLA_BREACH_ESCALATION', performedBy: 'System', performedByRole: 'SuperAdmin', performedAt: '2026-06-20T08:00:00.000Z', ipAddress: '0.0.0.0', newValue: { agingDays: 12, slaDays: 7, escalatedTo: 'Sunita Mehta (Finance Head)' } },

  // Ledger mismatch
  { logId: 'aud-017', claimId: 'clm-0045', entityType: 'ClaimHeader', entityId: 'clm-0045', action: 'LEDGER_MISMATCH_FLAGGED', performedBy: 'Finance Team', performedByRole: 'Finance', performedAt: '2026-06-20T15:00:00.000Z', ipAddress: '10.0.2.5', newValue: { claimedLodging: 16800, vendorLedgerAmount: 15200, mismatch: 1600 } },

  // Payments
  { logId: 'aud-018', claimId: 'clm-0049', entityType: 'PaymentRecord', entityId: 'pay-0049-01', action: 'PAYMENT_DISBURSED', performedBy: 'Finance Team', performedByRole: 'Finance', performedAt: '2026-06-15T09:28:00.000Z', ipAddress: '10.0.2.5', newValue: { paidAmount: 29400, utrReference: 'UTR20260615001', paymentMode: 'NEFT' } },
  { logId: 'aud-019', claimId: 'clm-0028', entityType: 'PaymentRecord', entityId: 'pay-0028-01', action: 'PAYMENT_INITIATED', performedBy: 'Finance Team', performedByRole: 'Finance', performedAt: '2026-06-24T09:00:00.000Z', ipAddress: '10.0.2.5', newValue: { payableAmount: 36500, tdsDeduction: 2500, netPayable: 34000, scheduledDate: '2026-06-28' } },

  // Exception requests
  { logId: 'aud-020', claimId: 'clm-0042', entityType: 'ExceptionRequest', entityId: 'exc-0042-01', action: 'EXCEPTION_REQUESTED', performedBy: 'Rahul Verma', performedByRole: 'Trainer', performedAt: '2026-06-19T09:05:00.000Z', ipAddress: '10.0.0.22', newValue: { exceptionType: 'OVER_POLICY_LIMIT', exceptionAmount: 3200 } },
  { logId: 'aud-021', claimId: 'clm-0046', entityType: 'ExceptionRequest', entityId: 'exc-0046-01', action: 'EXCEPTION_REQUESTED', performedBy: 'Priya Nair', performedByRole: 'Trainer', performedAt: '2026-06-21T11:20:00.000Z', ipAddress: '172.16.0.45', newValue: { exceptionType: 'PERSONAL_EXPENSE', exceptionAmount: 5400, recoverableAmount: 5400 } },
  { logId: 'aud-022', claimId: 'clm-0035', entityType: 'ExceptionRequest', entityId: 'exc-0035-01', action: 'EXCEPTION_REJECTED', performedBy: 'Admin', performedByRole: 'HRAdmin', performedAt: '2026-06-13T09:30:00.000Z', ipAddress: '10.0.1.99', newValue: { exceptionType: 'LATE_SUBMISSION', rejectionReason: 'Policy does not permit exceptions for scheduling issues beyond the 15-day window' } },

  // Draft creation
  { logId: 'aud-023', claimId: 'clm-0047', entityType: 'ClaimHeader', entityId: 'clm-0047', action: 'CLAIM_DRAFT_CREATED', performedBy: 'Priya Nair', performedByRole: 'Trainer', performedAt: '2026-06-23T09:00:00.000Z', ipAddress: '172.16.0.45', newValue: { assignmentCount: 2, assignmentIds: 'asgn-MUM-2026-048, asgn-MUM-2026-049' } },
];
