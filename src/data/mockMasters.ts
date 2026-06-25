import type { VenueMaster, CountryMaster, CityCategoryMaster, PolicyRule, AdvanceRecord } from '../types'

export const mockVenues: VenueMaster[] = [
  { id: 'V001', venueId: 'V001', venueName: 'Koenig Delhi Training Centre', address: 'A-25, Sector 62, Noida', city: 'Delhi', country: 'India', cityTier: 'Metro' },
  { id: 'V002', venueId: 'V002', venueName: 'Koenig Mumbai Centre', address: '12th Floor, Bandra Kurla Complex, Mumbai', city: 'Mumbai', country: 'India', cityTier: 'Metro' },
  { id: 'V003', venueId: 'V003', venueName: 'Koenig Bangalore Centre', address: '4th Floor, Prestige Tech Park, Bangalore', city: 'Bangalore', country: 'India', cityTier: 'Metro' },
  { id: 'V004', venueId: 'V004', venueName: 'Client Site – Hyderabad', address: 'Hitech City, Hyderabad', city: 'Hyderabad', country: 'India', cityTier: 'Tier1' },
  { id: 'V005', venueId: 'V005', venueName: 'Emirates NBD HQ', address: 'Baniyas Road, Deira, Dubai', city: 'Dubai', country: 'UAE', cityTier: 'International' },
]

export const mockCountries: CountryMaster[] = [
  { id: 'C001', code: 'IN', name: 'India', currency: 'INR', da_currency_rate: 1 },
  { id: 'C002', code: 'AE', name: 'UAE', currency: 'AED', da_currency_rate: 22.75 },
  { id: 'C003', code: 'US', name: 'USA', currency: 'USD', da_currency_rate: 83.5 },
  { id: 'C004', code: 'SG', name: 'Singapore', currency: 'SGD', da_currency_rate: 62.1 },
  { id: 'C005', code: 'GB', name: 'UK', currency: 'GBP', da_currency_rate: 105.2 },
]

export const mockCityCategories: CityCategoryMaster[] = [
  { id: 'CC001', city: 'Delhi', country: 'India', tier: 'Metro' },
  { id: 'CC002', city: 'Mumbai', country: 'India', tier: 'Metro' },
  { id: 'CC003', city: 'Bangalore', country: 'India', tier: 'Metro' },
  { id: 'CC004', city: 'Chennai', country: 'India', tier: 'Metro' },
  { id: 'CC005', city: 'Hyderabad', country: 'India', tier: 'Tier1' },
  { id: 'CC006', city: 'Pune', country: 'India', tier: 'Tier1' },
  { id: 'CC007', city: 'Jaipur', country: 'India', tier: 'Tier2' },
  { id: 'CC008', city: 'Chandigarh', country: 'India', tier: 'Tier2' },
  { id: 'CC009', city: 'Dubai', country: 'UAE', tier: 'International' },
  { id: 'CC010', city: 'Singapore', country: 'Singapore', tier: 'International' },
]

export const mockPolicies: PolicyRule[] = [
  {
    id: 'P001', ruleId: 'P001', expenseType: 'DA', country: 'India', cityTier: 'Metro',
    maxAmount: 800, currency: 'INR', unit: 'per day',
    partialDayDepart: 17, partialDayArrive: 12,
    proofRequired: false, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P002', ruleId: 'P002', expenseType: 'DA', country: 'India', cityTier: 'Tier1',
    maxAmount: 600, currency: 'INR', unit: 'per day',
    partialDayDepart: 17, partialDayArrive: 12,
    proofRequired: false, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P003', ruleId: 'P003', expenseType: 'DA', country: 'India', cityTier: 'Tier2',
    maxAmount: 450, currency: 'INR', unit: 'per day',
    partialDayDepart: 17, partialDayArrive: 12,
    proofRequired: false, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P004', ruleId: 'P004', expenseType: 'DA', country: 'UAE', cityTier: 'International',
    maxAmount: 250, currency: 'AED', unit: 'per day',
    partialDayDepart: 17, partialDayArrive: 12,
    proofRequired: false, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P005', ruleId: 'P005', expenseType: 'Lodging', country: 'India', cityTier: 'Metro',
    maxAmount: 5000, currency: 'INR', unit: 'per night',
    partialDayDepart: 0, partialDayArrive: 0,
    proofRequired: true, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P006', ruleId: 'P006', expenseType: 'Lodging', country: 'India', cityTier: 'Tier1',
    maxAmount: 3500, currency: 'INR', unit: 'per night',
    partialDayDepart: 0, partialDayArrive: 0,
    proofRequired: true, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P007', ruleId: 'P007', expenseType: 'Lodging', country: 'UAE',
    maxAmount: 150, currency: 'USD', unit: 'per night',
    partialDayDepart: 0, partialDayArrive: 0,
    proofRequired: true, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
  {
    id: 'P008', ruleId: 'P008', expenseType: 'Cab', country: 'India',
    maxAmount: 1500, currency: 'INR', unit: 'per day',
    partialDayDepart: 0, partialDayArrive: 0,
    proofRequired: true, effectiveFrom: '2026-01-01', version: 1, active: true,
    changedBy: 'Admin', changedOn: '2026-01-01',
  },
]

export const mockAdvanceRecords: AdvanceRecord[] = [
  {
    id: 'A001', advanceId: 'A001', trainerId: 'T001',
    amount: 15000, date: '2026-05-10', purpose: 'Travel advance for Gurgaon assignment',
    adjustedInClaimId: 'CLAIM-042', adjustedAmount: 15000, balance: 0,
  },
  {
    id: 'A002', advanceId: 'A002', trainerId: 'T002',
    amount: 8000, date: '2026-05-18', purpose: 'Travel advance for Pune assignment',
    adjustedAmount: 5000, balance: 3000,
  },
  {
    id: 'A003', advanceId: 'A003', trainerId: 'T003',
    amount: 0, date: '2026-06-01', purpose: 'No advance',
    balance: 0,
  },
]
