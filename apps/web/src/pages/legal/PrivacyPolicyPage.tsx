import { Box, Container, Typography } from '@mui/material'

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
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Privacy Policy</Typography>
      <Typography variant="body2" color="#6B7280" sx={{ mb: 5 }}>Last updated: July 2026</Typography>

      <Section title="1. Information We Collect">
        <p>We collect information you provide directly, including:</p>
        <ul><li>Account information (name, email, password)</li><li>Organisation information (company name, address, staff details)</li><li>Service user information (names, care plans, medical details, daily notes)</li><li>Staff compliance data (training records, DBS checks, identity documents)</li><li>Payment information (processed securely through Stripe — we never store your full card details)</li><li>Usage data (pages visited, features used, error logs)</li></ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul><li>To provide, maintain, and improve CareDesk services</li><li>To process payments and manage subscriptions</li><li>To send service-related notifications</li><li>To generate compliance reports and evidence packs for regulatory inspections</li><li>To comply with legal obligations (UK GDPR, CQC requirements)</li><li>To detect and prevent fraud, abuse, and security incidents</li></ul>
        <p>We do not sell your data. We do not share your data with third parties except as necessary to provide the service.</p>
      </Section>

      <Section title="3. Legal Basis for Processing (UK GDPR)">
        <ul><li><strong>Contractual necessity</strong> — providing the CareDesk service</li><li><strong>Legal obligation</strong> — compliance with CQC regulations, UK employment law</li><li><strong>Legitimate interest</strong> — improving our service, preventing fraud</li><li><strong>Consent</strong> — where you've explicitly agreed (marketing, optional features)</li></ul>
      </Section>

      <Section title="4. Special Category Data">
        <p>CareDesk processes special category data (health information, DBS checks) as a data processor on behalf of care providers. Our customers are the data controllers. We rely on UK GDPR Article 9(2)(h) — processing necessary for health or social care.</p>
      </Section>

      <Section title="5. Data Storage and Security">
        <ul><li>All data stored in the United Kingdom on ISO 27001-certified infrastructure</li><li>Encrypted in transit (TLS 1.3) and at rest (AES-256)</li><li>Multi-tenant isolation ensures your data is never mixed with other organisations</li><li>JWT authentication with MFA support</li><li>All staff access to data is logged and auditable</li></ul>
      </Section>

      <Section title="6. Data Retention">
        <ul><li>Account data: active period + 90 days after cancellation</li><li>Service user records: minimum 8 years (CQC statutory guidance)</li><li>Financial records: 7 years (HMRC requirements)</li><li>Compliance records: 6 years (CQC requirements)</li><li>Audit trails: 2 years</li></ul>
      </Section>

      <Section title="7. Your Rights">
        <p>Under UK GDPR, you have the right to access, rectify, erase, restrict, port, and object to processing of your data. Contact privacy@caredesk.app to exercise any right. We respond within 30 days.</p>
      </Section>

      <Section title="8. Cookies">
        <p>We use essential cookies for authentication and session management only. No tracking or analytics cookies. See our Cookie Policy for details.</p>
      </Section>

      <Section title="9. Contact">
        <p>Data Protection Officer: dpo@caredesk.app<br/>Privacy concerns: privacy@caredesk.app<br/>ICO registered. Registration available on request.</p>
      </Section>
    </Container>
  )
}
