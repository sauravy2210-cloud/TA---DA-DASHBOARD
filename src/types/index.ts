// TA/DA Allowance Dashboard — TypeScript Types

export type UserRole = 'Trainer' | 'HRAdmin' | 'Finance' | 'SuperAdmin';

export interface BankDetails {
  accountNo: string;
  ifscCode: string;
  bankName: string;
  accountHolderName: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  trainerId?: string;
  bankDetails?: BankDetails;
}

export interface TrainerProfile {
  trainerId: string;
  userId: string;
  name: string;
  email: string;
  empCode: string;
  department: string;
  category: 'Senior' | 'Mid' | 'Junior';
  baseCity: string;
  baseCityTier: string;
  joiningDate: string;
  active: boolean;
}

export interface Assignment {
  assignmentId: string;
  batchId: string;
  clientName: string;
  courseName: string;
  trainingLocation: string;
  country: string;
  city: string;
  cityTier: string;
  startDate: string;
  endDate: string;
  trainerIds: string[];
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  venueId?: string;
  claimDeadline: string;
  eligibleForClaim: boolean;
}

export type TravelMode = 'Flight' | 'Train' | 'Bus' | 'Cab' | 'Own Vehicle';

export interface TravelLeg {
  legId: string;
  claimId?: string;
  from: string;
  to: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  mode: TravelMode;
  ticketNo?: string;
  pnrNo?: string;
  fare: number;
  class?: string;
  bookingRef?: string;
  receiptUploaded: boolean;
}

export type StayType =
  | 'Self Booked'
  | 'Company Provided'
  | 'Apartment'
  | 'Not Applicable';

export interface HotelStay {
  stayId: string;
  claimId?: string;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountPerNight: number;
  totalAmount: number;
  invoiceNo?: string;
  receiptUploaded: boolean;
  stayType: StayType;
}

export interface DARecord {
  date: string;
  city: string;
  country: string;
  cityTier: string;
  rateApplicable: number;
  fullDayEligible: boolean;
  partialDayReason?: string;
  isLeaveDay: boolean;
  isPersonalStayback: boolean;
  isDuplicate: boolean;
  eligibleAmount: number;
  notes?: string;
}

export interface CabRecord {
  cabId: string;
  claimId?: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  amount: number;
  receiptUploaded: boolean;
  purpose: string;
  isEligible: boolean;
  reasonIfIneligible?: string;
}

export interface OtherExpense {
  expenseId: string;
  claimId?: string;
  date: string;
  expenseType: string;
  description: string;
  amount: number;
  receiptUploaded: boolean;
}

export interface AdvanceRecord {
  id?: string;
  advanceId: string;
  trainerId: string;
  amount: number;
  date: string;
  purpose: string;
  adjustedInClaimId?: string;
  adjustedAmount?: number;
  balance: number;
}

export interface PolicyRule {
  id?: string;
  ruleId: string;
  expenseType: string;
  country: string;
  cityTier?: string;
  maxAmount: number;
  currency: string;
  unit: string;
  partialDayDepart: number;
  partialDayArrive: number;
  proofRequired: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
  active: boolean;
  changedBy: string;
  changedOn: string;
  reason?: string;
}

export type ClaimStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Clarification Required'
  | 'Resubmitted'
  | 'Approved'
  | 'Partially Approved'
  | 'Rejected'
  | 'On Hold'
  | 'Payment Pending'
  | 'Paid'
  | 'Cancelled'
  | 'Reopened';

export type PendingWith =
  | 'Trainer'
  | 'HR/Admin'
  | 'Finance'
  | 'Approver'
  | 'None';

export type PaymentStatus = 'Unpaid' | 'Processed' | 'Paid';

export interface ClaimHeader {
  claimId: string;
  billNo: string;
  trainerId: string;
  trainerName: string;
  assignmentIds: string[];
  batchIds: string[];
  clientName: string;
  courseName: string;
  trainingLocation: string;
  claimStartDate: string;
  claimEndDate: string;
  baseCity: string;
  destinationCities: string[];
  status: ClaimStatus;
  pendingWith: PendingWith;
  submittedAt?: string;
  lastActionAt: string;
  adminOwnerId?: string;
  totalClaimedAmount: number;
  eligibleAmount: number;
  approvedAmount: number;
  deductionAmount: number;
  advanceAdjusted: number;
  miscAdjustments: number;
  recoverableAmount: number;
  netPayable: number;
  currency: string;
  exceptionFlag: boolean;
  missingDocumentFlag: boolean;
  duplicateFlag: boolean;
  ledgerMismatchFlag: boolean;
  slaBreached: boolean;
  paymentStatus: PaymentStatus;
  agingDays: number;
  highValue?: boolean;
  adminRemark?: string;
}

export type ExpenseType = 'TA' | 'DA' | 'Lodging' | 'Cab' | 'Other';

export type AdminDecision =
  | 'Pending'
  | 'Approved'
  | 'Reduced'
  | 'Rejected'
  | 'Non-Payable'
  | 'Clarification';

export interface ClaimLineItem {
  lineItemId: string;
  claimId: string;
  expenseType: ExpenseType;
  expenseSubType?: string;
  date?: string;
  fromLocation?: string;
  toLocation?: string;
  description: string;
  claimedAmount: number;
  policyLimit: number;
  eligibleAmount: number;
  approvedAmount: number;
  deductionAmount: number;
  currency: string;
  receiptRequired: boolean;
  receiptUploaded: boolean;
  exceptionRequired: boolean;
  exceptionId?: string;
  adminDecision?: AdminDecision;
  reasonCode?: ReasonCode;
  trainerVisibleRemark?: string;
  internalRemark?: string;
  clarificationRequired?: boolean;
}

export type AttachmentCategory =
  | 'Ticket'
  | 'Boarding Pass'
  | 'Hotel Invoice'
  | 'Cab Receipt'
  | 'Other';

export interface ClaimAttachment {
  attachmentId: string;
  claimId: string;
  lineItemId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  category: AttachmentCategory;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface ClaimStatusHistory {
  historyId: string;
  claimId: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  changedBy: string;
  changedByRole: UserRole;
  changedAt: string;
  remarks?: string;
  reasonCode?: ReasonCode;
}

export type RemarkType = 'Trainer' | 'HR' | 'Internal' | 'System';
export type RemarkVisibility = 'All' | 'HR' | 'Internal';

export interface ClaimRemarks {
  remarkId: string;
  claimId: string;
  lineItemId?: string;
  type: RemarkType;
  text: string;
  createdBy: string;
  createdAt: string;
  visible: RemarkVisibility;
}

export type ExceptionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ExceptionRequest {
  exceptionId: string;
  claimId: string;
  lineItemId?: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  amount?: number;
  approvedBy?: string;
  approvedAt?: string;
  status: ExceptionStatus;
  remarks?: string;
}

export interface PaymentRecord {
  paymentId: string;
  claimId: string;
  paidAmount: number;
  paymentDate: string;
  paymentMode: string;
  referenceUTR: string;
  financeRemarks?: string;
  processedBy: string;
  processedAt: string;
}

export interface AuditLog {
  logId: string;
  claimId?: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reasonCode?: ReasonCode;
  remarks?: string;
  performedBy: string;
  performedByRole: UserRole;
  performedAt: string;
  ipAddress?: string;
}

export interface NotificationLog {
  notifId: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  relatedClaimId?: string;
  read: boolean;
  createdAt: string;
}

export type LeaveType = 'Casual' | 'Sick' | 'Privilege' | 'LOP';

export interface LeaveRecord {
  leaveId: string;
  trainerId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  approved: boolean;
}

export type CityTier = 'Metro' | 'Tier1' | 'Tier2' | 'International';

export interface VenueMaster {
  id?: string;
  venueId: string;
  venueName: string;
  address: string;
  city: string;
  country: string;
  cityTier: CityTier;
}

export interface CountryMaster {
  id?: string;
  code: string;
  name: string;
  currency: string;
  da_currency_rate: number;
}

export interface CityCategoryMaster {
  id?: string;
  city: string;
  country: string;
  tier: CityTier;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationSeverity;
  lineItemId?: string;
}

export type ReasonCode =
  | 'RC001_OVER_POLICY_LIMIT'
  | 'RC002_NO_RECEIPT'
  | 'RC003_DUPLICATE_CLAIM'
  | 'RC004_LEAVE_DAY_DA'
  | 'RC005_PERSONAL_STAYBACK'
  | 'RC006_NON_ELIGIBLE_EXPENSE'
  | 'RC007_CITY_TIER_MISMATCH'
  | 'RC008_DATE_OUT_OF_RANGE'
  | 'RC009_ADVANCE_ADJUSTED'
  | 'RC010_EXCEPTION_APPROVED'
  | 'RC011_EXCEPTION_REJECTED'
  | 'RC012_PARTIAL_DAY_DEPART'
  | 'RC013_PARTIAL_DAY_ARRIVE'
  | 'RC014_COMPANY_BOOKING_USED'
  | 'RC015_CAB_NOT_ELIGIBLE'
  | 'RC016_INVOICE_MISMATCH'
  | 'RC017_AMOUNT_REDUCED'
  | 'RC018_BOARDING_PASS_MISSING'
  | 'RC019_PNR_MISMATCH'
  | 'RC020_HOTEL_RATE_EXCEEDED'
  | 'RC021_MULTIPLE_TRAINER_SPLIT'
  | 'RC022_LEDGER_MISMATCH'
  | 'RC023_POLICY_NOT_APPLICABLE'
  | 'RC024_SLA_BREACH'
  | 'RC025_CLAIM_REOPENED'
  | 'RC026_PAYMENT_ON_HOLD'
  | 'RC027_TAX_COMPONENT_EXCLUDED'
  | 'RC028_CURRENCY_CONVERSION_APPLIED'
  | 'RC029_MISSING_SUPPORTING_DOC'
  | 'RC030_ADMIN_DISCRETIONARY_ADJUSTMENT';

