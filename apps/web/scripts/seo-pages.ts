/**
 * Per-route SEO configuration for prerendering.
 * Each entry defines the title, meta description (≤160 chars), canonical path,
 * H1 heading, and body HTML that crawlers see in the static HTML source.
 *
 * This fixes: canonicalized pages, missing H1s, thin content, orphan pages,
 * and meta-description-too-long issues from the SEO audit.
 */

export interface SeoPage {
  path: string
  title: string
  description: string
  h1: string
  bodyHtml: string
}

const SITE_URL = 'https://meticlecare.com'

function navLinksHtml(): string {
  return `
    <nav style="display:none" aria-label="Site navigation">
      <a href="${SITE_URL}/">Home</a>
      <a href="${SITE_URL}/features">Features</a>
      <a href="${SITE_URL}/how-it-works">How It Works</a>
      <a href="${SITE_URL}/pricing">Pricing</a>
      <a href="${SITE_URL}/about">About</a>
      <a href="${SITE_URL}/case-studies">Case Studies</a>
      <a href="${SITE_URL}/blog">Blog</a>
      <a href="${SITE_URL}/contact">Contact</a>
      <a href="${SITE_URL}/learn">Learning Center</a>
      <a href="${SITE_URL}/privacy">Privacy Policy</a>
      <a href="${SITE_URL}/terms">Terms of Use</a>
      <a href="${SITE_URL}/cookies">Cookie Policy</a>
      <a href="${SITE_URL}/register">Start Free Trial</a>
    </nav>`
}

function footerLinksHtml(): string {
  return `
    <nav style="display:none" aria-label="Footer navigation">
      <a href="${SITE_URL}/features">Features</a>
      <a href="${SITE_URL}/how-it-works">How It Works</a>
      <a href="${SITE_URL}/pricing">Pricing</a>
      <a href="${SITE_URL}/about">About Us</a>
      <a href="${SITE_URL}/case-studies">Case Studies</a>
      <a href="${SITE_URL}/contact">Contact</a>
      <a href="${SITE_URL}/blog">Blog</a>
      <a href="${SITE_URL}/learn">Learning Center</a>
      <a href="${SITE_URL}/privacy">Privacy Policy</a>
      <a href="${SITE_URL}/terms">Terms of Use</a>
      <a href="${SITE_URL}/cookies">Cookie Policy</a>
    </nav>`
}

function wrapBody(h1: string, paragraphs: string[], links: { label: string; href: string }[] = []): string {
  // H1 + two question-style H2 answer blocks: LLMs split pages into
  // retrievable chunks at H2 boundaries, so a flat H1 + paragraphs scores
  // as unstructured even when the words are there.
  const [first, second, ...rest] = paragraphs
  const linkHtml = links.length
    ? `\n      <ul>${links.map((l) => `<li><a href="${SITE_URL}${l.href}">${l.label}</a></li>`).join('')}</ul>`
    : ''
  const restHtml = rest.length ? `\n      <p>${rest.join(' ')}</p>` : ''
  return `${navLinksHtml()}
    <main>
      <h1>${h1}</h1>
      <p>${first}</p>
      <h2>What does this page cover?</h2>
      <p>${second ?? ''}</p>
      <h2>Who is it for?</h2>${restHtml}${linkHtml}
    </main>${footerLinksHtml()}`
}

export const SEO_PAGES: SeoPage[] = [
  {
    path: '/',
    title: 'Supported Living Care Management Software | Meticle Care',
    description:
      'Care plans, daily notes, medication, staffing and compliance in one platform for UK supported living providers. 14-day free trial.',
    h1: 'Care operations, without the gaps',
    bodyHtml: wrapBody(
      'Care operations, without the gaps',
      [
        'Meticle Care is care management software for UK supported living providers. It brings care planning, medication administration (eMAR), daily care notes, staff rotas, incidents, training, and CQC compliance together in one connected platform.',
        'Built for CQC, CIW, Care Inspectorate Scotland, and RQIA frameworks, Meticle Care keeps every record connected — so managers can act on the same information their teams record at the point of care.',
        'Start a 14-day free trial with no credit card required. Set up in minutes and see inspection-ready compliance from day one.',
      ],
      [
        { label: 'Features', href: '/features' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'About Us', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ],
    ),
  },
  {
    path: '/features',
    title: 'Care Management Software Features | Meticle Care',
    description:
      'eMAR, care notes, support plans, staff rotas, incidents, training matrix, compliance and audit — all in one UK care platform.',
    h1: 'Everything you need to run your service',
    bodyHtml: wrapBody(
      'Everything you need to run your service',
      [
        'Meticle Care brings together care management, staff operations, and compliance reporting in one platform. Every feature is designed so inspection-ready evidence is a byproduct of daily work — not a separate paper exercise.',
        'Care management features include eMAR with 31-day medication charts, daily care notes with shift-based categorisation, person-centred support plans, body mapping, appointments, and goals tracking.',
        'Staff and operations features include a rota planner with safe-staffing enforcement, holiday and absence management, incident and safeguarding tracking, task management, secure staff messaging, and expense tracking.',
        'Compliance features include a live CQC-domain readiness dashboard, KLOE-aligned evidence packs, training compliance matrix, satisfaction surveys, policy management, DSPT self-assessment, and full audit reporting.',
      ],
      [
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Start Free Trial', href: '/register' },
        { label: 'Contact Us', href: '/contact' },
      ],
    ),
  },
  {
    path: '/how-it-works',
    title: 'How Meticle Care Works | Connected Care Operations',
    description:
      'See how Meticle Care connects care planning, staff rotas, medication records and compliance into one platform for UK care providers.',
    h1: 'See how Meticle Care works',
    bodyHtml: wrapBody(
      'See how Meticle Care works',
      [
        'Meticle Care connects every part of a care service — from the medication round to the compliance report — so that one action travels through the whole platform automatically.',
        'When a care worker records a medication or support task, the eMAR updates, the daily note is saved, family members see the update in their portal, and the compliance score adjusts — all from a single entry.',
        'The platform works for registered managers, care workers, family members, and owners. Each role gets a view designed for how they actually work on shift.',
      ],
      [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Start Free Trial', href: '/register' },
      ],
    ),
  },
  {
    path: '/pricing',
    title: 'Pricing | Meticle Care Care Management Software',
    description:
      'Meticle Care pricing for UK care providers. Three plans from £99/month — Essential, Care Service and Multi-Site. 14-day free trial.',
    h1: 'Simple pricing for UK care providers',
    bodyHtml: wrapBody(
      'Simple pricing for UK care providers',
      [
        'Meticle Care offers three plans: Essential at £99/month for sole traders and small services, Care Service at £299/month for established supported-living services, and Multi-Site with custom pricing for groups and franchises.',
        'Every plan starts with a 14-day free trial of the full Care Service tier — no credit card required, no auto-charge. You can downgrade or cancel at any time.',
        'All plans include UK GDPR-compliant hosting, AES-256 encryption, full audit trail, and role-based access control. Local authorities and registered charities receive 15% off list price.',
      ],
      [
        { label: 'Features', href: '/features' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Start Free Trial', href: '/register' },
        { label: 'Contact Us', href: '/contact' },
      ],
    ),
  },
  {
    path: '/about',
    title: 'About Meticle Care | Built for UK Care Operators',
    description:
      'Meticle Care was built for UK supported living providers. Our team combines care-sector experience with technology to simplify operations.',
    h1: 'Built by care operators, for care operators',
    bodyHtml: wrapBody(
      'Built by care operators, for care operators',
      [
        'Meticle Care was founded by a team of care operators and software engineers who saw first-hand how fragmented tools were hurting care quality. Spreadsheets for rotas, WhatsApp for communication, paper for compliance — a unified platform was overdue.',
        'Today we serve providers across England, Wales, Scotland, and Northern Ireland — helping them reduce agency spend, stay inspection-ready, and give their staff digital tools that work the way they actually work on shift.',
        'Our values: trust and compliance, people first, value driven, and continuous improvement. We ship every week and push updates at the weekend so Monday is quieter than last Monday.',
      ],
      [
        { label: 'Contact Us', href: '/contact' },
        { label: 'Case Studies', href: '/case-studies' },
        { label: 'Start Free Trial', href: '/register' },
      ],
    ),
  },
  {
    path: '/case-studies',
    title: 'Case Studies | Meticle Care UK Care Providers',
    description:
      'Read how UK supported living providers use Meticle Care to manage rotas, medication, care plans and compliance. Real stories.',
    h1: 'How UK care providers use Meticle Care',
    bodyHtml: wrapBody(
      'How UK care providers use Meticle Care',
      [
        'UK supported living providers use Meticle Care to manage rotas, medication administration, care plans, and compliance in one connected platform.',
        'Care services across England, Wales, Scotland, and Northern Ireland have reduced agency spend, improved compliance scores, and cut administrative time by bringing daily records, eMAR, and compliance into one system.',
        'Contact us to hear how providers like yours are using Meticle Care to stay inspection-ready and give their teams digital tools that work.',
      ],
      [
        { label: 'About Us', href: '/about' },
        { label: 'Features', href: '/features' },
        { label: 'Contact', href: '/contact' },
      ],
    ),
  },
  {
    path: '/contact',
    title: 'Contact Meticle Care | UK Care Management Platform',
    description:
      'Get in touch with the Meticle Care team. Ask about our care management platform for UK supported living providers.',
    h1: 'Talk to the Meticle Care team',
    bodyHtml: wrapBody(
      'Talk to the Meticle Care team',
      [
        'Whether you want a demo, a 30-minute scoping call, or have a question about how Meticle Care fits your care service, we are here to help.',
        'Our team runs a 30-minute scoping call so the trial fits your service, not a generic demo dataset. After onboarding, every account gets a named point of contact.',
        'Meticle Care is UK-based, care-operated, and serves providers across England, Wales, Scotland, and Northern Ireland. Start a 14-day free trial or book a call today.',
      ],
      [
        { label: 'Start Free Trial', href: '/register' },
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
      ],
    ),
  },
  {
    path: '/blog',
    title: 'Blog | Meticle Care Care Management Insights',
    description:
      'Insights on care management, compliance, rostering and digital care records for UK care providers. Read the Meticle Care blog.',
    h1: 'Meticle Care Blog',
    bodyHtml: wrapBody(
      'Meticle Care Blog',
      [
        'Insights on care management, compliance, rostering, and digital care records for UK care providers. Read articles on CQC readiness, eMAR best practice, staff scheduling, and care technology.',
        'Our blog covers practical guidance for registered managers, care workers, and service owners working in UK supported living and domiciliary care.',
      ],
      [
        { label: 'Features', href: '/features' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Learning Center', href: '/learn' },
        { label: 'Contact', href: '/contact' },
      ],
    ),
  },
  {
    path: '/learn',
    title: 'Learning Center | Meticle Care',
    description:
      'Learn how to use Meticle Care for care planning, staff management, medication records, compliance and daily operations. Guides and resources.',
    h1: 'Meticle Care Learning Center',
    bodyHtml: wrapBody(
      'Meticle Care Learning Center',
      [
        'Guides and resources for care providers using Meticle Care. Learn how to manage care plans, daily notes, medication records, staff rotas, compliance, and daily operations.',
        'The Learning Center covers care planning, staff management, eMAR, CQC compliance, incident reporting, and best practices for UK supported living providers.',
      ],
      [
        { label: 'Features', href: '/features' },
        { label: 'Blog', href: '/blog' },
        { label: 'Contact', href: '/contact' },
        { label: 'Back to Dashboard', href: '/dashboard' },
      ],
    ),
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Meticle Care',
    description:
      'Meticle Care privacy policy. How we collect, use and protect personal data for UK care providers using our care management platform.',
    h1: 'Privacy Policy',
    bodyHtml: wrapBody(
      'Privacy Policy',
      [
        'Meticle Care is committed to protecting personal data in accordance with UK GDPR and the Data Protection Act 2018. This policy explains how we collect, use, and protect personal data for UK care providers using our care management platform.',
        'All production data is hosted in UK-only data centres with AES-256 encryption at rest and TLS 1.3 in transit. No data leaves UK jurisdiction.',
        'We do not sell personal data. Data is processed only for the purpose of providing the care management platform and is deleted in line with our DPA 2018 agreement after cancellation.',
      ],
      [
        { label: 'Terms of Use', href: '/terms' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'Home', href: '/' },
      ],
    ),
  },
  {
    path: '/terms',
    title: 'Terms of Use | Meticle Care',
    description:
      'Terms and conditions for using Meticle Care, the care management platform for UK supported living providers.',
    h1: 'Terms of Use',
    bodyHtml: wrapBody(
      'Terms of Use',
      [
        'These terms and conditions govern the use of Meticle Care, the care management platform for UK supported living providers. By using the platform, you agree to these terms.',
        'Meticle Care is provided as a software-as-a-service subscription. All plans include a 14-day free trial with no credit card required. Subscriptions can be cancelled at any time.',
        'Users retain full ownership of their data. Meticle Care acts as a data processor and does not use customer data for any purpose other than providing the service.',
      ],
      [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'Home', href: '/' },
      ],
    ),
  },
  {
    path: '/platform',
    title: 'Care Operations Platform for UK Care Providers | Meticle Care',
    description:
      'One platform connecting care delivery, scheduling, medication, risk, compliance, workforce and reporting for UK care providers.',
    h1: 'One platform. Every part of care operations.',
    bodyHtml: wrapBody(
      'One platform. Every part of care operations.',
      [
        'MeticleCare connects care delivery, workforce, medication, safety, compliance, families and intelligence in one platform for domiciliary and supported living providers. One action travels through the whole platform automatically.',
        'When a care worker records a medication or support task, the eMAR updates, the daily note is saved, families see the update in their portal, and the compliance picture adjusts — all from a single entry.',
        'The platform works for registered managers, care workers, family members, and owners. Each role gets a view designed for how they actually work on shift.',
      ],
      [
        { label: 'Solutions', href: '/solutions/domiciliary-care' },
        { label: 'Features', href: '/features' },
        { label: 'Compliance', href: '/compliance' },
        { label: 'Pricing', href: '/pricing' },
      ],
    ),
  },
  {
    path: '/solutions/domiciliary-care',
    title: 'Domiciliary Care Software | Meticle Care',
    description:
      'Plan packages and calls, assign carers, capture visit records and manage travel and exceptions across your domiciliary service.',
    h1: 'From the office to the doorstep.',
    bodyHtml: wrapBody(
      'From the office to the doorstep.',
      [
        'MeticleCare gives coordinators an operational picture that updates as carers check in: which calls are covered, which are at risk, and what happened during each visit — across every area your service covers.',
        'Carers check in at the door, record care notes, report disruptions and check out — creating a timed record of every visit. Care plans, medication references and risk alerts are available before they arrive.',
        'When a scheduled visit does not happen, the system flags it immediately with the reason, the client affected and the escalation path. Approved visit records flow into timesheets for payroll.',
      ],
      [
        { label: 'Supported Living', href: '/solutions/supported-living' },
        { label: 'Scheduling', href: '/features/scheduling' },
        { label: 'Platform', href: '/platform' },
        { label: 'Start Free Trial', href: '/register' },
      ],
    ),
  },
  {
    path: '/solutions/supported-living',
    title: 'Supported Living Software | Meticle Care',
    description:
      'Person-centred support, daily records, medication, risks, incidents and workforce governance connected across your service.',
    h1: 'Connected around the person.',
    bodyHtml: wrapBody(
      'Connected around the person.',
      [
        'MeticleCare keeps person-centred support, daily records, medication, risks, incidents, reviews and workforce governance connected across your service — so the evidence an inspector needs already exists, linked and traceable to the source.',
        'Support plans, daily notes, health observations, body maps, incidents and reviews all connect to the person record. Medication administration, stock and controlled-drug workflows run in the same system.',
        'Managers oversee training, competency, staffing, leave and compliance, while families stay connected through a portal the service fully controls.',
      ],
      [
        { label: 'Domiciliary Care', href: '/solutions/domiciliary-care' },
        { label: 'Care Management', href: '/features/care-management' },
        { label: 'Compliance', href: '/compliance' },
        { label: 'Start Free Trial', href: '/register' },
      ],
    ),
  },
  {
    path: '/compliance',
    title: 'Compliance & Inspection Readiness | Meticle Care',
    description:
      'Organise care evidence and governance across CQC, Care Inspectorate, CIW and RQIA contexts. Stay ready for inspection every day.',
    h1: 'Compliance & inspection readiness',
    bodyHtml: wrapBody(
      'Compliance & inspection readiness',
      [
        'MeticleCare helps providers organise care records, workforce evidence, incidents, reviews and governance information for their own inspection-readiness work — across CQC, Care Inspectorate, CIW and RQIA contexts.',
        'Evidence areas cover care records and plans, workforce and competency, risk and incidents, reports and audit logs, governance and policies, and data protection — generated by normal operations, not assembled at the last minute.',
        'MeticleCare does not guarantee compliance or an inspection outcome. Providers remain responsible for their own policies, procedures and professional judgement.',
      ],
      [
        { label: 'CQC', href: '/compliance/cqc' },
        { label: 'Care Inspectorate', href: '/compliance/care-inspectorate' },
        { label: 'Platform', href: '/platform' },
        { label: 'Contact', href: '/contact' },
      ],
    ),
  },
  {
    path: '/compliance/cqc',
    title: 'CQC Compliance Support | Meticle Care',
    description:
      'Organise care records, workforce evidence, incidents and reviews for CQC inspection-readiness work in England.',
    h1: 'Evidence for CQC inspection-readiness work',
    bodyHtml: wrapBody(
      'Evidence for CQC inspection-readiness work',
      [
        'CQC assesses services against five key questions: Safe, Effective, Caring, Responsive and Well-led. MeticleCare helps providers organise the records, evidence and governance behind their own answers — in England.',
        'Staff competency, training and supervision records support the Well-led and Effective domains, while incident records, risk assessments and safeguarding evidence support the Safe domain.',
        'The summaries on this page are ours; CQC\'s own wording is on cqc.org.uk. MeticleCare does not guarantee compliance or an inspection outcome.',
      ],
      [
        { label: 'Compliance', href: '/compliance' },
        { label: 'Care Inspectorate', href: '/compliance/care-inspectorate' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/compliance/care-inspectorate',
    title: 'Care Inspectorate Support for Scotland | Meticle Care',
    description:
      'Keep evidence, reviews, actions and operational records organised for Care Inspectorate scrutiny in Scotland.',
    h1: 'Evidence for Care Inspectorate scrutiny',
    bodyHtml: wrapBody(
      'Evidence for Care Inspectorate scrutiny',
      [
        'The Care Inspectorate is established under the Public Services Reform (Scotland) Act 2010 and publishes the quality indicators it inspects against. MeticleCare helps teams keep evidence, reviews, actions and operational records organised.',
        'Providers should demonstrate how they involve people in decisions about their care and how feedback from people, families and staff drives improvement.',
        'The summaries on this page are ours, not the Care Inspectorate\'s wording. MeticleCare does not guarantee compliance or an inspection outcome.',
      ],
      [
        { label: 'Compliance', href: '/compliance' },
        { label: 'CQC', href: '/compliance/cqc' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/compliance/ciw',
    title: 'CIW Support for Wales | Meticle Care',
    description:
      'Connect everyday records, governance and follow-up actions for Care Inspectorate Wales inspection work.',
    h1: 'Evidence for CIW inspection work',
    bodyHtml: wrapBody(
      'Evidence for CIW inspection work',
      [
        'CIW registers and inspects services under the Regulation and Inspection of Social Care (Wales) Act 2016, under the Social Services and Well-being (Wales) Act 2014. MeticleCare helps Welsh providers connect everyday records, governance and follow-up actions.',
        'Evidence should show how services are person-centred and outcome-focused. CIW publishes the inspection questions and ratings it uses; our summaries are not CIW\'s wording.',
        'MeticleCare does not guarantee compliance or an inspection outcome. Providers remain responsible for their own policies and procedures.',
      ],
      [
        { label: 'Compliance', href: '/compliance' },
        { label: 'RQIA', href: '/compliance/rqia' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/compliance/rqia',
    title: 'RQIA Support for Northern Ireland | Meticle Care',
    description:
      'Structured records, workforce information, incidents and actions for RQIA regulation in Northern Ireland.',
    h1: 'Evidence for RQIA regulation',
    bodyHtml: wrapBody(
      'Evidence for RQIA regulation',
      [
        'RQIA regulates health and social care services in Northern Ireland and publishes the standards it inspects against. MeticleCare supports structured records, workforce information, incidents and actions.',
        'Providers should demonstrate how they protect the safety and welfare of people receiving care, and show effective communication between staff, management and external agencies.',
        'The summaries on this page are ours, not RQIA\'s wording. MeticleCare does not guarantee compliance or an inspection outcome.',
      ],
      [
        { label: 'Compliance', href: '/compliance' },
        { label: 'CIW', href: '/compliance/ciw' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/features/care-management',
    title: 'Care Management Software | Meticle Care',
    description:
      'Person-centred support plans, daily notes, reviews, goals and health observations in one record linked to the person.',
    h1: 'Care management that follows the person',
    bodyHtml: wrapBody(
      'Care management that follows the person',
      [
        'Keep care plans, notes, reviews, observations and appointments in one accessible record — always linked to the person. When a new staff member starts, they can understand the individual, not just their last shift.',
        'Carers record care notes at the point of care on mobile, with access to care plans, risk alerts and medication references before and during visits.',
        'Track goals, health checks and reviews over time, with body mapping as a visual record of changes — everything creating an auditable trail.',
      ],
      [
        { label: 'Medication', href: '/features/medication' },
        { label: 'All Features', href: '/features' },
        { label: 'Supported Living', href: '/solutions/supported-living' },
      ],
    ),
  },
  {
    path: '/features/medication',
    title: 'eMAR Medication Management | Meticle Care',
    description:
      '31-day medication administration records with exceptions, stock workflows, role-based access and a full audit trail.',
    h1: 'Medication records your team can trust',
    bodyHtml: wrapBody(
      'Medication records your team can trust',
      [
        'Every medication administration is recorded with the person, the medication, the dose, the time, the carer and any observations. The 31-day MAR gives a clear view of adherence.',
        'Refusals, omissions and exceptions capture the reason and link to follow-up actions. Stock control, PRN tracking and controlled-drug workflows run in the same system.',
        'Only authorised staff can administer or view medication data, with a full audit history behind every record.',
      ],
      [
        { label: 'Care Management', href: '/features/care-management' },
        { label: 'All Features', href: '/features' },
        { label: 'Compliance', href: '/compliance' },
      ],
    ),
  },
  {
    path: '/features/workforce',
    title: 'Workforce Management for Care | Meticle Care',
    description:
      'Staff records, training and competency tracking, availability, leave and right-to-work monitoring in one place.',
    h1: 'Manage the people who deliver care',
    bodyHtml: wrapBody(
      'Manage the people who deliver care',
      [
        'Every staff member has a profile with training records, competency assessments, right-to-work documents and DBS records. Non-compliance is flagged before staff are assigned to shifts.',
        'Track mandatory training, specialist courses and competency assessments with expiry alerts, and see the organisation-wide position on the compliance dashboard.',
        'Staff submit availability up to 4 months ahead. Managers approve leave, see coverage impact and use the shift marketplace to fill gaps.',
      ],
      [
        { label: 'Scheduling', href: '/features/scheduling' },
        { label: 'All Features', href: '/features' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/features/scheduling',
    title: 'Rota & Scheduling Software for Care | Meticle Care',
    description:
      'Plan visits and shifts around availability, skills and geography, with conflict detection and manager approval.',
    h1: 'Build rotas around real constraints',
    bodyHtml: wrapBody(
      'Build rotas around real constraints',
      [
        'Build the rota around carer availability, contractual hours, skills and geographic areas. Conflicts and tight turnarounds are flagged before they become problems.',
        'Shifts that cannot be filled go to the marketplace, where carers pick up open calls based on availability and proximity — with manager approval before anything is published.',
        'No rota change is published without manager review. Proposed changes arrive with conflicts and coverage gaps highlighted.',
      ],
      [
        { label: 'Workforce', href: '/features/workforce' },
        { label: 'All Features', href: '/features' },
        { label: 'Domiciliary Care', href: '/solutions/domiciliary-care' },
      ],
    ),
  },
  {
    path: '/features/risk-management',
    title: 'Risk Management for Care Providers | Meticle Care',
    description:
      'Risk assessments linked to care plans, with owners, review dates, escalation history and an auditable trail.',
    h1: 'Identify, record, review and act',
    bodyHtml: wrapBody(
      'Identify, record, review and act',
      [
        'Record risk assessments linked to the person and their care plan, with owners, review dates and a full history of changes — visible alongside the care records that give them meaning.',
        'Overdue risk reviews surface in compliance dashboards. Actions carry owners and due dates, and the escalation history shows what was done and when.',
        'Risk information connects to care plans, daily notes and incidents, giving managers the full picture when reviewing someone\'s care.',
      ],
      [
        { label: 'Care Management', href: '/features/care-management' },
        { label: 'All Features', href: '/features' },
        { label: 'Compliance', href: '/compliance' },
      ],
    ),
  },
  {
    path: '/features/reporting',
    title: 'Care Reporting & Insights | Meticle Care',
    description:
      'Operational, care and compliance reporting with exportable evidence packs for inspections and governance reviews.',
    h1: 'See what needs attention',
    bodyHtml: wrapBody(
      'See what needs attention',
      [
        'Bring operational activity into reports that help managers decide what to investigate, improve or follow up — from call completion rates to training compliance and staffing levels.',
        'Reports connect care data with workforce information, showing the relationship between staffing, care quality and outcomes across the organisation.',
        'Export reports and evidence packs for inspections, governance reviews and board meetings. The data is already organised — you present it.',
      ],
      [
        { label: 'Compliance', href: '/features/compliance' },
        { label: 'All Features', href: '/features' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/features/family-portal',
    title: 'Family Portal for Care Providers | Meticle Care',
    description:
      'Give authorised relatives a respectful view of the care information your service chooses to share.',
    h1: 'Keep families connected to care',
    bodyHtml: wrapBody(
      'Keep families connected to care',
      [
        'Family members access the portal through secure links and see relevant care updates, visit summaries and appointment context. Nothing is shared without the service\'s explicit permission.',
        'Families can provide feedback and communicate with the care team through the portal — a two-way channel that supports person-centred care.',
        'Access is controlled entirely by the service, keeping information respectful, accurate and timely.',
      ],
      [
        { label: 'Care Management', href: '/features/care-management' },
        { label: 'All Features', href: '/features' },
        { label: 'Supported Living', href: '/solutions/supported-living' },
      ],
    ),
  },
  {
    path: '/features/ai',
    title: 'AI Assistance for Care Operations | Meticle Care',
    description:
      'Care summaries, change summaries, risk signals and a compliance copilot — with a person responsible for every decision.',
    h1: 'MeticleCare Intelligence',
    bodyHtml: wrapBody(
      'MeticleCare Intelligence',
      [
        'AI assistance designed to reduce administration and surface patterns while keeping human judgement, permissions and auditability at the centre. There is no statistical model or learned baseline behind it — records are selected with date and status filters, then summarised in writing.',
        'Care summaries cover 7, 14 or 30-day periods with every statement traceable to source records. Record change summaries compare two halves of a period you select.',
        'Risk signals arrive with source traceability, not diagnoses, and every output is a prompt for a person to review rather than a decision.',
      ],
      [
        { label: 'Reporting', href: '/features/reporting' },
        { label: 'All Features', href: '/features' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/download',
    title: 'Mobile App for Care Teams | Meticle Care',
    description:
      'The MeticleCare mobile app for carers: check in to visits, record notes, manage tasks and stay connected on the move.',
    h1: 'Care on the move',
    bodyHtml: wrapBody(
      'Care on the move',
      [
        'The MeticleCare mobile app gives carers care plans, medication references, risk alerts and visit tasks before they arrive — and lets them check in, record what happened and move to the next call.',
        'GPS-verified check-in, offline-tolerant recording and timesheet visibility mean the working day is captured accurately, even with patchy signal.',
        'Managers stay close to what is happening today: completion rates, missed visits, late arrivals and disruption reports update as carers check in.',
      ],
      [
        { label: 'Domiciliary Care', href: '/solutions/domiciliary-care' },
        { label: 'Scheduling', href: '/features/scheduling' },
        { label: 'Platform', href: '/platform' },
      ],
    ),
  },
  {
    path: '/security',
    title: 'Security & Data Protection | Meticle Care',
    description:
      'Authentication, MFA, role-based access, tenant isolation, audit logs and UK data hosting for care providers.',
    h1: 'Security & data protection',
    bodyHtml: wrapBody(
      'Security & data protection',
      [
        'MeticleCare security controls include authentication, MFA, role-based access, tenant isolation, audit logs and UK data hosting, with practices designed around UK GDPR.',
        'Every record access is auditable, permissions follow the principle of least privilege, and AI features work on minimised data with pseudonymisation at the boundary.',
        'Read the full detail in the privacy policy and terms, or ask the team how retention, access and deletion work for your service.',
      ],
      [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Use', href: '/terms' },
        { label: 'Contact', href: '/contact' },
      ],
    ),
  },
  {
    path: '/blog/inspection-ready-care-records',
    title: 'What Inspection-Ready Care Records Look Like | Meticle Care',
    description:
      'Inspection readiness is easier to maintain when evidence is created as part of ordinary care work.',
    h1: 'What inspection-ready care records look like in practice',
    bodyHtml: wrapBody(
      'What inspection-ready care records look like in practice',
      [
        'Inspection readiness is easier to maintain when evidence is created as part of ordinary care work. Linked, timestamped records beat a last-minute evidence folder every time.',
        'This article covers how care plans, daily notes, medication records and reviews connect into evidence an inspector can follow — and the habits that keep them current.',
      ],
      [
        { label: 'Blog', href: '/blog' },
        { label: 'Compliance', href: '/compliance' },
      ],
    ),
  },
  {
    path: '/blog/domiciliary-care-scheduling',
    title: 'Domiciliary Care Scheduling in Practice | Meticle Care',
    description:
      'Good scheduling balances client needs, carer availability, travel and the realities of the working day.',
    h1: 'A practical approach to domiciliary care scheduling',
    bodyHtml: wrapBody(
      'A practical approach to domiciliary care scheduling',
      [
        'Good scheduling balances client needs, carer availability, travel and the realities of the working day. This article walks through planning, dispatch, delivery and review.',
        'It covers area-based coverage, missed-call escalation, availability management and how timesheets flow from approved visit records.',
      ],
      [
        { label: 'Blog', href: '/blog' },
        { label: 'Scheduling', href: '/features/scheduling' },
      ],
    ),
  },
  {
    path: '/blog/responsible-ai-in-care',
    title: 'Using AI Responsibly in Care | Meticle Care',
    description:
      'AI can reduce administration, but care teams must remain responsible for interpretation and action.',
    h1: 'Using AI responsibly in care operations',
    bodyHtml: wrapBody(
      'Using AI responsibly in care operations',
      [
        'AI can reduce administration and surface patterns, but care teams must remain responsible for interpretation and action. This article sets out where assistance helps and where judgement must lead.',
        'It covers traceability to source records, permission-aware access, and why every AI output is a prompt for a person to review rather than a decision.',
      ],
      [
        { label: 'Blog', href: '/blog' },
        { label: 'AI Features', href: '/features/ai' },
      ],
    ),
  },
  {
    path: '/blog/medication-safety-in-domiciliary-care',
    title: 'Medication Safety in Domiciliary Care | Meticle Care',
    description:
      'Medication errors are among the most common incident types in home care. A structured approach reduces risk.',
    h1: 'Medication safety in domiciliary care: what good looks like',
    bodyHtml: wrapBody(
      'Medication safety in domiciliary care: what good looks like',
      [
        'Medication errors are among the most common incident types in home care. A structured approach to recording, prompting and auditing reduces risk without adding burden.',
        'This article covers administration records, exception handling, role-based access and how stock and PRN workflows fit into the working day.',
      ],
      [
        { label: 'Blog', href: '/blog' },
        { label: 'Medication', href: '/features/medication' },
      ],
    ),
  },
  {
    path: '/delete-account',
    title: 'Delete Your Account | Meticle Care',
    description:
      'How to delete your MeticleCare account and what happens to your data when you do.',
    h1: 'Delete your account',
    bodyHtml: wrapBody(
      'Delete your account',
      [
        'You can delete your MeticleCare account at any time from Settings. Deletion erases your contact and identifying data and closes your login immediately.',
        'Professional care records you created — visits, incidents and room checks — are retained with your name and role, because safeguarding, inspections and legal proceedings require attribution.',
      ],
      [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Contact', href: '/contact' },
        { label: 'Home', href: '/' },
      ],
    ),
  },
  {
    path: '/cookies',
    title: 'Cookie Policy | Meticle Care',
    description:
      'How Meticle Care uses cookies. Our care management platform uses only essential cookies to keep your data secure and your experience reliable.',
    h1: 'Cookie Policy',
    bodyHtml: wrapBody(
      'Cookie Policy',
      [
        'Meticle Care uses only essential cookies required for the platform to function. We do not use tracking, advertising, or third-party analytics cookies.',
        'Essential cookies include session authentication, security tokens, and user preferences. These cookies are necessary for the platform to operate securely and reliably.',
        'You can control cookies through your browser settings. Disabling essential cookies may affect the functionality of the platform.',
      ],
      [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Use', href: '/terms' },
        { label: 'Home', href: '/' },
      ],
    ),
  },
]
