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
  const paraHtml = paragraphs.map((p) => `      <p>${p}</p>`).join('\n')
  const linkHtml = links.length
    ? `\n      <ul>${links.map((l) => `<li><a href="${SITE_URL}${l.href}">${l.label}</a></li>`).join('')}</ul>`
    : ''
  return `${navLinksHtml()}
    <main>
      <h1>${h1}</h1>
${paraHtml}${linkHtml}
    </main>${footerLinksHtml()}`
}

export const SEO_PAGES: SeoPage[] = [
  {
    path: '/',
    title: 'Supported Living Care Management Software | MeticleCare',
    description:
      'Care plans, daily notes, medication, staffing and compliance in one platform for UK supported living providers. 14-day free trial.',
    h1: 'Care operations, without the gaps',
    bodyHtml: wrapBody(
      'Care operations, without the gaps',
      [
        'MeticleCare is care management software for UK supported living providers. It brings care planning, medication administration (eMAR), daily care notes, staff rotas, incidents, training, and CQC compliance together in one connected platform.',
        'Built for CQC, CIW, Care Inspectorate Scotland, and RQIA frameworks, MeticleCare keeps every record connected — so managers can act on the same information their teams record at the point of care.',
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
    title: 'Care Management Software Features | MeticleCare',
    description:
      'eMAR, care notes, support plans, staff rotas, incidents, training matrix, compliance and audit — all in one UK care platform.',
    h1: 'Everything you need to run your service',
    bodyHtml: wrapBody(
      'Everything you need to run your service',
      [
        'MeticleCare brings together care management, staff operations, and compliance reporting in one platform. Every feature is designed so inspection-ready evidence is a byproduct of daily work — not a separate paper exercise.',
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
    title: 'How MeticleCare Works | Connected Care Operations',
    description:
      'See how MeticleCare connects care planning, staff rotas, medication records and compliance into one platform for UK care providers.',
    h1: 'See how MeticleCare works',
    bodyHtml: wrapBody(
      'See how MeticleCare works',
      [
        'MeticleCare connects every part of a care service — from the medication round to the compliance report — so that one action travels through the whole platform automatically.',
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
    title: 'Pricing | MeticleCare Care Management Software',
    description:
      'MeticleCare pricing for UK care providers. Three plans from £99/month — Essential, Care Service and Multi-Site. 14-day free trial.',
    h1: 'Simple pricing for UK care providers',
    bodyHtml: wrapBody(
      'Simple pricing for UK care providers',
      [
        'MeticleCare offers three plans: Essential at £99/month for sole traders and small services, Care Service at £299/month for established supported-living services, and Multi-Site with custom pricing for groups and franchises.',
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
    title: 'About MeticleCare | Built for UK Care Operators',
    description:
      'MeticleCare was built for UK supported living providers. Our team combines care-sector experience with technology to simplify operations.',
    h1: 'Built by care operators, for care operators',
    bodyHtml: wrapBody(
      'Built by care operators, for care operators',
      [
        'MeticleCare was founded by a team of care operators and software engineers who saw first-hand how fragmented tools were hurting care quality. Spreadsheets for rotas, WhatsApp for communication, paper for compliance — a unified platform was overdue.',
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
    title: 'Case Studies | MeticleCare UK Care Providers',
    description:
      'Read how UK supported living providers use MeticleCare to manage rotas, medication, care plans and compliance. Real stories.',
    h1: 'How UK care providers use MeticleCare',
    bodyHtml: wrapBody(
      'How UK care providers use MeticleCare',
      [
        'UK supported living providers use MeticleCare to manage rotas, medication administration, care plans, and compliance in one connected platform.',
        'Care services across England, Wales, Scotland, and Northern Ireland have reduced agency spend, improved compliance scores, and cut administrative time by bringing daily records, eMAR, and compliance into one system.',
        'Contact us to hear how providers like yours are using MeticleCare to stay inspection-ready and give their teams digital tools that work.',
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
    title: 'Contact MeticleCare | UK Care Management Platform',
    description:
      'Get in touch with the MeticleCare team. Ask about our care management platform for UK supported living providers.',
    h1: 'Talk to the MeticleCare team',
    bodyHtml: wrapBody(
      'Talk to the MeticleCare team',
      [
        'Whether you want a demo, a 30-minute scoping call, or have a question about how MeticleCare fits your care service, we are here to help.',
        'Our team runs a 30-minute scoping call so the trial fits your service, not a generic demo dataset. After onboarding, every account gets a named point of contact.',
        'MeticleCare is UK-based, care-operated, and serves providers across England, Wales, Scotland, and Northern Ireland. Start a 14-day free trial or book a call today.',
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
    title: 'Blog | MeticleCare Care Management Insights',
    description:
      'Insights on care management, compliance, rostering and digital care records for UK care providers. Read the MeticleCare blog.',
    h1: 'MeticleCare Blog',
    bodyHtml: wrapBody(
      'MeticleCare Blog',
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
    title: 'Learning Center | MeticleCare',
    description:
      'Learn how to use MeticleCare for care planning, staff management, medication records, compliance and daily operations. Guides and resources.',
    h1: 'MeticleCare Learning Center',
    bodyHtml: wrapBody(
      'MeticleCare Learning Center',
      [
        'Guides and resources for care providers using MeticleCare. Learn how to manage care plans, daily notes, medication records, staff rotas, compliance, and daily operations.',
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
    title: 'Privacy Policy | MeticleCare',
    description:
      'MeticleCare privacy policy. How we collect, use and protect personal data for UK care providers using our care management platform.',
    h1: 'Privacy Policy',
    bodyHtml: wrapBody(
      'Privacy Policy',
      [
        'MeticleCare is committed to protecting personal data in accordance with UK GDPR and the Data Protection Act 2018. This policy explains how we collect, use, and protect personal data for UK care providers using our care management platform.',
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
    title: 'Terms of Use | MeticleCare',
    description:
      'Terms and conditions for using MeticleCare, the care management platform for UK supported living providers.',
    h1: 'Terms of Use',
    bodyHtml: wrapBody(
      'Terms of Use',
      [
        'These terms and conditions govern the use of MeticleCare, the care management platform for UK supported living providers. By using the platform, you agree to these terms.',
        'MeticleCare is provided as a software-as-a-service subscription. All plans include a 14-day free trial with no credit card required. Subscriptions can be cancelled at any time.',
        'Users retain full ownership of their data. MeticleCare acts as a data processor and does not use customer data for any purpose other than providing the service.',
      ],
      [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'Home', href: '/' },
      ],
    ),
  },
  {
    path: '/cookies',
    title: 'Cookie Policy | MeticleCare',
    description:
      'How MeticleCare uses cookies. Our care management platform uses only essential cookies to keep your data secure and your experience reliable.',
    h1: 'Cookie Policy',
    bodyHtml: wrapBody(
      'Cookie Policy',
      [
        'MeticleCare uses only essential cookies required for the platform to function. We do not use tracking, advertising, or third-party analytics cookies.',
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
