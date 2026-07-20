import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import RotaPlannerPage from './pages/scheduling/RotaPlannerPage'
import OvertimeClaimsPage from './pages/scheduling/OvertimeClaimsPage'
import MarketplacePage from './pages/marketplace/MarketplacePage'
import ReportingPage from './pages/reporting/ReportingPage'
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
import GoalsPage from './pages/goals/GoalsPage'
import CareAssessmentsPage from './pages/care-assessments/CareAssessmentsPage'
import EMedicationPage from './pages/emedication/EMedicationPage'
import ArchivedMarPage from './pages/emedication/ArchivedMarPage'
import UnauthorizedPage from './pages/errors/UnauthorizedPage'
import NotFoundPage from './pages/errors/NotFoundPage'
import { UserRole } from '@caredesk/shared'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/case-studies" element={<CaseStudiesPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
       <Route path="/mfa-challenge" element={<MfaChallengePage />} />
       <Route path="/mfa-setup" element={<MfaSetupPage />} />
       <Route path="/survey/satisfaction/:token" element={<SurveyFormPage />} />
        <Route path="/survey/engagement/:token" element={<SurveyFormPage />} />
        <Route path="/family-portal/:token" element={<FamilyPortalPage />} />
        <Route path="/learn" element={<LearningCenterPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfUsePage />} />
        <Route path="/cookies" element={<CookiePolicyPage />} />

      {/* Protected Internal Routes */}
      <Route element={<AuthGuard />}>
        <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route element={<Layout />}>
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
          <Route path="/reporting" element={<ModuleGuard module="reporting"><ReportingPage /></ModuleGuard>} />
          <Route path="/insights" element={<ModuleGuard module="reporting"><InsightsPage /></ModuleGuard>} />
          <Route path="/organizations" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN]}><OrganizationPage /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}><ModuleGuard module="settings"><SettingsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/billing" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN]}><BillingPage /></AuthGuard>} />
          <Route path="/leave" element={<ErrorBoundary><ModuleGuard module="leave"><LeaveManagerPage /></ModuleGuard></ErrorBoundary>} />
          <Route path="/shift-marketplace" element={<ModuleGuard module="marketplace"><ShiftMarketplacePage /></ModuleGuard>} />
          <Route path="/agencies" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><AgenciesPage /></AuthGuard>} />
          <Route path="/service-users" element={<ModuleGuard module="staff_directory"><ServiceUserDirectoryPage /></ModuleGuard>} />
          <Route path="/service-users/:id" element={<ModuleGuard module="staff_directory"><ServiceUserProfilePage /></ModuleGuard>} />
          <Route path="/incidents" element={<ModuleGuard module="staff_directory"><IncidentDirectoryPage /></ModuleGuard>} />
          <Route path="/incidents/:id" element={<ModuleGuard module="staff_directory"><IncidentDetailPage /></ModuleGuard>} />
          <Route path="/training" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER]}><TrainingMatrixPage /></AuthGuard>} />
          <Route path="/chat" element={<ModuleGuard module="dashboard"><ChatPage /></ModuleGuard>} />
          <Route path="/appointments" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ModuleGuard module="staff_directory"><AppointmentsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/policies" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER]}><ModuleGuard module="staff_directory"><PoliciesPage /></ModuleGuard></AuthGuard>} />
          <Route path="/goals" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ModuleGuard module="staff_directory"><GoalsPage /></ModuleGuard></AuthGuard>} />
          <Route path="/care-assessments" element={<ModuleGuard module="staff_directory"><CareAssessmentsPage /></ModuleGuard>} />
          <Route path="/emedication" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ErrorBoundary><EMedicationPage /></ErrorBoundary></AuthGuard>} />
          <Route path="/emedication/archived" element={<AuthGuard allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER]}><ErrorBoundary><ArchivedMarPage /></ErrorBoundary></AuthGuard>} />
          <Route path="/tasks" element={<ModuleGuard module="dashboard"><TasksPage /></ModuleGuard>} />
          <Route path="/room-checks" element={<ModuleGuard module="dashboard"><RoomChecksPage /></ModuleGuard>} />
          <Route path="/check-in" element={<ModuleGuard module="dashboard"><CheckInPage /></ModuleGuard>} />
          <Route path="/voice-notes" element={<ModuleGuard module="dashboard"><VoiceNotesPage /></ModuleGuard>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
