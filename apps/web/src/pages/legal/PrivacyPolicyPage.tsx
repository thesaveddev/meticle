import { Box, Container, Typography } from '@mui/material'
import PageMeta from '../../components/PageMeta'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81', mb: 2 }}>{title}</Typography>
      <Typography component="div" variant="body2" color="#374151" sx={{ lineHeight: 1.8, '& p': { mb: 1.5 } }}>
        {children}
      </Typography>
    </Box>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageMeta title="Privacy Policy | Meticle Care" description="Meticle Care privacy policy. How we collect, use and protect personal data for UK care providers using our care management platform." canonicalPath="/privacy" />
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Privacy Policy</Typography>
      <Typography variant="body2" color="#6B7280" sx={{ mb: 5 }}>Last updated: August 2026</Typography>

      <Section title="About the Company">
        <p>MeticleCare is a product operated by <strong>34Orients Ltd</strong>, company number <strong>17446318</strong>. Our registered office is 3 Dan-Y-Coedcae Road, Pontypridd, United Kingdom, CF37 1LS.</p>
      </Section>

      <Section title="1. Information We Collect">
        <p>We collect information you provide directly, including:</p>
        <ul><li>Account information (name, email, password)</li><li>Organisation information (company name, address, staff details)</li><li>Person information (names, care plans, medical details, daily notes)</li><li>Staff compliance data (training records, DBS checks, identity documents)</li><li>Payment information (processed securely through Stripe — we never store your full card details)</li><li>Usage data (pages visited, features used, error logs)</li></ul>
        <p><strong>Staff location data.</strong> Where a care provider uses the visit check-in map, the app records the position of the worker at the moment they check in and check out of a call, together with the time and the accuracy of the reading. This is location data about an identifiable worker, collected on the care provider's instructions, and it is a category this policy previously failed to list at all. How long it is kept is set by the care provider, not by us, and each care provider can switch the collection off entirely in the product. Workers are shown what is collected and what their employer can see, in the app itself, before they use it. We do not use it for advertising or profiling, and it is never sent to an AI provider.</p>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul><li>To provide, maintain, and improve Meticle Care services</li><li>To process payments and manage subscriptions</li><li>To send service-related notifications</li><li>To generate compliance reports and evidence packs for regulatory inspections</li><li>To comply with legal obligations (UK GDPR, CQC requirements)</li><li>To detect and prevent fraud, abuse, and security incidents</li></ul>
        <p>We do not sell your data. We do not share your data with third parties except as necessary to provide the service. On the public website, we record only privacy-safe conversion events such as a demo request being submitted; we do not use advertising trackers or build behavioural profiles.</p>
      </Section>

      <Section title="3. Legal Basis for Processing (UK GDPR)">
        <ul><li><strong>Contractual necessity</strong> — providing the Meticle Care service</li><li><strong>Legal obligation</strong> — compliance with CQC regulations, UK employment law</li><li><strong>Legitimate interest</strong> — improving our service, preventing fraud</li><li><strong>Consent</strong> — where you've explicitly agreed (marketing, optional features)</li></ul>
      </Section>

      <Section title="4. Special Category Data">
        <p>Meticle Care processes special category data (health information, DBS checks) as a data processor on behalf of care providers. Our customers are the data controllers. We rely on UK GDPR Article 9(2)(h) — processing necessary for health or social care.</p>
      </Section>

      <Section title="4a. Artificial Intelligence Features">
        <p><strong>Off by default, and off for every customer unless they turn it on.</strong> Each organisation's AI configuration starts disabled, with no capability enabled. Nothing described below happens to any care provider who has not explicitly enabled it.</p>
        <p><strong>When a care provider does enable AI</strong>, we send some of their records to a third-party model provider (OpenAI or Anthropic) to generate a briefing or draft. <strong>What is sent is pseudonymised, not raw.</strong> Before anything leaves our servers we replace people's names with a stable code, and remove email addresses, telephone numbers, postcodes, dates of birth and long reference numbers. "Margaret Whitfield" becomes "Client 4F2A" and stays "Client 4F2A" across the records in one request, so the output is still coherent.</p>
        <p><strong>What this does not achieve, stated plainly:</strong> pseudonymised data is still personal data under the UK GDPR. The clinical substance of a record remains, and anyone who also has the care record can re-identify it. We do not describe this as anonymisation and it should not be read as making the data non-personal. The care provider remains the controller for this processing and is the party that has to satisfy themselves it is lawful for their service.</p>
        <p><strong>Retention at the provider.</strong> We send <code>store: false</code> with every request, which opts out of the model provider's own abuse-monitoring retention of request and response payloads.</p>
        <p><strong>Not sent at all:</strong> staff location or GPS coordinates, and any record containing them. The AI features do not read the check-in map.</p>
      </Section>

      <Section title="5. Data Storage and Security">
        <ul><li>Records are stored in the United Kingdom. Where a care provider switches the AI features on, parts of a record are processed by our AI provider outside the UK</li><li>Encrypted in transit (TLS 1.3)</li><li>NHS numbers, dates of birth, addresses and telephone numbers held on a person's record or on a staff member's own profile, and the telephone number and email address of a named contact such as a family member or next of kin, are encrypted in the database (AES-256-GCM) under a key derived per organisation, so they cannot be read from the database without that organisation's own key</li><li>Care records held in narrative form — a care worker's written notes, incident and investigation records, and risk assessments — are not currently encrypted by the application and rely on the encryption provided by our hosting provider. We consider this a significant gap and it is being addressed</li><li>Tenant isolation enforced in the database itself, so your data is never mixed with another organisation's</li><li>JWT authentication with multi-factor authentication</li><li>Every staff access to a record is logged and auditable</li></ul>
      </Section>

      <Section title="6. Data Retention">
        <ul><li>Account data: active period + 90 days after cancellation</li><li>Person records: minimum 8 years (CQC statutory guidance)</li><li>Financial records: 7 years (HMRC requirements)</li><li>Compliance records: 6 years (CQC requirements)</li><li>Audit trails: 2 years</li></ul>
      </Section>

      <Section title="7. Your Rights">
        <p>Under UK GDPR, you have the right to access, rectify, erase, restrict, port, and object to processing of your data. Contact privacy@meticlecare.com to exercise any right. We respond within 30 days.</p>
      </Section>

      <Section title="8. Cookies">
        <p>We use essential cookies for authentication and session management only. Conversion events are recorded server-side and are not stored in tracking cookies. See our Cookie Policy for details.</p>
      </Section>

      <Section title="9. Contact">
        <p>Data Protection Officer: Adetoye (dpo@meticlecare.com)<br/>Privacy concerns: privacy@meticlecare.com<br/>34Orients Ltd, company number 17446318<br/>3 Dan-Y-Coedcae Road, Pontypridd, United Kingdom, CF37 1LS</p>
      </Section>
    </Container>
    </>
  )
}
