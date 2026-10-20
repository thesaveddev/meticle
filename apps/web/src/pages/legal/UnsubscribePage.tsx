import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import PageMeta from '../../components/PageMeta'
import api from '../../services/api'

/**
 * The page an unsubscribe link lands on.
 *
 * It exists as a page rather than a GET that unsubscribes on load, for two reasons.
 * A mail scanner or a link-preview bot follows every URL in a message, and a link
 * that acts on fetch would quietly unsubscribe people who never clicked it. And a
 * recipient is entitled to know *what* they are stopping before it stops — an
 * address they may have forgotten they had, and one of two categories.
 *
 * The API behind it is public because the whole point is not having to sign in:
 * the address in the link is often the only identity the recipient still has here.
 * Transactional mail — a password reset, a receipt, an invoice, a statutory
 * notice — is deliberately outside the categories on offer, and the page says so
 * rather than implying a silence it cannot deliver.
 */

interface LinkDetails {
  email: string
  scope: 'marketing' | 'notifications'
  scope_label: string
}

export default function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [details, setDetails] = useState<LinkDetails | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'invalid' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!token) { setState('invalid'); return }
    ;(async () => {
      try {
        // Silent: the page is its own error surface, and a global toast behind a
        // full-page message would say the same thing twice.
        const res = await api.get('/email/unsubscribe', { params: { token }, silentError: true })
        if (cancelled) return
        setDetails(res.data as LinkDetails)
        setState('ready')
      } catch (error: any) {
        if (cancelled) return
        const status = error?.response?.status
        setMessage(error?.response?.data?.message || 'We could not check this link.')
        setState(status === 400 ? 'invalid' : 'error')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const confirm = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      await api.post('/email/unsubscribe', { token }, { silentError: true })
      setState('done')
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'We could not record that. Please try again.')
      setState('error')
    } finally {
      setBusy(false)
    }
  }, [token])

  return (
    <>
      <PageMeta
        title="Email preferences | Meticle Care"
        description="Stop receiving Meticle Care emails you no longer want. Password resets and receipts are unaffected."
        canonicalPath="/unsubscribe"
      />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', py: 6 }}>
        <Container maxWidth="sm">
          <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack spacing={2.5} alignItems="flex-start">
              <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'notice.info.bg', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {state === 'done'
                  ? <MarkEmailReadIcon sx={{ color: 'notice.info.fg' }} />
                  : <MailOutlineIcon sx={{ color: 'notice.info.fg' }} />}
              </Box>

              {state === 'loading' && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography sx={{ color: 'text.secondary' }}>Checking your link…</Typography>
                </Stack>
              )}

              {state === 'invalid' && (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>This link is not valid</Typography>
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {message || 'The link may have been cut short by your email client.'} Reply to any email from us and
                    we will take you off the list by hand.
                  </Typography>
                  <Button component={RouterLink} to="/contact" variant="outlined" sx={{ textTransform: 'none' }}>
                    Contact us
                  </Button>
                </>
              )}

              {state === 'error' && (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>Something went wrong</Typography>
                  <Alert severity="error" sx={{ width: '100%' }}>{message}</Alert>
                  <Button onClick={confirm} variant="contained" disabled={busy} sx={{ textTransform: 'none' }}>
                    Try again
                  </Button>
                </>
              )}

              {state === 'ready' && details && (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>Stop these emails?</Typography>
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    We will stop sending <strong>{details.scope_label}</strong> to <strong>{details.email}</strong>.
                  </Typography>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'notice.subtle.bg', border: '1px solid', borderColor: 'divider', width: '100%' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                      Account emails you need &mdash; password resets, security alerts, receipts and statutory notices
                      &mdash; will still arrive. You can fine-tune individual notifications from Settings once signed in.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: '100%' }}>
                    <Button
                      onClick={confirm}
                      variant="contained"
                      disabled={busy}
                      sx={{ textTransform: 'none' }}
                    >
                      {busy ? 'Unsubscribing…' : 'Unsubscribe'}
                    </Button>
                    <Button component={RouterLink} to="/" variant="text" sx={{ textTransform: 'none', color: 'text.secondary' }}>
                      Keep receiving them
                    </Button>
                  </Stack>
                </>
              )}

              {state === 'done' && details && (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>You&rsquo;re unsubscribed</Typography>
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    We will not send <strong>{details.scope_label}</strong> to <strong>{details.email}</strong> again.
                    Account emails you need will still arrive.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Changed your mind? Sign in and turn the notifications you want back on in Settings.
                  </Typography>
                  <Button component={RouterLink} to="/login" variant="outlined" sx={{ textTransform: 'none' }}>
                    Sign in
                  </Button>
                </>
              )}
            </Stack>
          </Paper>
        </Container>
      </Box>
    </>
  )
}
