import { Box, Container, Typography } from '@mui/material'
import PageMeta from '../../components/PageMeta'

/**
 * The public account-deletion page.
 *
 * Google Play requires a web URL where a user can request deletion, in addition
 * to any in-app path, and Apple asks for the same thing under Account Privacy.
 * The in-app path already exists and works — Settings ends in a self-service
 * deactivation that erases the account rather than flagging it — so this page is
 * deliberately not a second deletion mechanism. It is the signpost: it says who
 * can delete, what actually happens to the data, and who to contact if the
 * in-app path is not appropriate.
 *
 * It stays accurate by pointing at the in-app flow rather than restating it, so
 * it cannot drift into describing a process the app does not have. The
 * behavioural distinction that matters is spelled out: a care record belongs to
 * the care provider, who is the data controller, so a worker leaving does not
 * take their clients' history with them.
 */
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

export default function AccountDeletionPage() {
  return (
    <>
      <PageMeta
        title="Delete Your Account | Meticle Care"
        description="How to delete your Meticle Care account, what happens to your data, and who to contact if you need help."
        canonicalPath="/delete-account"
      />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h3" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Delete your account</Typography>
        <Typography variant="body2" color="#6B7280" sx={{ mb: 5 }}>Last updated: September 2026</Typography>

        <Section title="Deleting it yourself">
          <p>You can delete your account at any time, without contacting us:</p>
          <ol>
            <li>Open the Meticle Care app and sign in.</li>
            <li>Go to <strong>Settings</strong>.</li>
            <li>In the <strong>ACCOUNT</strong> section, tap <strong>Delete my account</strong>.</li>
            <li>Confirm. You are signed out straight away and do not need to wait for a support ticket.</li>
          </ol>
          <p>Deletion is permanent. There is no restore, so please re-download anything you need before you confirm.</p>
          <p>The app will also remind you that your organisation keeps the care records you worked on, for regulatory reasons. That is correct and is explained below.</p>
        </Section>

        <Section title="If you cannot use the app">
          <p>If you have lost access to the device or the app will not let you delete your own account, email <strong>privacy@meticlecare.com</strong> from the address on the account and we will action it for you. We will verify that you are the account holder before deleting anything, and we will reply once it is done.</p>
        </Section>

        <Section title="What deletion actually removes">
          <p>Deleting your account is not a soft flag. Your user record is permanently deactivated and the following is erased straight away:</p>
          <ul>
            <li>Your name, email address, phone number, address and photograph</li>
            <li>Your password, and any multi-factor authentication secret or backup codes</li>
            <li>Your emergency contacts</li>
            <li>Any outstanding password-reset tokens</li>
          </ul>
          <p>Your email address is replaced with an undeliverable placeholder and your password with a value that matches nothing, so the account cannot be signed into again even by mistake.</p>
        </Section>

        <Section title="What is kept, and why">
          <p>Two things survive, and both are deliberate:</p>
          <ul>
            <li><strong>Your professional name</strong>, on records you created. Care providers are the data controller for the people they care for, and CQC inspection trails have to stay attributable. Keeping the name keeps the record usable for the provider and the people in their care.</li>
            <li><strong>Audit logs of your access to records</strong>, retained for the compliance periods set out in our privacy policy.</li>
          </ul>
          <p>If you have concerns about anything retained, contact privacy@meticlecare.com and we will discuss it.</p>
        </Section>

        <Section title="If you are a care provider">
          <p>Organisation accounts work differently, because a provider holds records about the people in its care and cannot simply lose them. Deactivating your own login does not delete the organisation or its care records, and a provider cannot delete itself from this page — contact privacy@meticlecare.com and we will work through the correct process with you.</p>
        </Section>

        <Section title="Questions">
          <p>Data Protection Officer: dpo@meticlecare.com<br />Privacy: privacy@meticlecare.com<br />34Orients Ltd, company number 17446318<br />3 Dan-Y-Coedcae Road, Pontypridd, United Kingdom, CF37 1LS</p>
        </Section>
      </Container>
    </>
  )
}
