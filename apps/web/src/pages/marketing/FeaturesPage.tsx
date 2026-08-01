import { Container, Typography, Grid, Box, Stack, Paper, Button } from '@mui/material'
import {
  Verified as ReadinessIcon,
  Assignment as TrainingIcon,
  Description as PolicyIcon,
  Medication as EmarIcon,
  EditNote as CareNotesIcon,
  Schedule as RotaIcon,
  Chat as ChatIcon,
  BeachAccess as LeaveIcon,
  Map as RegulatorIcon,
  CheckCircle as CheckIcon,
  CalendarMonth as AppointmentsIcon,
  Flag as GoalsIcon,
  Warning as IncidentIcon,
  Receipt as ExpenseIcon,
  Badge as DbsIcon,
  Psychology as PbsIcon,
  NotificationsActive as RemindersIcon,
  Assessment as AuditIcon,
  MeetingRoom as RoomChecksIcon,
  CloudDone as BackupIcon,
  MonitorHeart as BodyMapIcon,
  TaskAlt as TasksIcon,
} from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import { useNavigate } from 'react-router-dom'

const featureGroups = [
  {
    cat: 'Care Management',
    color: '#0F4C81',
    sections: [
      {
        id: 'emar',
        category: 'eMAR & Medication Management',
        icon: <EmarIcon sx={{ fontSize: 40 }} />,
        description: 'Digital medication rounds with full audit trails. 31-day MAR chart, controlled drug register, missed-dose alerts.',
        items: [
          { title: '31-Day MAR Chart', desc: 'Full medication administration record with audit trail per dose. Print-ready reports for inspection.' },
          { title: 'Controlled Drug Register', desc: 'Separate register for controlled drugs with stock tracking, witness sign-off, and discrepancy alerts.' },
          { title: 'Missed-Dose Alerts', desc: 'Automatic alerts when a scheduled medication round is missed or late, enabling timely follow-up.' },
          { title: 'Print-Ready MAR Reports', desc: 'One-click export for CQC evidence packs. Per-service-user or per-location reports.' },
        ]
      },
      {
        id: 'care-notes',
        category: 'Daily Care Notes',
        icon: <CareNotesIcon sx={{ fontSize: 40 }} />,
        description: 'Record and share daily care observations with shift-based categorisation. Handover-ready and inspection evidence.',
        items: [
          { title: 'Shift-Based Notes', desc: 'Categorise notes by shift (day/night) and topic. Carer notes are immediately visible to the oncoming shift for smooth handover.' },
          { title: 'Category Tagging', desc: 'Pre-set categories (personal care, behaviour, mood, nutrition, social) ensure consistent documentation across staff.' },
          { title: 'Author Attribution', desc: 'Every note is timestamped and attributed to the staff member. Full audit trail for CQC evidence packs.' },
          { title: 'Person Timeline', desc: 'Notes appear on the person profile timeline alongside care plans, observations, and appointments.' },
        ]
      },
      {
        id: 'support-plans',
        category: 'Person-Centred Support Plans',
        icon: <PolicyIcon sx={{ fontSize: 40 }} />,
        description: 'Build tailored, person-centred support plans with risk assessments and review dates.',
        items: [
          { title: 'Tailored Plan Templates', desc: 'Create support plans by category: personal care, medication, mobility, nutrition, mental health, behaviour, social.' },
          { title: 'Risk Assessment Field', desc: 'Each plan links to a risk assessment. Mitigation actions and review dates tracked per plan.' },
          { title: 'Review Cycle', desc: 'Set review dates with reminders. Reviewed-by and reviewed-at fields provide governance evidence for CQC.' },
          { title: 'Active/Archived Status', desc: 'Plans move to archived when superseded. Full history retained for inspection.' },
        ]
      },
      {
        id: 'body-mapping',
        category: 'Body Mapping',
        icon: <BodyMapIcon sx={{ fontSize: 40 }} />,
        description: 'Visual injury and mark documentation via health observations with severity tracking.',
        items: [
          { title: 'Health Observations', desc: 'Record observations by category: general, skin, medication, sleep, pain, weight, other. Severity from normal to severe with color-coded left borders.' },
          { title: 'Severity Tracking', desc: 'Normal, mild, moderate, severe. Color-coded for at-a-glance dashboard review.' },
          { title: 'CQC Evidence', desc: 'Observations feed the Safe domain of CQC readiness scoring.' },
          { title: 'Linked to Person Timeline', desc: 'All observations appear on the person profile under the Health tab.' },
        ]
      },
      {
        id: 'appointments',
        category: 'Appointments & Health Checks',
        icon: <AppointmentsIcon sx={{ fontSize: 40 }} />,
        description: 'Track appointments and health reviews with status tracking and dashboard widget.',
        items: [
          { title: 'Full CRUD', desc: 'Create, edit, and delete appointments. Title, person, staff member, start/end time, location, status, and notes.' },
          { title: 'Dashboard Widget', desc: 'Today\'s appointments card shows total, scheduled, completed, and cancelled counts at a glance.' },
          { title: 'Status Chips', desc: 'Scheduled, attended, cancelled, did-not-attend. Color-coded for rapid review.' },
          { title: 'Person & Staff Linking', desc: 'Link appointments to both a person and an assigned staff member. Autocomplete search on both.' },
        ]
      },
      {
        id: 'goals',
        category: 'Goals & Progress Tracking',
        icon: <GoalsIcon sx={{ fontSize: 40 }} />,
        description: 'Set goals and measure outcomes with 0-100% progress per person.',
        items: [
          { title: 'Per-Person Goals', desc: 'Track goals per person with title, description, target date, review date, and progress percentage.' },
          { title: 'Progress Dashboard', desc: 'Summary cards: total goals, active, completed, average progress. Instantly see which people need attention.' },
          { title: 'CQC Domain Mapping', desc: 'Goals tagged by CQC domain (Safe, Effective, Caring, Responsive, Well-led). Feeds readiness scoring.' },
          { title: 'Profile Integration', desc: 'Goals tab (6) on person profile. Standalone page with ?su= filter for per-user view.' },
        ]
      },
    ]
  },
  {
    cat: 'Staff & Operations',
    color: '#16A34A',
    sections: [
      {
        id: 'rota',
        category: 'Staff Rostering & Scheduling',
        icon: <RotaIcon sx={{ fontSize: 40 }} />,
        description: 'Create rotas and manage shift patterns with minimum safe staffing enforcement.',
        items: [
          { title: 'Minimum Staffing Enforcement', desc: 'Configure minimum staff per location per day in Settings. The rota planner cannot create a roster below the threshold.' },
          { title: 'Compliance-Blocked Assignment', desc: 'Staff below the organisation\'s minimum compliance % are blocked from shift assignment. No manual override.' },
          { title: 'Shift Marketplace', desc: 'Broadcast open shifts to eligible staff. Staff browse and claim available shifts. Reduces agency dependency.' },
          { title: 'Overtime Rules Engine', desc: '11-hour rest period enforcement between shifts. Manager approval for overtime claims — toggle in Settings.' },
        ]
      },
      {
        id: 'leave',
        category: 'Staff Holiday & Absence Management',
        icon: <LeaveIcon sx={{ fontSize: 40 }} />,
        description: 'Track annual leave, count holiday days, log absences with calendar, balance cards, and delegation rules.',
        items: [
          { title: 'Calendar With Status Chips', desc: 'Day click shows detailed popup with status chips (pending/approved/rejected), duration, reason, and approve/reject buttons.' },
          { title: 'Balance Cards', desc: 'Compact inline cards showing Total, Used, Pending, Remaining in "X days + Y hours" format.' },
          { title: 'Manager Delegation', desc: 'Primary + delegate manager pairs. Duplicate pairs rejected with 409. Notifications route to correct reviewer.' },
          { title: 'Self-Review Restriction', desc: 'Managers cannot approve their own leave. Manager/admin leave routed to a different ORG_ADMIN.' },
        ]
      },
      {
        id: 'incidents',
        category: 'Incident & Safeguarding',
        icon: <IncidentIcon sx={{ fontSize: 40 }} />,
        description: 'Report, track and escalate incidents with root cause analysis and action tracking.',
        items: [
          { title: 'Root Cause Tracking', desc: 'Each incident records the root cause and investigation notes for CQC governance.' },
          { title: 'Action Tracking', desc: 'incident_actions table with lifecycle: pending → in_progress → completed/cancelled. Assign owners and due dates.' },
          { title: 'CQC Reportable Flag', desc: 'Incidents flagged as CQC reportable are highlighted on the directory page with a chip.' },
          { title: 'Responsive Domain Scoring', desc: 'Incident severity and escalation data feed the Responsive domain of CQC readiness scoring.' },
        ]
      },
      {
        id: 'tasks',
        category: 'Task Management',
        icon: <TasksIcon sx={{ fontSize: 40 }} />,
        description: 'Assign and monitor team tasks with status tracking.',
        items: [
          { title: 'Task Assignment', desc: 'Assign tasks to staff with priority, due date, and category. Email and push notifications on assignment.' },
          { title: 'Status Workflow', desc: 'Open → in-progress → completed. Status chips for at-a-glance review on the dashboard.' },
          { title: 'Department Linking', desc: 'Tasks link to departments and teams for filtered views.' },
          { title: 'Recurring Tasks', desc: 'Schedule recurring tasks (e.g. fire drill reminder, monthly audit) with automatic re-assignment.' },
        ]
      },
      {
        id: 'chat',
        category: 'Secure Staff Messaging',
        icon: <ChatIcon sx={{ fontSize: 40 }} />,
        description: 'GDPR-compliant internal messaging with file sharing and read receipts.',
        items: [
          { title: 'Real-Time Messaging', desc: 'Socket.IO-powered instant messaging with group and DM channels. Optimistic send with dedup prevents double insertion.' },
          { title: 'Link Previews', desc: 'Server-side OG metadata fetch renders rich preview cards. Live preview while typing.' },
          { title: 'File Sharing', desc: 'Upload and share files within channels. Grid/list toggle. Text/JSON/XML preview rendered inline.' },
          { title: 'Read Receipts', desc: 'Unread message dividers and "Seen" indicators for DMs. Cross-page notification dot in the navigation bar.' },
        ]
      },
      {
        id: 'expenses',
        category: 'Expense Tracking',
        icon: <ExpenseIcon sx={{ fontSize: 40 }} />,
        tag: 'Phase 2',
        description: 'Track petty cash, receipts and person spending.',
        items: [
          { title: 'Person Spending Ledger', desc: 'Track purchases against per-service-user spending allowance. Categorise by type (food, clothing, activities, transport).' },
          { title: 'Receipt Upload', desc: 'Attach photo or scan of receipt to each expense entry. Stored securely against the person profile.' },
          { title: 'Petty Cash Balance', desc: 'Per-location petty cash balance with running total. Top-ups and reconciliations logged.' },
          { title: 'Monthly Reports', desc: 'Export per-service-user or per-location spend reports for relatives and financial audits.' },
        ]
      },
      {
        id: 'dbs',
        category: 'Right to Work & DBS Reminders',
        icon: <DbsIcon sx={{ fontSize: 40 }} />,
        description: 'Automated alerts before documents expire. Right to work checks and DBS renewal tracking.',
        items: [
          { title: 'Document Expiry Tracking', desc: 'Track passport, visa, DBS certificate, and other right-to-work documents with expiry dates.' },
          { title: 'Automated Reminders', desc: 'Email and push notifications 90, 60, and 30 days before document expiry. Escalation to managers if no action.' },
          { title: 'Compliance Dashboard', desc: 'Staff directory highlights expired/expiring documents with amber/red indicators.' },
          { title: 'CQC Evidence', desc: 'Records contribute to the Safe domain — right to work documentation is a CQC requirement.' },
        ]
      },
      {
        id: 'pbs',
        category: 'PBS Plans',
        icon: <PbsIcon sx={{ fontSize: 40 }} />,
        description: 'Positive Behaviour Support plans with trigger tracking and de-escalation strategies. Included in every subscription.',
        items: [
          { title: 'Trigger Identification', desc: 'Record environmental, social, and internal triggers that precede behaviours that challenge.' },
          { title: 'De-escalation Strategies', desc: 'Pre-agreed step-by-step strategies staff follow when early warning signs appear.' },
          { title: 'Post-Incident Support', desc: 'Recovery protocols and review process after incidents, ensuring the individual is supported.' },
          { title: 'Restrictive Practice Register', desc: 'Log any restrictive interventions per incident for governance reporting. CQC reportable flag.' },
        ]
      },
    ]
  },
  {
    cat: 'Compliance & Reporting',
    color: '#7C3AED',
    sections: [
      {
        id: 'compliance',
        category: 'Inspection Readiness Dashboard',
        icon: <ReadinessIcon sx={{ fontSize: 40 }} />,
        description: 'Stay prepared for regulatory inspections with live CQC readiness scoring across all 5 domains from real data.',
        items: [
          { title: 'Live Percentage Scoring', desc: 'Per Quality Statement score using training, competency, survey, and incident data. Not estimates — real records.' },
          { title: 'Gap Analysis', desc: 'Identifies what evidence to log next. Tells you exactly what to action to move from "Requires Improvement" to "Good".' },
          { title: 'Multi-Regulator Framework', desc: 'Native support for CQC, CIW/RISCA, Care Inspectorate, and RQIA. Framework-aware scoring for all four.' },
          { title: 'Escalation Thresholds', desc: 'When compliance drops below your configured minimum, all managers and ORG_ADMINs are notified automatically.' },
        ]
      },
      {
        id: 'reminders',
        category: 'Compliance Reminders',
        icon: <RemindersIcon sx={{ fontSize: 40 }} />,
        description: 'Automated alerts for fire drills, PAT tests, training expiry, and compliance lapses.',
        items: [
          { title: 'Training Expiry Alerts', desc: 'Automated email + push notification 90, 60, and 30 days before training expires. Outstanding alerts to managers.' },
          { title: 'Competency Due Reminders', desc: 'Competency assessments due soon trigger notifications to the staff member and their manager.' },
          { title: 'Certificate Tracking', desc: 'location_certificates table tracks gas safety, fire safety, food hygiene expiry with automatic reminders.' },
          { title: 'Escalation', desc: 'When compliance drops below the org threshold, all ORG_ADMINs and managers are notified.' },
        ]
      },
      {
        id: 'audit',
        category: 'Audit Reports',
        icon: <AuditIcon sx={{ fontSize: 40 }} />,
        description: 'Generate compliance and audit reports with KLOE-organised evidence packs.',
        items: [
          { title: 'KLOE-Organised Evidence', desc: 'Evidence grouped by CQC domain (Safe, Effective, Caring, Responsive, Well-led) with item counts.' },
          { title: 'Print-Ready PDF', desc: 'Page-break CSS ensures clean page breaks for inspection submission.' },
          { title: 'Staff Filter', desc: 'Filter evidence packs by staff member, date range, and compliance domain.' },
          { title: 'Audit Trail Log', desc: 'Searchable audit log showing user name, action, and timestamp for every record created/edited/viewed.' },
        ]
      },
      {
        id: 'training',
        category: 'Training Compliance Matrix',
        icon: <TrainingIcon sx={{ fontSize: 40 }} />,
        description: 'CQC-mandated training tracking per role with gap-flagging badges. Scores feed the Effective domain.',
        items: [
          { title: 'CQC-Mandated Training', desc: 'Tag any training module as CQC-mandated with role-specific enforcement. The matrix flags missing mandatory training per role.' },
          { title: 'Unlimited Module Tracking', desc: 'Track an unlimited number of training modules with expiry alerts, completion status, and digital records.' },
          { title: 'Role-Based Compliance Profiles', desc: 'Each role gets a profile of linked requirements. Staff auto-assigned based on their role. Role changes reflect instantly.' },
          { title: 'Scoring Integration', desc: 'Training completion rates feed the Effective domain score in your CQC readiness dashboard.' },
        ]
      },
      {
        id: 'surveys',
        category: 'Satisfaction & Engagement Surveys',
        icon: <ReadinessIcon sx={{ fontSize: 40 }} />,
        description: 'Email-invited surveys feeding CQC Caring and Well-led domains.',
        items: [
          { title: 'Satisfaction Surveys (Caring)', desc: 'Email invitations with unique tokens. Public form for people and families. Source tracked as Email or Manual.' },
          { title: 'Staff Engagement (Well-led)', desc: 'Customizable question templates with slider-based ratings. Send to specific roles. Anonymous or named.' },
          { title: 'Template Builder', desc: 'Create unlimited survey templates with per-question key. Stored in JSON for flexible analysis.' },
          { title: 'Dashboard & Analytics', desc: 'Aggregated scores, response counts, and average scores by question. All feeding into CQC domain scoring.' },
        ]
      },
      {
        id: 'room-checks',
        category: 'Room Checks',
        icon: <RoomChecksIcon sx={{ fontSize: 40 }} />,
        description: 'Digital room inspection records.',
        items: [
          { title: 'Digital Checklists', desc: 'Pre-built room inspection checklist covering cleanliness, safety, equipment, and environment.' },
          { title: 'Photo Evidence', desc: 'Attach photos to findings. Auto-stored in evidence packs for CQC inspections.' },
          { title: 'Issue Logging', desc: 'Flag issues with severity and auto-create follow-up tasks for resolution.' },
          { title: 'Recurring Schedules', desc: 'Daily, weekly, monthly room check schedules with automatic assignment to relevant staff.' },
        ]
      },
      {
        id: 'backup',
        category: 'Data Backup & Restore',
        icon: <BackupIcon sx={{ fontSize: 40 }} />,
        description: 'Secure, GDPR-compliant data protection with UK-based ISO 27001 hosting.',
        items: [
          { title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit (TLS 1.3). UK-based ISO 27001-certified data centres.' },
          { title: 'Automated Daily Backups', desc: 'Point-in-time recovery available. Full database snapshots every 24 hours with 30-day retention.' },
          { title: 'Role-Based Access', desc: 'Granular permissions per module (view/edit). ORG_ADMIN only can change roles. Full audit trail of access.' },
          { title: 'UK GDPR & DPA 2018', desc: 'ICO registered. UK data sovereignty. No data leaves UK jurisdiction.' },
        ]
      },
      {
        id: 'policies',
        category: 'Policy & Procedure Management',
        icon: <PolicyIcon sx={{ fontSize: 40 }} />,
        description: 'Upload, version-control and share team policies with PDF download and Share-to-Chat.',
        items: [
          { title: '12 Standard CQC Policies', desc: 'One-click seed: Risk Assessment, Complaints, Lone Working, GDPR, Whistleblowing, Infection Control, Equality & Diversity, MCA & DoLS, Fire Safety, Medication, Safeguarding Adults, Health & Safety.' },
          { title: 'Grid/List View', desc: 'Grid view shows category-coloured cards. List view shows full policy content with audit trail.' },
          { title: 'PDF Download', desc: 'Generate PDF via Blob with one click for printing or emailing to staff.' },
          { title: 'Share to Chat', desc: 'Send a policy preview directly into any chat channel for team acknowledgement.' },
        ]
      },
    ]
  }
]

export default function FeaturesPage() {
  const navigate = useNavigate()
  let sectionIndex = 0

  return (
    <MarketingLayout>
      {/* Page Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 3 }}>
              <RegulatorIcon sx={{ fontSize: 18, color: '#16A34A' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#16A34A', letterSpacing: 1, textTransform: 'uppercase' }}>
                All Four UK Regulators Supported
              </Typography>
            </Stack>
            <Typography variant="h2" sx={{ mb: 3, fontSize: { xs: '2rem', md: '2.8rem' } }}>
              Everything You Need to Run Your Service
            </Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '1.15rem', lineHeight: 1.7 }}>
              Meticle brings together care management, staff operations, and compliance reporting in one platform. Every feature is designed to produce inspection-ready evidence as a byproduct of daily work.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Feature Groups */}
      {featureGroups.map((group) => (
        <Box key={group.cat}>
          {/* Group Header */}
          <Box sx={{ py: { xs: 5, md: 7 }, bgcolor: 'white', borderBottom: '1px solid #E5E7EB' }}>
            <Container maxWidth="lg">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 6, height: 32, bgcolor: group.color, borderRadius: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: '1.6rem', md: '2.2rem' } }}>{group.cat}</Typography>
              </Stack>
            </Container>
          </Box>

          {/* Sections */}
          {group.sections.map((section) => {
            const idx = sectionIndex++
            return (
              <Box
                key={section.id}
                id={section.id}
                sx={{ py: { xs: 6, md: 9 }, bgcolor: idx % 2 === 0 ? 'white' : '#F8FAFC', borderBottom: '1px solid #E5E7EB', scrollMarginTop: 80 }}
              >
                <Container maxWidth="lg">
                  <Grid container spacing={6} alignItems="flex-start">
                    <Grid item xs={12} md={4}>
                      <Box sx={{ position: 'sticky', top: 100 }}>
                        <Box sx={{ width: 64, height: 64, bgcolor: `${group.color}15`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3, color: group.color }}>
                          {section.icon}
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          <Typography variant="h4" sx={{ fontWeight: 900, fontSize: '1.6rem' }}>{section.category}</Typography>
                          {section.tag && (
                            <Box sx={{ bgcolor: '#FEF3C7', color: '#D97706', px: 1.5, py: 0.3, borderRadius: 1, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {section.tag}
                            </Box>
                          )}
                        </Stack>
                        <Typography sx={{ color: '#6B7280', lineHeight: 1.7 }}>{section.description}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Stack spacing={3}>
                        {section.items.map((item, i) => (
                          <Paper key={i} elevation={0} sx={{ p: 3.5, border: '1px solid #E5E7EB', borderRadius: 3, '&:hover': { borderColor: group.color, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' } }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CheckIcon sx={{ fontSize: 20, color: group.color }} />
                              {item.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6B7280', lineHeight: 1.7, pl: 4 }}>{item.desc}</Typography>
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
      <Box sx={{ py: 12, bgcolor: '#0F4C81', textAlign: 'center', color: 'white' }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ mb: 3, fontWeight: 900 }}>Ready to See It in Action?</Typography>
          <Typography sx={{ mb: 6, opacity: 0.9, fontSize: '1.1rem' }}>Start your free trial or book a demo to see how Meticle transforms compliance across all four UK regulators.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ bgcolor: 'white', color: '#0F4C81', py: 2, px: 6, fontWeight: 800, '&:hover': { bgcolor: '#F8FAFC' } }}>
              Start Free Trial
            </Button>
            <Button variant="outlined" size="large" sx={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white', py: 2, px: 6, fontWeight: 700, '&:hover': { borderColor: 'white' } }}>
              Book a Demo
            </Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}