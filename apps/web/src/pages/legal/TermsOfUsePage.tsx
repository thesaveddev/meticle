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

export default function TermsOfUsePage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Terms of Use</Typography>
      <Typography variant="body2" color="#6B7280" sx={{ mb: 5 }}>Last updated: July 2026</Typography>

      <Section title="1. Agreement">
        <p>By accessing or using Meticle ("the Service"), you agree to be bound by these Terms of Use. If you are using the Service on behalf of an organisation, you represent that you have authority to bind that organisation.</p>
      </Section>

      <Section title="2. Definitions">
        <ul><li><strong>"We", "Us", "Meticle"</strong> — the Service provider</li><li><strong>"You", "Customer"</strong> — the organisation or individual using the Service</li><li><strong>"Service User"</strong> — a resident or client receiving care, whose data is stored in the Service</li><li><strong>"Staff"</strong> — employees or contractors of the Customer who access the Service</li></ul>
      </Section>

      <Section title="3. Your Account">
        <p>You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorised access. Each user must have a unique email address — shared accounts are not permitted. You must ensure all staff use their own login credentials.</p>
      </Section>

      <Section title="4. Acceptable Use">
        <p>You agree not to:</p>
        <ul><li>Upload or store illegal content</li><li>Use the Service to harass, abuse, or harm others</li><li>Attempt to gain unauthorised access to other organisations' data</li><li>Reverse engineer, decompile, or extract the source code</li><li>Use the Service in violation of applicable laws (UK GDPR, CQC regulations, employment law)</li><li>Exceed reasonable usage limits that degrade service for other customers</li></ul>
      </Section>

      <Section title="5. Data Processing">
        <p>You are the data controller for all personal data you upload to Meticle. We act as a data processor. This relationship is governed by our Data Processing Agreement, incorporated by reference into these Terms. You are responsible for:</p>
        <ul><li>Obtaining necessary consents from staff and service users</li><li>Ensuring data is accurate and up to date</li><li>Complying with Subject Access Requests from your staff and service users</li><li>Notifying us of any data breaches involving Service data</li></ul>
      </Section>

      <Section title="6. Payment and Subscription">
        <ul><li>Fees are billed monthly in advance via Stripe</li><li>All prices are in GBP and exclude VAT</li><li>You may upgrade or downgrade your plan at any time. Changes take effect at the start of the next billing period</li><li>Cancellation: you may cancel at any time. Access continues until the end of the current billing period. No refunds for partial months</li><li>We reserve the right to change pricing with 30 days' notice</li></ul>
      </Section>

      <Section title="7. Service Availability">
        <p>We aim for 99.9% uptime but do not guarantee uninterrupted service. We will notify you of planned maintenance at least 48 hours in advance. We are not liable for downtime caused by factors outside our control (internet outages, third-party services, force majeure).</p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>Meticle is a compliance support tool, not a substitute for professional legal or regulatory advice. We are not liable for CQC inspection outcomes, regulatory fines, or penalties. Our total liability is limited to the fees paid by you in the 12 months preceding the claim. We are not liable for indirect, consequential, or special damages.</p>
      </Section>

      <Section title="9. Intellectual Property">
        <p>Meticle and all associated code, design, and documentation are protected by copyright and intellectual property laws. You retain ownership of all data you upload. We retain ownership of the Service, its code, and its algorithms.</p>
      </Section>

      <Section title="10. Termination">
        <p>We may suspend or terminate your account for violation of these Terms. You may terminate at any time by cancelling your subscription. Upon termination, we will delete your data within 90 days, except where retention is required by law.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
      </Section>

      <Section title="12. Changes">
        <p>We will notify you of material changes to these Terms at least 30 days before they take effect via email and in-app notification. Continued use after changes constitutes acceptance.</p>
      </Section>

      <Section title="13. Contact">
        <p>Legal enquiries: legal@meticlecare.com<br/>General enquiries: hello@meticlecare.com</p>
      </Section>
    </Container>
  )
}
