import { Routes, Route } from 'react-router-dom'
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
import FeaturesPage from './pages/marketing/FeaturesPage'
import PricingPage from './pages/marketing/PricingPage'
import AboutPage from './pages/marketing/AboutPage'
import CaseStudiesPage from './pages/marketing/CaseStudiesPage'
import ContactPage from './pages/marketing/ContactPage'
import HowItWorksPage from './pages/marketing/HowItWorksPage'
import BlogPage from './pages/marketing/BlogPage'
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
import ServiceUserDirectoryPage from './pages/service-users/ServiceUserDirectoryPage'
import ServiceUserProfilePage from './pages/service-users/ServiceUserProfilePage'
import IncidentDirectoryPage from './pages/incidents/IncidentDirectoryPage'
import IncidentDetailPage from './pages/incidents/IncidentDetailPage'
import ChatPage from './pages/chat/ChatPage'
import TrainingMatrixPage from './pages/training/TrainingMatrixPage'
import SurveyFormPage from './pages/SurveyFormPage'
import LearningCenterPage from './pages/learn/LearningCenterPage'
import TasksPage from './pages/tasks/TasksPage'
import RoomChecksPage from './pages/room-checks/RoomChecksPage'
import CheckInPage from './pages/mobile/CheckInPage'
import VoiceNotesPage from './pages/mobile/MobileNotesPage'
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage'
import TermsOfUsePage from './pages/legal/TermsOfUsePage'
import CookiePolicyPage from './pages/legal/CookiePolicyPage'
import FamilyPortalPage from './pages/FamilyPortalPage'
import ComplianceRecordsPage from './pages/compliance/ComplianceRecordsPage'
import AppointmentsPage from './pages/appointments/AppointmentsPage'
import PoliciesPage from './pages/policies/PoliciesPage'
import OutcomesPage from './pages/outcomes/OutcomesPage'
import EMedicationPage from './pages/emedication/EMedicationPage'
import ArchivedMarPage from './pages/emedication/ArchivedMarPage'
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
      <Route path="/features" element={<ErrorBoundary><FeaturesPage /></ErrorBoundary>} />
      <Route path="/how-it-works" element={<ErrorBoundary><HowItWorksPage /></ErrorBoundary>} />
      <Route path="/pricing" element={<ErrorBoundary><PricingPage /></ErrorBoundary>} />
      <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
      <Route path="/case-studies" element={<ErrorBoundary><CaseStudiesPage /></ErrorBoundary>} />
      <Route path="/contact" element={<ErrorBoundary><ContactPage /></ErrorBoundary>} />
      <Route path="/blog" element={<ErrorBoundary><BlogPage /></ErrorBoundary>} />
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
      <Route path="/learn" element={<ErrorBoundary><LearningCenterPage /></ErrorBoundary>} />
      <Route path="/privacy" element={<ErrorBoundary><PrivacyPolicyPage /></ErrorBoundary>} />
      <Route path="/terms" element={<ErrorBoundary><TermsOfUsePage /></ErrorBoundary>} />
      <Route path="/cookies" element={<ErrorBoundary><CookiePolicyPage /></ErrorBoundary>} />

      {/* Protected Internal Routes */}
      <Route element={<AuthGuard />}>
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
          <Route path="/dashboard" element={<ModuleGuard module="dashboard"><DashboardPage /></ModuleGuard>} />
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
          <Route path="/billing" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN]}><BillingPage /></AuthGuard>} />
          <Route path="/leave" element={<ModuleGuard module="leave"><LeaveManagerPage /></ModuleGuard>} />
          <Route path="/shift-marketplace" element={<ModuleGuard module="marketplace"><ShiftMarketplacePage /></ModuleGuard>} />
          <Route path="/agencies" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><AgenciesPage /></AuthGuard>} />
          <Route path="/expenses" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ExpensesPage /></AuthGuard>} />
          <Route path="/people" element={<ModuleGuard module="staff_directory"><ServiceUserDirectoryPage /></ModuleGuard>} />
          <Route path="/people/:id" element={<ModuleGuard module="staff_directory"><ServiceUserProfilePage /></ModuleGuard>} />
          <Route path="/incidents" element={<ModuleGuard module="staff_directory"><IncidentDirectoryPage /></ModuleGuard>} />
          <Route path="/incidents/:id" element={<ModuleGuard module="staff_directory"><IncidentDetailPage /></ModuleGuard>} />
          <Route path="/training" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><TrainingMatrixPage /></AuthGuard>} />
          <Route path="/chat" element={<ModuleGuard module="dashboard"><ChatPage /></ModuleGuard>} />
          <Route path="/appointments" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ModuleGuard module="staff_directory"><AppointmentsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/policies" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><ModuleGuard module="staff_directory"><PoliciesPage /></ModuleGuard></AuthGuard>} />
          <Route path="/outcomes" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><ModuleGuard module="staff_directory"><OutcomesPage /></ModuleGuard></AuthGuard>} />
          <Route path="/room-checks" element={<ModuleGuard module="staff_directory"><RoomChecksPage /></ModuleGuard>} />
          <Route path="/mobile/check-in" element={<CheckInPage />} />
          <Route path="/mobile/voice-notes" element={<VoiceNotesPage />} />
          <Route path="/medications" element={<ModuleGuard module="staff_directory"><EMedicationPage /></ModuleGuard>} />
          <Route path="/emedication" element={<ModuleGuard module="staff_directory"><EMedicationPage /></ModuleGuard>} />
          <Route path="/emedication/archived" element={<ModuleGuard module="staff_directory"><ArchivedMarPage /></ModuleGuard>} />
          <Route path="/tasks" element={<ModuleGuard module="staff_directory"><TasksPage /></ModuleGuard>} />
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
