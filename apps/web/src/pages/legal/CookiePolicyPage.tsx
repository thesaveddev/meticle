import { Container, Typography, Box } from '@mui/material'

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81', mb: 2 }}>{title}</Typography>
      <Typography component="div" variant="body2" color="#374151" sx={{ lineHeight: 1.8 }}>{children}</Typography>
    </Box>
  )
}

export default function CookiePolicyPage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Cookie Policy</Typography>
      <Typography variant="body2" color="#6B7280" sx={{ mb: 5 }}>Last updated: July 2026</Typography>

      <S title="1. What Are Cookies">
        <p>Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and authenticate your session.</p>
      </S>

      <S title="2. Cookies We Use">
        <p>CareDesk uses only <strong>essential cookies</strong>:</p>
        <ul>
          <li><strong>Authentication token</strong> — stored in your browser to keep you logged in. Required for the Service to function.</li>
          <li><strong>CSRF token</strong> — prevents cross-site request forgery attacks.</li>
          <li><strong>Session preference</strong> — remembers your selected organisation and role.</li>
        </ul>
        <p>We do not use:</p>
        <ul>
          <li>Tracking cookies</li>
          <li>Advertising cookies</li>
          <li>Third-party analytics cookies (Google Analytics, Facebook Pixel, etc.)</li>
          <li>Social media cookies</li>
        </ul>
      </S>

      <S title="3. Third-Party Services">
        <p><strong>Stripe</strong> — our payment processor. Stripe may set its own essential cookies during the payment process. See Stripe's cookie policy for details.</p>
      </S>

      <S title="4. Managing Cookies">
        <p>Most browsers allow you to block or delete cookies. However, CareDesk requires essential cookies to function — blocking them will prevent you from logging in.</p>
      </S>

      <S title="5. Changes">
        <p>We will update this policy if our cookie usage changes. Material changes will be notified via in-app notification.</p>
      </S>
    </Container>
  )
}
