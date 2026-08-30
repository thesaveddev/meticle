import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import ModuleGuard from './components/ModuleGuard'

const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const RotaPlannerPage = lazy(() => import('./pages/scheduling/RotaPlannerPage'))
const OvertimeClaimsPage = lazy(() => import('./pages/scheduling/OvertimeClaimsPage'))
const MarketplacePage = lazy(() => import('./pages/marketplace/MarketplacePage'))
const ReportingPage = lazy(() => import('./pages/reporting/ReportingPage'))
const ReportBuilder = lazy(() => import('./pages/reporting/ReportBuilder'))
const InsightsPage = lazy(() => import('./pages/insights/InsightsPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'))
const MfaChallengePage = lazy(() => import('./pages/auth/MfaChallengePage'))
const MfaSetupPage = lazy(() => import('./pages/auth/MfaSetupPage'))
const OnboardingFlow = lazy(() => import('./pages/onboarding/OnboardingFlow'))
const StaffDirectoryPage = lazy(() => import('./pages/staff/StaffDirectoryPage'))
const StaffProfilePage = lazy(() => import('./pages/staff/StaffProfilePage'))
const LocationDetailPage = lazy(() => import('./pages/locations/LocationDetailPage'))
const LocationsPage = lazy(() => import('./pages/locations/LocationsPage'))
// Lazy-loaded marketing and application pages for code splitting
const FeaturesPage = lazy(() => import('./pages/marketing/FeaturesPage'))
const PricingPage = lazy(() => import('./pages/marketing/PricingPage'))
const AboutPage = lazy(() => import('./pages/marketing/AboutPage'))
const CaseStudiesPage = lazy(() => import('./pages/marketing/CaseStudiesPage'))
const ContactPage = lazy(() => import('./pages/marketing/ContactPage'))
const HowItWorksPage = lazy(() => import('./pages/marketing/HowItWorksPage'))
const BlogPage = lazy(() => import('./pages/marketing/BlogPage'))
const ComplianceBadgesPage = lazy(() => import('./pages/marketing/ComplianceBadgesPage'))
const LearningCenterPage = lazy(() => import('./pages/learn/LearningCenterPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'))
const TermsOfUsePage = lazy(() => import('./pages/legal/TermsOfUsePage'))
const CookiePolicyPage = lazy(() => import('./pages/legal/CookiePolicyPage'))
const CompliancePage = lazy(() => import('./pages/compliance/CompliancePage'))
const IdentityMonitoringPage = lazy(() => import('./pages/compliance/IdentityMonitoringPage'))
const CompetencyAssessmentsPage = lazy(() => import('./pages/compliance/CompetencyAssessmentsPage'))
const EvidencePacksPage = lazy(() => import('./pages/compliance/EvidencePacksPage'))
const CqcReadinessPage = lazy(() => import('./pages/compliance/CqcReadinessPage'))
const SatisfactionSurveysPage = lazy(() => import('./pages/compliance/SatisfactionSurveysPage'))
const StaffEngagementPage = lazy(() => import('./pages/compliance/StaffEngagementPage'))
const DSPTPage = lazy(() => import('./pages/dspt/DSPTPage'))
const OrganizationPage = lazy(() => import('./pages/organization/OrganizationPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))
const BillingPage = lazy(() => import('./pages/billing/BillingPage'))
const LeaveManagerPage = lazy(() => import('./pages/leave/LeaveManagerPage'))
const ShiftMarketplacePage = lazy(() => import('./pages/shift-marketplace/ShiftMarketplacePage'))
const AgenciesPage = lazy(() => import('./pages/agencies/AgenciesPage'))
const ExpensesPage = lazy(() => import('./pages/expenses/ExpensesPage'))
const PersonDirectoryPage = lazy(() => import('./pages/people/PersonDirectoryPage'))
const PersonProfilePage = lazy(() => import('./pages/people/PersonProfilePage'))
const IncidentDirectoryPage = lazy(() => import('./pages/incidents/IncidentDirectoryPage'))
const IncidentDetailPage = lazy(() => import('./pages/incidents/IncidentDetailPage'))
const ChatPage = lazy(() => import('./pages/chat/ChatPage'))
const TrainingMatrixPage = lazy(() => import('./pages/training/TrainingMatrixPage'))
const SurveyFormPage = lazy(() => import('./pages/SurveyFormPage'))
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'))
const RoomChecksPage = lazy(() => import('./pages/room-checks/RoomChecksPage'))
const CheckInPage = lazy(() => import('./pages/mobile/CheckInPage'))
const VoiceNotesPage = lazy(() => import('./pages/mobile/MobileNotesPage'))
const FamilyPortalPage = lazy(() => import('./pages/FamilyPortalPage'))
const ComplianceRecordsPage = lazy(() => import('./pages/compliance/ComplianceRecordsPage'))
const AppointmentsPage = lazy(() => import('./pages/appointments/AppointmentsPage'))
const PoliciesPage = lazy(() => import('./pages/policies/PoliciesPage'))
const MissionControlPage = lazy(() => import('./pages/mission-control/MissionControlPage'))
const CompliancePortalPage = lazy(() => import('./pages/compliance-portal/CompliancePortalPage'))
const PortalLoginPage = lazy(async () => {
  const module = await import('./pages/compliance-portal/CompliancePortalPage')
  return { default: module.PortalLoginPage }
})
const EMedicationPage = lazy(() => import('./pages/emedication/EMedicationPage'))
const ArchivedMarPage = lazy(() => import('./pages/emedication/ArchivedMarPage'))
const MealPlanPage = lazy(() => import('./pages/nutrition/MealPlanPage'))
const UnauthorizedPage = lazy(() => import('./pages/errors/UnauthorizedPage'))
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'))
const PlatformAdminPage = lazy(() => import('./pages/admin/PlatformAdminPage'))
const AdminOrganizationDetailPage = lazy(() => import('./pages/admin/AdminOrganizationDetailPage'))
import { UserRole } from '@meticle/shared'
import ErrorBoundary from './components/ErrorBoundary'
import { MeticleThemeProvider } from './context/ThemeContext'

function RouteLoading() {
  return <div role="status" aria-live="polite" style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
}

function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
      <Route path="/features" element={<ErrorBoundary><Suspense fallback={null}><FeaturesPage /></Suspense></ErrorBoundary>} />
      <Route path="/how-it-works" element={<ErrorBoundary><Suspense fallback={null}><HowItWorksPage /></Suspense></ErrorBoundary>} />
      <Route path="/pricing" element={<ErrorBoundary><Suspense fallback={null}><PricingPage /></Suspense></ErrorBoundary>} />
      <Route path="/about" element={<ErrorBoundary><Suspense fallback={null}><AboutPage /></Suspense></ErrorBoundary>} />
      <Route path="/case-studies" element={<ErrorBoundary><Suspense fallback={null}><CaseStudiesPage /></Suspense></ErrorBoundary>} />
      <Route path="/contact" element={<ErrorBoundary><Suspense fallback={null}><ContactPage /></Suspense></ErrorBoundary>} />
      <Route path="/blog" element={<ErrorBoundary><Suspense fallback={null}><BlogPage /></Suspense></ErrorBoundary>} />
      <Route path="/compliance-badges" element={<ErrorBoundary><Suspense fallback={null}><ComplianceBadgesPage /></Suspense></ErrorBoundary>} />
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
          <Route path="/nutrition" element={<ModuleGuard module="emedication"><MealPlanPage /></ModuleGuard>} />
          <Route path="/tasks" element={<ModuleGuard module="tasks"><TasksPage /></ModuleGuard>} />
          <Route path="/platform-admin" element={<AuthGuard allowedRoles={[UserRole.SUPER_ADMIN]}><PlatformAdminPage /></AuthGuard>} />
          <Route path="/platform-admin/organizations/:id" element={<AuthGuard allowedRoles={[UserRole.SUPER_ADMIN]}><AdminOrganizationDetailPage /></AuthGuard>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      </Routes>
    </Suspense>
  )
}

export default App
