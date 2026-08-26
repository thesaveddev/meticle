import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import RotaPlannerPage from './pages/scheduling/RotaPlannerPage'
import OvertimeClaimsPage from './pages/scheduling/OvertimeClaimsPage'
import MarketplacePage from './pages/marketplace/MarketplacePage'
import ReportingPage from './pages/reporting/ReportingPage'
import ReportBuilder from './pages/reporting/ReportBuilder'
import InsightsPage from './pages/insights/InsightsPage'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import AuthGuard from './components/AuthGuard'
import ModuleGuard from './components/ModuleGuard'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import MfaChallengePage from './pages/auth/MfaChallengePage'
import MfaSetupPage from './pages/auth/MfaSetupPage'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import StaffDirectoryPage from './pages/staff/StaffDirectoryPage'
import StaffProfilePage from './pages/staff/StaffProfilePage'
import LocationDetailPage from './pages/locations/LocationDetailPage'
import LocationsPage from './pages/locations/LocationsPage'
// Lazy-loaded marketing pages for code splitting
const FeaturesPage = lazy(() => import('./pages/marketing/FeaturesPage'))
const PricingPage = lazy(() => import('./pages/marketing/PricingPage'))
const AboutPage = lazy(() => import('./pages/marketing/AboutPage'))
const CaseStudiesPage = lazy(() => import('./pages/marketing/CaseStudiesPage'))
const ContactPage = lazy(() => import('./pages/marketing/ContactPage'))
const HowItWorksPage = lazy(() => import('./pages/marketing/HowItWorksPage'))
const BlogPage = lazy(() => import('./pages/marketing/BlogPage'))
const LearningCenterPage = lazy(() => import('./pages/learn/LearningCenterPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'))
const TermsOfUsePage = lazy(() => import('./pages/legal/TermsOfUsePage'))
const CookiePolicyPage = lazy(() => import('./pages/legal/CookiePolicyPage'))
import CompliancePage from './pages/compliance/CompliancePage'
import IdentityMonitoringPage from './pages/compliance/IdentityMonitoringPage'
import CompetencyAssessmentsPage from './pages/compliance/CompetencyAssessmentsPage'
import EvidencePacksPage from './pages/compliance/EvidencePacksPage'
import CqcReadinessPage from './pages/compliance/CqcReadinessPage'
import SatisfactionSurveysPage from './pages/compliance/SatisfactionSurveysPage'
import StaffEngagementPage from './pages/compliance/StaffEngagementPage'
import DSPTPage from './pages/dspt/DSPTPage'
import OrganizationPage from './pages/organization/OrganizationPage'
import SettingsPage from './pages/settings/SettingsPage'
import BillingPage from './pages/billing/BillingPage'
import LeaveManagerPage from './pages/leave/LeaveManagerPage'
import ShiftMarketplacePage from './pages/shift-marketplace/ShiftMarketplacePage'
import AgenciesPage from './pages/agencies/AgenciesPage'
import ExpensesPage from './pages/expenses/ExpensesPage'
import PersonDirectoryPage from './pages/people/PersonDirectoryPage'
import PersonProfilePage from './pages/people/PersonProfilePage'
import IncidentDirectoryPage from './pages/incidents/IncidentDirectoryPage'
import IncidentDetailPage from './pages/incidents/IncidentDetailPage'
import ChatPage from './pages/chat/ChatPage'
import TrainingMatrixPage from './pages/training/TrainingMatrixPage'
import SurveyFormPage from './pages/SurveyFormPage'
import TasksPage from './pages/tasks/TasksPage'
import RoomChecksPage from './pages/room-checks/RoomChecksPage'
import CheckInPage from './pages/mobile/CheckInPage'
import VoiceNotesPage from './pages/mobile/MobileNotesPage'
import FamilyPortalPage from './pages/FamilyPortalPage'
import ComplianceRecordsPage from './pages/compliance/ComplianceRecordsPage'
import AppointmentsPage from './pages/appointments/AppointmentsPage'
import PoliciesPage from './pages/policies/PoliciesPage'
import MissionControlPage from './pages/mission-control/MissionControlPage'
import CompliancePortalPage, { PortalLoginPage } from './pages/compliance-portal/CompliancePortalPage'
import EMedicationPage from './pages/emedication/EMedicationPage'
import ArchivedMarPage from './pages/emedication/ArchivedMarPage'
import MealPlanPage from './pages/nutrition/MealPlanPage'
import UnauthorizedPage from './pages/errors/UnauthorizedPage'
import NotFoundPage from './pages/errors/NotFoundPage'
import PlatformAdminPage from './pages/admin/PlatformAdminPage'
import AdminOrganizationDetailPage from './pages/admin/AdminOrganizationDetailPage'
import { UserRole } from '@meticle/shared'
import ErrorBoundary from './components/ErrorBoundary'
import { MeticleThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
      <Route path="/features" element={<ErrorBoundary><Suspense fallback={null}><FeaturesPage /></Suspense></ErrorBoundary>} />
      <Route path="/how-it-works" element={<ErrorBoundary><Suspense fallback={null}><HowItWorksPage /></Suspense></ErrorBoundary>} />
      <Route path="/pricing" element={<ErrorBoundary><Suspense fallback={null}><PricingPage /></Suspense></ErrorBoundary>} />
      <Route path="/about" element={<ErrorBoundary><Suspense fallback={null}><AboutPage /></Suspense></ErrorBoundary>} />
      <Route path="/case-studies" element={<ErrorBoundary><Suspense fallback={null}><CaseStudiesPage /></Suspense></ErrorBoundary>} />
      <Route path="/contact" element={<ErrorBoundary><Suspense fallback={null}><ContactPage /></Suspense></ErrorBoundary>} />
      <Route path="/blog" element={<ErrorBoundary><Suspense fallback={null}><BlogPage /></Suspense></ErrorBoundary>} />
      <Route path="/login" element={<ErrorBoundary><MeticleThemeProvider><LoginPage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/register" element={<ErrorBoundary><MeticleThemeProvider><RegisterPage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/forgot-password" element={<ErrorBoundary><MeticleThemeProvider><ForgotPasswordPage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/reset-password" element={<ErrorBoundary><MeticleThemeProvider><ResetPasswordPage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/verify-email" element={<ErrorBoundary><MeticleThemeProvider><VerifyEmailPage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/mfa-challenge" element={<ErrorBoundary><MeticleThemeProvider><MfaChallengePage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/mfa-setup" element={<ErrorBoundary><MeticleThemeProvider><MfaSetupPage /></MeticleThemeProvider></ErrorBoundary>} />
      <Route path="/survey/satisfaction/:token" element={<ErrorBoundary><SurveyFormPage /></ErrorBoundary>} />
      <Route path="/survey/engagement/:token" element={<ErrorBoundary><SurveyFormPage /></ErrorBoundary>} />
      <Route path="/family-portal/:token" element={<ErrorBoundary><FamilyPortalPage /></ErrorBoundary>} />
      <Route path="/learn" element={<ErrorBoundary><Suspense fallback={null}><LearningCenterPage /></Suspense></ErrorBoundary>} />
      <Route path="/privacy" element={<ErrorBoundary><Suspense fallback={null}><PrivacyPolicyPage /></Suspense></ErrorBoundary>} />
      <Route path="/terms" element={<ErrorBoundary><Suspense fallback={null}><TermsOfUsePage /></Suspense></ErrorBoundary>} />
      <Route path="/cookies" element={<ErrorBoundary><Suspense fallback={null}><CookiePolicyPage /></Suspense></ErrorBoundary>} />

      {/* Compliance Portal (no auth guard - uses portal token) */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal/dashboard" element={<CompliancePortalPage />} />

      {/* Protected Internal Routes */}
      <Route element={<AuthGuard />}>
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
          <Route path="/dashboard" element={<ModuleGuard module="dashboard"><DashboardPage /></ModuleGuard>} />
          <Route path="/mission-control" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><MissionControlPage /></AuthGuard>} />
          <Route path="/staff" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><ModuleGuard module="staff_directory"><StaffDirectoryPage /></ModuleGuard></AuthGuard>} />
          <Route path="/staff/:userId" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><ModuleGuard module="staff_directory"><StaffProfilePage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><CompliancePage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/identity" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><IdentityMonitoringPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/competency" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><CompetencyAssessmentsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/evidence" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><EvidencePacksPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/readiness" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><CqcReadinessPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/records" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><ComplianceRecordsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/training" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><TrainingMatrixPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/satisfaction" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><SatisfactionSurveysPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/engagement" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><StaffEngagementPage /></ModuleGuard></AuthGuard>} />
          <Route path="/compliance/dspt" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="compliance"><DSPTPage /></ModuleGuard></AuthGuard>} />
          <Route path="/schedule" element={<ModuleGuard module="scheduling"><RotaPlannerPage /></ModuleGuard>} />
          <Route path="/scheduling" element={<ModuleGuard module="scheduling"><RotaPlannerPage /></ModuleGuard>} />
          <Route path="/scheduling/overtime-claims" element={<ModuleGuard module="scheduling"><OvertimeClaimsPage /></ModuleGuard>} />
          <Route path="/marketplace" element={<ModuleGuard module="marketplace"><MarketplacePage /></ModuleGuard>} />
          <Route path="/reports" element={<ModuleGuard module="reporting"><ReportingPage /></ModuleGuard>} />
          <Route path="/reports/:reportId" element={<ModuleGuard module="reporting"><ReportBuilder /></ModuleGuard>} />
          <Route path="/reporting" element={<ModuleGuard module="reporting"><ReportingPage /></ModuleGuard>} />
          <Route path="/insights" element={<ModuleGuard module="reporting"><InsightsPage /></ModuleGuard>} />
          <Route path="/organizations" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN]}><OrganizationPage /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="settings"><SettingsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/locations" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="settings"><LocationsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/locations/:locationId" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="settings"><LocationDetailPage /></ModuleGuard></AuthGuard>} />
          <Route path="/billing" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN]}><ModuleGuard module="billing"><BillingPage /></ModuleGuard></AuthGuard>} />
          <Route path="/leave" element={<ModuleGuard module="leave"><LeaveManagerPage /></ModuleGuard>} />
          <Route path="/shift-marketplace" element={<ModuleGuard module="marketplace"><ShiftMarketplacePage /></ModuleGuard>} />
          <Route path="/agencies" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><ModuleGuard module="agencies"><AgenciesPage /></ModuleGuard></AuthGuard>} />
          <Route path="/expenses" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ModuleGuard module="expenses"><ExpensesPage /></ModuleGuard></AuthGuard>} />
          <Route path="/people" element={<ModuleGuard module="people"><PersonDirectoryPage /></ModuleGuard>} />
          <Route path="/people/:id" element={<ModuleGuard module="people"><PersonProfilePage /></ModuleGuard>} />
          <Route path="/incidents" element={<ModuleGuard module="incidents"><IncidentDirectoryPage /></ModuleGuard>} />
          <Route path="/incidents/:id" element={<ModuleGuard module="incidents"><IncidentDetailPage /></ModuleGuard>} />
          <Route path="/training" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="training"><TrainingMatrixPage /></ModuleGuard></AuthGuard>} />
          <Route path="/chat" element={<ModuleGuard module="chat"><ChatPage /></ModuleGuard>} />
          <Route path="/appointments" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ModuleGuard module="appointments"><AppointmentsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/policies" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="policies"><PoliciesPage /></ModuleGuard></AuthGuard>} />
          <Route path="/room-checks" element={<ModuleGuard module="room_checks"><RoomChecksPage /></ModuleGuard>} />
          <Route path="/mobile/check-in" element={<CheckInPage />} />
          <Route path="/mobile/voice-notes" element={<VoiceNotesPage />} />
          <Route path="/medications" element={<ModuleGuard module="emedication"><EMedicationPage /></ModuleGuard>} />
          <Route path="/emedication" element={<ModuleGuard module="emedication"><EMedicationPage /></ModuleGuard>} />
          <Route path="/emedication/archived" element={<ModuleGuard module="emedication"><ArchivedMarPage /></ModuleGuard>} />
          <Route path="/meal-plans" element={<ModuleGuard module="emedication"><MealPlanPage /></ModuleGuard>} />
          <Route path="/tasks" element={<ModuleGuard module="tasks"><TasksPage /></ModuleGuard>} />
          <Route path="/platform-admin" element={<AuthGuard allowedRoles={[UserRole.SUPER_ADMIN]}><PlatformAdminPage /></AuthGuard>} />
          <Route path="/platform-admin/organizations/:id" element={<AuthGuard allowedRoles={[UserRole.SUPER_ADMIN]}><AdminOrganizationDetailPage /></AuthGuard>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
