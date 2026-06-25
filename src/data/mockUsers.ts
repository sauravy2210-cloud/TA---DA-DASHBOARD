import type { User, LeaveRecord } from '../types';

export const mockUsers: User[] = [
  {
    id: 'USR-001',
    name: 'Saurav Mehta',
    email: 'saurav.mehta@koenig-solutions.com',
    role: 'SuperAdmin',
    avatarInitials: 'SM',
  },
  {
    id: 'USR-002',
    name: 'Rahul Verma',
    email: 'rahul.verma@koenig-solutions.com',
    role: 'Trainer',
    avatarInitials: 'RV',
  },
  {
    id: 'USR-003',
    name: 'Anita Rao',
    email: 'anita.rao@koenig-solutions.com',
    role: 'Trainer',
    avatarInitials: 'AR',
  },
  {
    id: 'USR-004',
    name: 'Imran Khan',
    email: 'imran.khan@koenig-solutions.com',
    role: 'Trainer',
    avatarInitials: 'IK',
  },
  {
    id: 'USR-005',
    name: 'Priya Nair',
    email: 'priya.nair@koenig-solutions.com',
    role: 'Trainer',
    avatarInitials: 'PN',
  },
  {
    id: 'USR-006',
    name: 'Vikram Joshi',
    email: 'vikram.joshi@koenig-solutions.com',
    role: 'Trainer',
    avatarInitials: 'VJ',
  },
  {
    id: 'USR-007',
    name: 'Meera Sharma',
    email: 'meera.sharma@koenig-solutions.com',
    role: 'HRAdmin',
    avatarInitials: 'MS',
  },
  {
    id: 'USR-008',
    name: 'Deepak Gupta',
    email: 'deepak.gupta@koenig-solutions.com',
    role: 'HRAdmin',
    avatarInitials: 'DG',
  },
  {
    id: 'USR-009',
    name: 'Kavita Patel',
    email: 'kavita.patel@koenig-solutions.com',
    role: 'Finance',
    avatarInitials: 'KP',
  },
];

export const mockLeaveRecords: LeaveRecord[] = [
  {
    leaveId: 'LVE-2026-001',
    trainerId: 'USR-002',
    type: 'Casual',
    startDate: '2026-06-02',
    endDate: '2026-06-03',
    approved: true,
  },
  {
    leaveId: 'LVE-2026-002',
    trainerId: 'USR-003',
    type: 'Sick',
    startDate: '2026-06-10',
    endDate: '2026-06-11',
    approved: true,
  },
  {
    leaveId: 'LVE-2026-003',
    trainerId: 'USR-004',
    type: 'Privilege',
    startDate: '2026-06-16',
    endDate: '2026-06-20',
    approved: false,
  },
  {
    leaveId: 'LVE-2026-004',
    trainerId: 'USR-005',
    type: 'Casual',
    startDate: '2026-06-27',
    endDate: '2026-06-27',
    approved: true,
  },
];

export const currentUser: User = mockUsers[0]; // Saurav Mehta — SuperAdmin
