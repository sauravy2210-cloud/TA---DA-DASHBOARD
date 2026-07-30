import { useState, useEffect, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom'

import type { User, UserRole } from './types'
import { initFromDb } from './services/storageService'
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
import UpcomingTravel from './pages/UpcomingTravel'
import CreateTADABill from './pages/CreateTADABill'
import HelpPolicy from './pages/HelpPolicy'
import TrainerProfile from './pages/TrainerProfile'
import CheckDetails from './pages/CheckDetails'

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#eef4fa', padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
          <img src="/koenig-logo.svg" alt="Koenig" style={{ height: 56, marginBottom: 24 }} />
          <h2 style={{ color: '#1e293b', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#64748b', marginBottom: 24, textAlign: 'center', maxWidth: 400 }}>
            The page failed to load. Please clear your browser cache and try again.
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 14 }}
          >
            Clear Cache &amp; Reload
          </button>
          <details style={{ marginTop: 16, color: '#94a3b8', fontSize: 12, maxWidth: 500, wordBreak: 'break-word' }}>
            <summary style={{ cursor: 'pointer' }}>Error details</summary>
            <pre style={{ marginTop: 8 }}>{this.state.error.message}</pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Local-storage helpers ────────────────────────────────────────────────────
const LS_KEY = 'tada_current_user'

function loadUser(): User | null {
  // Always start with login page on every fresh page load — clear any stale session
  localStorage.removeItem(LS_KEY)
  return null
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
  redirectTo?: string
}

function RoleGuard({ currentUser, allowedRoles, redirectTo, children }: RoleGuardProps) {
  if (!currentUser) return <Navigate to="/" replace />
  // Always check the real login role (originalRole), not the switched view role
  const authRole = currentUser.originalRole ?? currentUser.role
  // SuperAdmin and HRAdmin bypass all route restrictions
  if (authRole === 'SuperAdmin' || authRole === 'HRAdmin') return <>{children}</>
  if (!allowedRoles.includes(currentUser.role)) {
    if (redirectTo) return <Navigate to={redirectTo} replace />
    return <AccessDenied />
  }
  return <>{children}</>
}

// Reads claimId from params and redirects trainers away from the HR-only review page
function ClaimReviewGuard({ currentUser, children }: { currentUser: User | null; children: ReactNode }) {
  const { claimId } = useParams<{ claimId: string }>()
  const authRole = currentUser?.originalRole ?? currentUser?.role
  if (authRole !== 'SuperAdmin' && authRole !== 'HRAdmin') {
    return <Navigate to={`/claims/${claimId ?? ''}`} replace />
  }
  return <>{children}</>
}


// ── Dashboard redirect (role-aware) ─────────────────────────────────────────
function DashboardRedirect({ currentUser }: { currentUser: User }) {
  if (currentUser.role === 'Trainer') return <TrainerDashboard currentUser={currentUser} />
  if (currentUser.role === 'CheckDetails') return <Navigate to="/check-details" replace />
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

  // Re-fetch PMS details on startup for Trainer sessions loaded from localStorage
  // that have a fallback name (e.g. "Trainer 2225") or missing pmsDetails.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Trainer') return
    const isFallback = !currentUser.pmsDetails ||
      /^Trainer\s+\S+$/i.test(currentUser.name.trim())
    if (!isFallback) return
    const code = (currentUser.trainerId || currentUser.id || '')
      .replace(/^EMP-/i, '').replace(/^emp-/i, '').trim()
    if (!code) return

    fetch(`/api/employee?empCode=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.employee) return
        const emp = d.employee
        const firstName  = emp.first_name  ?? ''
        const middleName = emp.middle_name ? ` ${emp.middle_name}` : ''
        const lastName   = emp.last_name   ? ` ${emp.last_name}`   : ''
        const fullName   = `${firstName}${middleName}${lastName}`.trim() || currentUser.name
        const f = (firstName[0] ?? '').toUpperCase()
        const l = (emp.last_name?.[0] ?? '').toUpperCase()
        setCurrentUser(prev => prev ? {
          ...prev,
          name:           fullName,
          email:          String(emp.email_address || emp.Email || emp.email || emp.EmailAddress || emp.emailAddress || emp.EmailId || emp.email_id || emp.personal_email || emp.PersonalEmail || emp.OfficialEmail || emp.official_email || emp.WorkEmail || emp.work_email || '').trim() || prev.email,
          avatarInitials: (f + l) || prev.avatarInitials,
          pmsDetails:     emp,
        } : prev)
      })
      .catch(() => { /* silent — keep existing user */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On app startup: load all claims and line items from Turso into memory.
  // Turso is the single source of truth — no localStorage for claims/line items.
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    initFromDb().then(() => setDbReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (user: User) => setCurrentUser(user)

  const handleRoleSwitch = (role: UserRole) => {
    if (!currentUser) return
    // Keep originalRole so RoleGuard always checks the real login role
    const original = currentUser.originalRole ?? currentUser.role
    setCurrentUser({ ...currentUser, role, originalRole: original })
  }

  const handleLogout = () => setCurrentUser(null)

  return (
    <ErrorBoundary>
    {/* Full-screen loading overlay while Turso data loads (only when logged in) */}
    {!dbReady && currentUser && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, gap: 12 }}>
        <span style={{ width: 36, height: 36, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 14, color: '#64748b' }}>Loading your data…</span>
      </div>
    )}
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={
            currentUser ? (
              currentUser.role === 'Trainer' ? (
                <Navigate to="/dashboard" replace />
              ) : currentUser.role === 'CheckDetails' ? (
                <Navigate to="/check-details" replace />
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
            <ClaimReviewGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <ClaimReview currentUser={currentUser!} />
              </ShellWrap>
            </ClaimReviewGuard>
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
          path="/finance/payments"
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
          path="/payments"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['Finance', 'SuperAdmin', 'HRAdmin']}
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
          path="/upcoming-travel"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap
                currentUser={currentUser!}
                onRoleSwitch={handleRoleSwitch}
                onLogout={handleLogout}
              >
                <UpcomingTravel currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
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

        <Route
          path="/trainer/help"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap currentUser={currentUser!} onRoleSwitch={handleRoleSwitch} onLogout={handleLogout}>
                <HelpPolicy />
              </ShellWrap>
            </AuthGuard>
          }
        />

        <Route
          path="/trainer/profile"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap currentUser={currentUser!} onRoleSwitch={handleRoleSwitch} onLogout={handleLogout}>
                <TrainerProfile currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
          }
        />

        {/* Catch-all */}
        <Route
          path="/create-bill"
          element={
            <RoleGuard
              currentUser={currentUser}
              allowedRoles={['Trainer', 'HRAdmin', 'SuperAdmin']}
            >
              <ShellWrap currentUser={currentUser!} onRoleSwitch={handleRoleSwitch} onLogout={handleLogout}>
                <CreateTADABill currentUser={currentUser!} />
              </ShellWrap>
            </RoleGuard>
          }
        />

        <Route
          path="/check-details"
          element={
            <AuthGuard currentUser={currentUser}>
              <ShellWrap currentUser={currentUser!} onRoleSwitch={handleRoleSwitch} onLogout={handleLogout}>
                <CheckDetails currentUser={currentUser!} />
              </ShellWrap>
            </AuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

