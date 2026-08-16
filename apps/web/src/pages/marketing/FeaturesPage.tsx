import { Container, Typography, Grid, Box, Stack, Paper, Button, Divider } from '@mui/material'
import {
  AccessTime as RemindersMuiIcon,
  Receipt as ExpenseMuiIcon,
  Badge as DbsMuiIcon,
  Psychology as PbsMuiIcon,
  MeetingRoom as RoomChecksMuiIcon,
  CloudDone as BackupMuiIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
// Brand tokens — share with LandingPage and PricingPage so restyling cascades.
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import {
  EmarIcon, CareNoteIcon, SupportPlanIcon, BodyMapIcon, AppointmentIcon, GoalsIcon,
  RotaIcon, LeaveIcon, IncidentIcon, TaskIcon, ChatIcon,
  ShieldIcon, AuditIcon, TrainingIcon, SurveyIcon, PolicyIcon,
} from '../../components/marketing/icons'

// Brand tokens — share with LandingPage and PricingPage so restyling cascades.
const INK = '#1B2430'
const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

// Three groups — same metal palette as LandingPage / PricingPage.
const GROUP_PALETTE = {
  care: { accent: NAVY, soft: 'rgba(15,76,129,0.08)', tick: NAVY },
  ops: { accent: NAVY, soft: 'rgba(15,76,129,0.08)', tick: NAVY },
  compliance: { accent: NAVY, soft: 'rgba(15,76,129,0.08)', tick: NAVY },
} as const

const featureGroups = [
  {
    cat: 'Care Management',
    palette: GROUP_PALETTE.care,
    sections: [
      {
        id: 'emar',
        category: 'eMAR & Medication Management',
        brandIcon: <EmarIcon size={32} />,
        description: 'Digital medication rounds with full audit trails. 31-day MAR chart, controlled drug register, missed-dose alerts.',
        items: [
          { title: '31-Day MAR Chart', desc: 'Full medication administration record with audit trail per dose. Print-ready reports for inspection.' },
          { title: 'Controlled Drug Register', desc: 'Separate register for controlled drugs with stock tracking, witness sign-off, and discrepancy alerts.' },
          { title: 'Missed-Dose Alerts', desc: 'Automatic alerts when a scheduled medication round is missed or late, enabling timely follow-up — backs the §13.1 cross-module workflow.' },
          { title: 'Print-Ready MAR Reports', desc: 'One-click export for CQC evidence packs. Per-person or per-location reports.' },
        ],
      },
      {
        id: 'care-notes',
        category: 'Daily Care Notes',
        brandIcon: <CareNoteIcon size={32} />,
        description: 'Record and share daily care observations with shift-based categorisation. Handover-ready and inspection evidence.',
        items: [
          { title: 'Shift-Based Notes', desc: 'Categorise notes by shift (day/night) and topic. Carer notes are immediately visible to the oncoming shift for smooth handover.' },
          { title: 'Category Tagging', desc: 'Pre-set categories (personal care, behaviour, mood, nutrition, social) ensure consistent documentation across staff.' },
          { title: 'Author Attribution', desc: 'Every note is timestamped and attributed to the staff member. Full audit trail for CQC evidence packs.' },
          { title: 'Person Timeline', desc: 'Notes appear on the person profile timeline alongside care plans, observations, and appointments.' },
        ],
      },
      {
        id: 'support-plans',
        category: 'Person-Centred Support Plans',
        brandIcon: <SupportPlanIcon size={32} />,
        description: 'Build tailored, person-centred support plans with risk assessments and review dates.',
        items: [
          { title: 'Tailored Plan Templates', desc: 'Create support plans by category: personal care, medication, mobility, nutrition, mental health, behaviour, social.' },
          { title: 'Risk Assessment Field', desc: 'Each plan links to a risk assessment. Mitigation actions and review dates tracked per plan.' },
          { title: 'Review Cycle', desc: 'Set review dates with reminders. Reviewed-by and reviewed-at fields provide governance evidence for CQC.' },
          { title: 'Active/Archived Status', desc: 'Plans move to archived when superseded. Full history retained for inspection.' },
        ],
      },
      {
        id: 'body-mapping',
        category: 'Body Mapping',
        brandIcon: <BodyMapIcon size={32} />,
        description: 'Visual injury and mark documentation via health observations with severity tracking.',
        items: [
          { title: 'Health Observations', desc: 'Record observations by category: general, skin, medication, sleep, pain, weight, other. Severity from normal to severe with color-coded left borders.' },
          { title: 'Severity Tracking', desc: 'Normal, mild, moderate, severe. Color-coded for at-a-glance dashboard review.' },
          { title: 'CQC Evidence', desc: 'Observations feed the Safe domain of CQC readiness scoring.' },
          { title: 'Linked to Person Timeline', desc: 'All observations appear on the person profile under the Health tab.' },
        ],
      },
      {
        id: 'appointments',
        category: 'Appointments & Health Checks',
        brandIcon: <AppointmentIcon size={32} />,
        description: 'Track appointments and health reviews with status tracking and dashboard widget.',
        items: [
          { title: 'Full CRUD', desc: 'Create, edit, and delete appointments. Title, person, staff member, start/end time, location, status, and notes.' },
          { title: 'Dashboard Widget', desc: "Today's appointments card shows total, scheduled, completed, and cancelled counts at a glance." },
          { title: 'Status Chips', desc: 'Scheduled, attended, cancelled, did-not-attend. Color-coded for rapid review.' },
          { title: 'Person & Staff Linking', desc: 'Link appointments to both a person and an assigned staff member. Autocomplete search on both.' },
        ],
      },
      {
        id: 'goals',
        category: 'Goals & Progress Tracking',
        brandIcon: <GoalsIcon size={32} />,
        description: 'Set goals and measure outcomes with 0-100% progress per person.',
        items: [
          { title: 'Per-Person Goals', desc: 'Track goals per person with title, description, target date, review date, and progress percentage.' },
          { title: 'Progress Dashboard', desc: 'Summary cards: total goals, active, completed, average progress. Instantly see which people need attention.' },
          { title: 'CQC Domain Mapping', desc: 'Goals tagged by CQC domain (Safe, Effective, Caring, Responsive, Well-led). Feeds readiness scoring.' },
          { title: 'Profile Integration', desc: 'Goals tab (6) on person profile. Standalone page with ?su= filter for per-user view.' },
        ],
      },
    ],
  },
  {
    cat: 'Staff & Operations',
    palette: GROUP_PALETTE.ops,
    sections: [
      {
        id: 'rota',
        category: 'Staff Rostering & Scheduling',
        brandIcon: <RotaIcon size={32} />,
        description: 'Create rotas and manage shift patterns with minimum safe staffing enforcement.',
        items: [
          { title: 'Minimum Staffing Enforcement', desc: 'Configure minimum staff per location per day in Settings. The rota planner cannot create a roster below the threshold.' },
          { title: 'Compliance-Blocked Assignment', desc: "Staff below the organisation's minimum compliance % are blocked from shift assignment. No manual override." },
          { title: 'Shift Marketplace', desc: 'Broadcast open shifts to eligible staff. Staff browse and claim available shifts. Reduces agency dependency.' },
          { title: 'Overtime Rules Engine', desc: '11-hour rest period enforcement between shifts. Manager approval for overtime claims — toggle in Settings.' },
        ],
      },
      {
        id: 'leave',
        category: 'Staff Holiday & Absence Management',
        brandIcon: <LeaveIcon size={32} />,
        description: 'Track annual leave, count holiday days, log absences with calendar, balance cards, and delegation rules.',
        items: [
          { title: 'Calendar With Status Chips', desc: 'Day click shows detailed popup with status chips (pending/approved/rejected), duration, reason, and approve/reject buttons.' },
          { title: 'Balance Cards', desc: 'Compact inline cards showing Total, Used, Pending, Remaining in "X days + Y hours" format.' },
          { title: 'Manager Delegation', desc: 'Primary + delegate manager pairs. Duplicate pairs rejected with 409. Notifications route to correct reviewer.' },
          { title: 'Self-Review Restriction', desc: 'Managers cannot approve their own leave. Manager/admin leave routed to a different ORG_ADMIN.' },
        ],
      },
      {
        id: 'incidents',
        category: 'Incident & Safeguarding',
        brandIcon: <IncidentIcon size={32} />,
        description: 'Report, track and escalate incidents with root cause analysis and action tracking.',
        items: [
          { title: 'Root Cause Tracking', desc: 'Each incident records the root cause and investigation notes for CQC governance.' },
          { title: 'Action Tracking', desc: 'incident_actions table with lifecycle: pending → in_progress → completed/cancelled. Assign owners and due dates.' },
          { title: 'CQC Reportable Flag', desc: 'Incidents flagged as CQC reportable are highlighted on the directory page with a chip.' },
          { title: 'Responsive Domain Scoring', desc: 'Incident severity and escalation data feed the Responsive domain of CQC readiness scoring.' },
        ],
      },
      {
        id: 'tasks',
        category: 'Task Management',
        brandIcon: <TaskIcon size={32} />,
        description: 'Assign and monitor team tasks with status tracking.',
        items: [
          { title: 'Task Assignment', desc: 'Assign tasks to staff with priority, due date, and category. Email and push notifications on assignment.' },
          { title: 'Status Workflow', desc: 'Open → in-progress → completed. Status chips for at-a-glance review on the dashboard.' },
          { title: 'Department Linking', desc: 'Tasks link to departments and teams for filtered views.' },
          { title: 'Recurring Tasks', desc: 'Schedule recurring tasks (e.g. fire drill reminder, monthly audit) with automatic re-assignment.' },
        ],
      },
      {
        id: 'chat',
        category: 'Secure Staff Messaging',
        brandIcon: <ChatIcon size={32} />,
        description: 'GDPR-compliant internal messaging with file sharing and read receipts.',
        items: [
          { title: 'Real-Time Messaging', desc: 'Socket.IO-powered instant messaging with group and DM channels. Optimistic send with dedup prevents double insertion.' },
          { title: 'Link Previews', desc: 'Server-side OG metadata fetch renders rich preview cards. Live preview while typing.' },
          { title: 'File Sharing', desc: 'Upload and share files within channels. Grid/list toggle. Text/JSON/XML preview rendered inline.' },
          { title: 'Read Receipts', desc: 'Unread message dividers and "Seen" indicators for DMs. Cross-page notification dot in the navigation bar.' },
        ],
      },
      {
        id: 'expenses',
        category: 'Expense Tracking',
        materialIcon: <ExpenseMuiIcon sx={{ fontSize: 32 }} />,
        tag: 'Phase 2',
        description: 'Track petty cash, receipts and person spending.',
        items: [
          { title: 'Person Spending Ledger', desc: 'Track purchases against per-person spending allowance. Categorise by type (food, clothing, activities, transport).' },
          { title: 'Receipt Upload', desc: 'Attach photo or scan of receipt to each expense entry. Stored securely against the person profile.' },
          { title: 'Petty Cash Balance', desc: 'Per-location petty cash balance with running total. Top-ups and reconciliations logged.' },
          { title: 'Monthly Reports', desc: 'Export per-person or per-location spend reports for relatives and financial audits.' },
        ],
      },
      {
        id: 'dbs',
        category: 'Right to Work & DBS Reminders',
        materialIcon: <DbsMuiIcon sx={{ fontSize: 32 }} />,
        description: 'Automated alerts before documents expire. Right to work checks and DBS renewal tracking.',
        items: [
          { title: 'Document Expiry Tracking', desc: 'Track passport, visa, DBS certificate, and other right-to-work documents with expiry dates.' },
          { title: 'Automated Reminders', desc: 'Email and push notifications 90, 60, and 30 days before document expiry. Escalation to managers if no action.' },
          { title: 'Compliance Dashboard', desc: 'Staff directory highlights expired/expiring documents with amber/red indicators.' },
          { title: 'CQC Evidence', desc: 'Records contribute to the Safe domain — right to work documentation is a CQC requirement.' },
        ],
      },
      {
        id: 'pbs',
        category: 'PBS Plans',
        materialIcon: <PbsMuiIcon sx={{ fontSize: 32 }} />,
        description: 'Positive Behaviour Support plans with trigger tracking and de-escalation strategies. Included in every subscription.',
        items: [
          { title: 'Trigger Identification', desc: 'Record environmental, social, and internal triggers that precede behaviours that challenge.' },
          { title: 'De-escalation Strategies', desc: 'Pre-agreed step-by-step strategies staff follow when early warning signs appear.' },
          { title: 'Post-Incident Support', desc: 'Recovery protocols and review process after incidents, ensuring the individual is supported.' },
          { title: 'Restrictive Practice Register', desc: 'Log any restrictive interventions per incident for governance reporting. CQC reportable flag.' },
        ],
      },
    ],
  },
  {
    cat: 'Compliance & Reporting',
    palette: GROUP_PALETTE.compliance,
    sections: [
      {
        id: 'compliance',
        category: 'Inspection Readiness Dashboard',
        brandIcon: <ShieldIcon size={32} />,
        description: 'Stay prepared for regulatory inspections with live CQC readiness scoring across all 5 domains from real data.',
        items: [
          { title: 'Live Percentage Scoring', desc: 'Per Quality Statement score using training, competency, survey, and incident data. Not estimates — real records.' },
          { title: 'Gap Analysis', desc: 'Identifies what evidence to log next. Tells you exactly what to action to move from "Requires Improvement" to "Good".' },
          { title: 'Multi-Regulator Framework', desc: 'Native support for CQC, CIW/RISCA, Care Inspectorate, and RQIA. Framework-aware scoring for all four.' },
          { title: 'Escalation Thresholds', desc: 'When compliance drops below your configured minimum, all managers and ORG_ADMINs are notified automatically.' },
        ],
      },
      {
        id: 'reminders',
        category: 'Compliance Reminders',
        materialIcon: <RemindersMuiIcon sx={{ fontSize: 32 }} />,
        description: 'Automated alerts for fire drills, PAT tests, training expiry, and compliance lapses.',
        items: [
          { title: 'Training Expiry Alerts', desc: 'Automated email + push notification 90, 60, and 30 days before training expires. Outstanding alerts to managers.' },
          { title: 'Competency Due Reminders', desc: 'Competency assessments due soon trigger notifications to the staff member and their manager.' },
          { title: 'Certificate Tracking', desc: 'location_certificates table tracks gas safety, fire safety, food hygiene expiry with automatic reminders.' },
          { title: 'Escalation', desc: 'When compliance drops below the org threshold, all ORG_ADMINs and managers are notified.' },
        ],
      },
      {
        id: 'audit',
        category: 'Audit Reports',
        brandIcon: <AuditIcon size={32} />,
        description: 'Generate compliance and audit reports with KLOE-organised evidence packs.',
        items: [
          { title: 'KLOE-Organised Evidence', desc: 'Evidence grouped by CQC domain (Safe, Effective, Caring, Responsive, Well-led) with item counts.' },
          { title: 'Print-Ready PDF', desc: 'Page-break CSS ensures clean page breaks for inspection submission.' },
          { title: 'Staff Filter', desc: 'Filter evidence packs by staff member, date range, and compliance domain.' },
          { title: 'Audit Trail Log', desc: 'Searchable audit log showing user name, action, and timestamp for every record created/edited/viewed.' },
        ],
      },
      {
        id: 'training',
        category: 'Training Compliance Matrix',
        brandIcon: <TrainingIcon size={32} />,
        description: 'CQC-mandated training tracking per role with gap-flagging badges. Scores feed the Effective domain.',
        items: [
          { title: 'CQC-Mandated Training', desc: 'Tag any training module as CQC-mandated with role-specific enforcement. The matrix flags missing mandatory training per role.' },
          { title: 'Unlimited Module Tracking', desc: 'Track an unlimited number of training modules with expiry alerts, completion status, and digital records.' },
          { title: 'Role-Based Compliance Profiles', desc: 'Each role gets a profile of linked requirements. Staff auto-assigned based on their role. Role changes reflect instantly.' },
          { title: 'Scoring Integration', desc: 'Training completion rates feed the Effective domain score in your CQC readiness dashboard.' },
        ],
      },
      {
        id: 'surveys',
        category: 'Satisfaction & Engagement Surveys',
        brandIcon: <SurveyIcon size={32} />,
        description: 'Email-invited surveys feeding CQC Caring and Well-led domains.',
        items: [
          { title: 'Satisfaction Surveys (Caring)', desc: 'Email invitations with unique tokens. Public form for people and families. Source tracked as Email or Manual.' },
          { title: 'Staff Engagement (Well-led)', desc: 'Customizable question templates with slider-based ratings. Send to specific roles. Anonymous or named.' },
          { title: 'Template Builder', desc: 'Create unlimited survey templates with per-question key. Stored in JSON for flexible analysis.' },
          { title: 'Dashboard & Analytics', desc: 'Aggregated scores, response counts, and average scores by question. All feeding into CQC domain scoring.' },
        ],
      },
      {
        id: 'room-checks',
        category: 'Room Checks',
        materialIcon: <RoomChecksMuiIcon sx={{ fontSize: 32 }} />,
        description: 'Digital room inspection records.',
        items: [
          { title: 'Digital Checklists', desc: 'Pre-built room inspection checklist covering cleanliness, safety, equipment, and environment.' },
          { title: 'Photo Evidence', desc: 'Attach photos to findings. Auto-stored in evidence packs for CQC inspections.' },
          { title: 'Issue Logging', desc: 'Flag issues with severity and auto-create follow-up tasks for resolution.' },
          { title: 'Recurring Schedules', desc: 'Daily, weekly, monthly room check schedules with automatic assignment to relevant staff.' },
        ],
      },
      {
        id: 'backup',
        category: 'Data Backup & Restore',
        materialIcon: <BackupMuiIcon sx={{ fontSize: 32 }} />,
        description: 'Secure, GDPR-compliant data protection with UK-based ISO 27001 hosting.',
        items: [
          { title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit (TLS 1.3). UK-based ISO 27001-certified data centres.' },
          { title: 'Automated Daily Backups', desc: 'Point-in-time recovery available. Full database snapshots every 24 hours with 30-day retention.' },
          { title: 'Role-Based Access', desc: 'Granular permissions per module (view/edit). ORG_ADMIN only can change roles. Full audit trail of access.' },
          { title: 'UK GDPR & DPA 2018', desc: 'ICO registered. UK data sovereignty. No data leaves UK jurisdiction.' },
        ],
      },
      {
        id: 'policies',
        category: 'Policy & Procedure Management',
        brandIcon: <PolicyIcon size={32} />,
        description: 'Upload, version-control and share team policies with PDF download and Share-to-Chat.',
        items: [
          { title: '12 Standard CQC Policies', desc: 'One-click seed: Risk Assessment, Complaints, Lone Working, GDPR, Whistleblowing, Infection Control, Equality & Diversity, MCA & DoLS, Fire Safety, Medication, Safeguarding Adults, Health & Safety.' },
          { title: 'Grid/List View', desc: 'Grid view shows category-coloured cards. List view shows full policy content with audit trail.' },
          { title: 'PDF Download', desc: 'Generate PDF via Blob with one click for printing or emailing to staff.' },
          { title: 'Share to Chat', desc: 'Send a policy preview directly into any chat channel for team acknowledgement.' },
        ],
      },
    ],
  },
]

const TOTAL_SECTIONS = featureGroups.reduce((n, g) => n + g.sections.length, 0)

export default function FeaturesPage() {
  const navigate = useNavigate()
  let sectionIndex = 0

  return (
    <MarketingLayout>
      <PageMeta
        title="Care Management Software Features | MeticleCare"
        description="Explore MeticleCare features: eMAR medication management, staff rostering, care planning, compliance oversight, incident reporting, and daily care records for UK care providers."
        canonicalPath="/features"
      />

      {/* Page Header */}
      <Box component="section" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 10 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 820, mx: 'auto' }}>
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1.25,
                bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                px: 2, py: 0.75, mb: 3,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
              <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                ALL FOUR UK REGULATORS · CQC, CIW, CIS, RQIA
              </Typography>
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.4rem', md: '3.2rem' },
                fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', color: INK, mb: 3,
              }}
            >
              Everything you need to run your service.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: { xs: '1rem', md: '1.12rem' }, lineHeight: 1.7, mb: 4 }}>
              MeticleCare brings together care management, staff operations, and compliance reporting in one platform. Every feature is designed so inspection-ready evidence is a byproduct of daily work — not a separate paper exercise.
            </Typography>
            <Typography sx={{ color: MIST, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {TOTAL_SECTIONS} features across {featureGroups.length} modules
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Feature Groups */}
      {featureGroups.map((group, gi) => (
        <Box key={group.cat}>
          {/* Group Header */}
          <Box
            component="section"
            aria-label={group.cat}
            sx={{ py: { xs: 5, md: 6 }, bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <Container maxWidth="lg">
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Box sx={{ width: 6, height: 32, bgcolor: NAVY, borderRadius: 1 }} />
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 900, color: NAVY, fontSize: '0.78rem',
                      letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.5,
                    }}
                  >
                    Module {gi + 1}
                  </Typography>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 900, color: INK,
                      fontSize: { xs: '1.6rem', md: '2.1rem' },
                      lineHeight: 1.15, letterSpacing: '-0.02em',
                    }}
                  >
                    {group.cat}
                  </Typography>
                </Box>
                <Box sx={{ ml: 'auto !important' }}>
                  <Typography sx={{ fontWeight: 700, color: MIST, fontSize: '0.85rem' }}>
                    {group.sections.length} features
                  </Typography>
                </Box>
              </Stack>
            </Container>
          </Box>

          {/* Sections */}
          {group.sections.map((section) => {
            const idx = sectionIndex++
            const sectionBg = idx % 2 === 0 ? '#FFFFFF' : BONE
            const IconBox = section.brandIcon ?? section.materialIcon
            return (
              <Box
                key={section.id}
                id={section.id}
                component="section"
                aria-labelledby={`${section.id}-title`}
                sx={{ py: { xs: 6, md: 9 }, bgcolor: sectionBg, borderBottom: `1px solid ${HAIRLINE}`, scrollMarginTop: 80 }}
              >
                <Container maxWidth="lg">
                  <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-start">
                    <Grid item xs={12} md={4}>
                      <Box sx={{ position: { md: 'sticky' }, top: 96 }}>
                        <Box
                          sx={{
                            width: 64, height: 64, bgcolor: 'rgba(15,76,129,0.08)',
                            borderRadius: 3, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', mb: 3, color: NAVY,
                          }}
                        >
                          {IconBox}
                        </Box>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                          <Typography
                            id={`${section.id}-title`}
                            variant="h3"
                            sx={{ fontWeight: 900, color: INK, fontSize: '1.4rem', lineHeight: 1.2 }}
                          >
                            {section.category}
                          </Typography>
                          {section.tag && (
                            <Box
                              sx={{
                                bgcolor: '#FEF3C7', color: '#92400E',
                                px: 1.25, py: 0.25, borderRadius: 1,
                                fontSize: '0.65rem', fontWeight: 800,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                              }}
                            >
                              {section.tag}
                            </Box>
                          )}
                        </Stack>
                        <Typography sx={{ color: MIST, fontSize: '0.95rem', lineHeight: 1.7, mb: section.items.length > 0 ? 0 : 0 }}>
                          {section.description}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Stack spacing={2}>
                        {section.items.map((item, i) => (
                          <Paper
                            key={i}
                            elevation={0}
                            sx={{
                              p: { xs: 2.75, md: 3.5 },
                              border: `1px solid ${HAIRLINE}`,
                              borderLeft: `3px solid ${EMERALD}`,
                              borderRadius: 2.5,
                              transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                              '&:hover': {
                                borderColor: NAVY,
                                borderLeftColor: EMERALD,
                                transform: 'translateY(-2px)',
                                boxShadow: '0 12px 28px -16px rgba(15,76,129,0.3)',
                              },
                            }}
                          >
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 800, color: INK, mb: 1,
                                display: 'flex', alignItems: 'center', gap: 1.25, fontSize: '1rem',
                              }}
                            >
                              <CheckIcon sx={{ fontSize: 20, color: EMERALD }} />
                              {item.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: MIST, lineHeight: 1.7, pl: 4.5 }}>
                              {item.desc}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Grid>
                  </Grid>
                </Container>
              </Box>
            )
          })}
        </Box>
      ))}

      {/* CTA Section */}
      <Box component="section" sx={{ py: { xs: 11, md: 15 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2.1rem', md: '2.8rem' },
              fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em',
              color: INK, mb: 3,
            }}
          >
            See it on your service, not a demo dataset.
          </Typography>
          <Typography sx={{ color: MIST, fontSize: '1.1rem', lineHeight: 1.7, mb: 5, mx: 'auto', maxWidth: 580 }}>
            Start your 14-day free trial on the full Care Service tier — no credit card, no auto-charge. Or book a 30-minute call and we'll walk through anything specific to your provider.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/register')}
              sx={{
                bgcolor: NAVY, fontWeight: 800,
                '&:hover': { bgcolor: NAVY_DEEP },
                px: { xs: 5, sm: 7 }, py: 1.9, fontSize: '1.02rem',
              }}
            >
              Start your free trial
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/contact')}
              sx={{
                borderColor: HAIRLINE, color: INK, fontWeight: 700,
                '&:hover': { borderColor: INK, bgcolor: 'rgba(15,76,129,0.04)' },
                px: { xs: 5, sm: 6 }, py: 1.9, fontSize: '1.02rem',
              }}
            >
              Book a call
            </Button>
          </Stack>
          <Divider sx={{ my: 5, borderColor: HAIRLINE }} />
          <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap" useFlexGap>
            {[
              { mark: 'CQC', label: 'Care Quality Commission' },
              { mark: 'CIW', label: 'Care Inspectorate Wales' },
              { mark: 'CIS', label: 'Care Inspectorate Scotland' },
              { mark: 'RQIA', label: 'NI Quality & Improvement' },
            ].map((t) => (
              <Stack key={t.mark} direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: EMERALD,
                  }}
                />
                <Typography sx={{ fontWeight: 700, color: INK, fontSize: '0.82rem' }}>
                  {t.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
