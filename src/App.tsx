import { useState, useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import type { User, UserRole } from './types'
import AppShell from './components/AppShell'

// Pages
import LoginRoleSelector from './pages/LoginRoleSelector'
import TrainerDashboard from './pages/TrainerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import EligibleAssignments from './pages/EligibleAssignments'
import CreateClaim from './pages/CreateClaim'
import MyBills from './pages/MyBills'
import VerificationQueue from './pages/VerificationQueue'
import ClaimDetail from './pages/ClaimDetail'
import ClaimReview from './pages/ClaimReview'
import ClarificationResponse from './pages/ClarificationResponse'
import PaymentProcessing from './pages/PaymentProcessing'
import Reports from './pages/Reports'
import AuditLogs from './pages/AuditLogs'
import PolicyMaster from './pages/PolicyMaster'
import NotificationsSLA from './pages/NotificationsSLA'

// ── Local-storage helpers ────────────────────────────────────────────────────
const LS_KEY = 'tada_current_user'

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(LS_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(LS_KEY)
  }
}

// ── Access-denied fallback ───────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ background: '#fee2e2' }}
      >
        🚫
      </div>
      <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
      <p className="text-gray-500 max-w-sm">
        You do not have permission to view this page. Please switch to an appropriate role.
      </p>
    </div>
  )
}

// ── Route guard helpers ──────────────────────────────────────────────────────
interface GuardProps {
  currentUser: User | null
  children: React.ReactNode
}

function AuthGuard({ currentUser, children }: GuardProps) {
  if (!currentUser) return <Navigate to="/" replace />
  return <>{children}</>
}

interface RoleGuardProps extends GuardProps {
  allowedRoles: UserRole[]
}

function RoleGuard({ currentUser, allowedRoles, children }: RoleGuardProps) {
  if (!currentUser) return <Navigate to="/" replace />
  if (!allowedRoles.includes(currentUser.role)) return <AccessDenied />
  return <>{children}</>
}

// ── Dashboard redirect (role-aware) ─────────────────────────────────────────
function DashboardRedirect({ currentUser }: { currentUser: User }) {
  if (currentUser.role === 'Trainer') return <TrainerDashboard currentUser={currentUser} />
  if (currentUser.role === 'Finance') return <Navigate to="/payments" replace />
  return <Navigate to="/admin" replace />
}

// ── Claims redirect (role-aware) ─────────────────────────────────────────────
function ClaimsRedirect({ currentUser }: { currentUser: User }) {
  if (currentUser.role === 'Trainer') return <MyBills currentUser={currentUser} />
  if (currentUser.role === 'HRAdmin' || currentUser.role === 'SuperAdmin')
    return <VerificationQueue currentUser={currentUser} />
  return <Navigate to="/dashboard" replace />
}

// ── Authenticated shell wrapper ──────────────────────────────────────────────
interface ShellWrapProps {
  currentUser: User
  onRoleSwitch: (role: UserRole) => void
  onLogout: () => void
  children: React.ReactNode
}

function ShellWrap({ currentUser, onRoleSwitch, onLogout, children }: ShellWrapProps) {
  const location = useLocation()
  return (
    <AppShell
      currentUser={currentUser}
      onRoleSwitch={onRoleSwitch}
      onLogout={onLogout}
      currentPath={location.pathname}
    >
      {children}
    </AppShell>
  )
}

// ── Root app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(loadUser)

  useEffect(() => {
    saveUser(currentUser)
  }, [currentUser])

  const handleLogin = (user: User) => setCurrentUser(user)

  const handleRoleSwitch = (role: UserRole) => {
    if (!currentUser) return
    setCurrentUser({ ...currentUser, role })
  }

  const handleLogout = () => setCurrentUser(null)

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={
            currentUser ? (
              currentUser.role === 'Trainer' ? (
                <Navigate to="/dashboard" replace />
              ) : currentUser.role === 'Finance' ? (
                <Navigate to="/payments" replace />
              ) : (
                <Navigate to="/admin" replace />
              )
            ) : (
              <LoginRoleSelector onLogin={handleLogin} />
            )
          }
        />

        {/* Authenticated routes — all wrapped in AppShell */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <DashboardRedirect currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
          }
        />

        <Route
          path="/admin"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['HRAdmin', 'SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <AdminDashboard currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/assignments"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <EligibleAssignments currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
          }
        />

        <Route
          path="/claims/new"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['Trainer', 'HRAdmin', 'SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <CreateClaim currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/claims"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <ClaimsRedirect currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
          }
        />

        <Route
          path="/claims/:claimId"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <ClaimDetail currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
          }
        />

        <Route
          path="/claims/:claimId/review"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['HRAdmin', 'SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <ClaimReview currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/claims/:claimId/clarify"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['Trainer']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <ClarificationResponse currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/payments"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['Finance', 'SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <PaymentProcessing currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/reports"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['HRAdmin', 'Finance', 'SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <Reports currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/audit"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <AuditLogs currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/policy"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['HRAdmin', 'SuperAdmin']}
            >
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <PolicyMaster currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/notifications"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <NotificationsSLA />
              </ShellWrap>
            </AuthGuard>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

