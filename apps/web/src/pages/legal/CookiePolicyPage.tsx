import { Container, Typography, Box } from '@mui/material'
import PageMeta from '../../components/PageMeta'

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, color: '#0164C8', mb: 2 }}>{title}</Typography>
      <Typography component="div" variant="body2" color="#3A4551" sx={{ lineHeight: 1.8 }}>{children}</Typography>
    </Box>
  )
}

export default function CookiePolicyPage() {
  return (
    <>
      <PageMeta title="Cookie Policy | Meticle Care" description="How Meticle Care uses cookies. Our care management platform sets two essential cookies and no tracking, advertising or analytics cookies." canonicalPath="/cookies" />
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 600, color: '#0164C8', mb: 1 }}>Cookie Policy</Typography>
      <Typography variant="body2" color="#51637A" sx={{ mb: 5 }}>Last updated: October 2026</Typography>

      <S title="About the Company">
        <p>MeticleCare is a product operated by <strong>34Orients Ltd</strong>, company number <strong>17446318</strong>. Our registered office is 3 Dan-Y-Coedcae Road, Pontypridd, United Kingdom, CF37 1LS.</p>
      </S>

      <S title="1. What Are Cookies">
        <p>Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and authenticate your session.</p>
      </S>

      <S title="2. Cookies We Use">
        <p>
          Meticle Care sets exactly two cookies. Both are <strong>essential</strong>, first-party and set by our own
          API — they are the only cookies we place on your device.
        </p>
        <ul>
          <li>
            <strong>accessToken</strong> — identifies your signed-in session. Expires after <strong>15 minutes</strong>.
          </li>
          <li>
            <strong>refreshToken</strong> — lets the session be renewed without asking for your password again.
            Expires after <strong>7 days</strong>.
          </li>
        </ul>
        <p>
          Both are marked <strong>HttpOnly</strong> (no script on the page can read them), <strong>Secure</strong> (sent
          only over HTTPS) and <strong>SameSite=Lax</strong> (not sent on requests started by another site). Lax
          SameSite is what protects the session from cross-site request forgery: an attacker's page cannot make your
          browser send these cookies. We do not issue a separate CSRF token cookie, because there is no CSRF token to
          issue — the browser session is authenticated by these two SameSite cookies, and the API's other credential,
          the bearer token our mobile app sends, is one a cross-site form cannot set either.
        </p>
        <p>
          <strong>Preferences are not cookies.</strong> The identity this browser remembers — your name, email,
          organisation and role — plus your appearance settings (theme, branding, zoom) and your collapsed menu
          groups are stored in your browser's <strong>local storage</strong>. Your session itself is not: it is the
          <strong>accessToken</strong> and <strong>refreshToken</strong> cookies above, which no script on the page can read. Local storage is not sent to us with every request and cannot
          be read by another site; it is covered by our Privacy Policy, and clearing your browser's site data removes
          it and signs you out.
        </p>
        <p>We do not use:</p>
        <ul>
          <li>Tracking cookies</li>
          <li>Advertising cookies</li>
          <li>Third-party analytics cookies (Google Analytics, Facebook Pixel, etc.); conversion events are recorded server-side without tracking cookies</li>
          <li>Social media cookies</li>
        </ul>
      </S>

      <S title="3. Third-Party Services">
        <p>
          <strong>Stripe</strong> — our payment processor, and the only third party our application asks to place a
          cookie. Stripe sets
          its own fraud-prevention cookies (<strong>__stripe_mid</strong> and <strong>__stripe_sid</strong>) when our
          billing page loads Stripe's payment form, and only then. They are used to detect fraudulent card use, not for
          advertising or profiling. See Stripe's cookie policy for details.
        </p>
        <p>
          <strong>Cloudflare</strong> — the network that serves this site: DNS, TLS and protection against
          denial-of-service and hostile traffic. Cloudflare's bot-management features can place a security cookie of
          their own on your browser before a request reaches us, and whether they do is a setting in Cloudflare's
          dashboard rather than something our application decides. Checked on <strong>16 October 2026</strong>: three
          requests to meticlecare.com — a public page, the sign-in page and our API's health endpoint — returned no
          cookie from Cloudflare at all. If that changes, the cookie will be named here.
        </p>
      </S>

      <S title="4. Managing Cookies">
        <p>
          Most browsers allow you to block or delete cookies. Meticle Care requires these two to function — blocking
          them prevents you from signing in. Removing them, or clearing your browser's site data, also clears the
          preferences held in local storage described above; nothing in your care records is stored in your browser.
        </p>
      </S>

      <S title="5. Changes">
        <p>We will update this policy if our cookie usage changes. Material changes will be notified via in-app notification.</p>
      </S>

      <S title="6. Contact">
        <p>Questions about this policy: privacy@meticlecare.com<br/>34Orients Ltd, company number 17446318<br/>3 Dan-Y-Coedcae Road, Pontypridd, United Kingdom, CF37 1LS</p>
      </S>
    </Container>
    </>
  )
}
