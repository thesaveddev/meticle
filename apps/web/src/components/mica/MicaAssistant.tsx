import { Box, Typography, Stack, Paper, Snackbar, Alert } from '@mui/material'
import MicaOrb from './MicaOrb'
import { useMica } from './useMica'
import MicaOverlay from './MicaOverlay'

const TRY_PROMPTS = [
  'Record a care note…',
  'Who is on shift right now?',
  'Summarise today’s incidents…',
]

/**
 * Dashboard Mica banner (brief §21/§22). Sits at the bottom of the dashboard
 * grid: quiet card, orb on the left, try-prompts that start the voice flow.
 * Shares the same useMica machine as the floating orb, so the overlay and
 * session state stay in sync whichever entry point was used.
 */
export default function MicaAssistant() {
  const mica = useMica()
  const active = mica.state !== 'idle'

  return (
    <>
      <MicaOverlay
        state={mica.state}
        audioLevel={mica.audioLevel}
        transcript={mica.transcript}
        responseMessage={mica.responseMessage}
        person={mica.selectedPerson}
        onPersonChange={mica.setSelectedPerson}
        onCancel={mica.stopListening}
      />
      {/* Mic-denied / unsupported-browser errors must be visible here too —
          the overlay never opens on those paths, so without this the tap
          would look dead (same contract as MicaFab). */}
      <Snackbar
        open={Boolean(mica.error) && !active}
        autoHideDuration={6000}
        onClose={() => mica.setState('idle')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
          {mica.error}
        </Alert>
      </Snackbar>
      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 'var(--radius-lg)',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'var(--mc-surface)',
          display: active ? 'none' : 'flex',
          alignItems: 'center',
          gap: { xs: 2, md: 3 },
          flexWrap: { xs: 'wrap', md: 'nowrap' },
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <MicaOrb state="idle" onPress={mica.startListening} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>Mica</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Your AI care assistant</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Find information, record care notes, create rotas…
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }} aria-label="Mica suggestions">
            {TRY_PROMPTS.map(prompt => (
              <Box
                key={prompt}
                component="button"
                type="button"
                onClick={mica.startListening}
                sx={{
                  border: '1px solid var(--mc-border)',
                  bgcolor: 'var(--mc-surface-subtle)',
                  color: 'text.secondary',
                  borderRadius: 'var(--radius-pill)',
                  px: 1.5,
                  py: 0.5,
                  fontSize: 'var(--font-sm)',
                  font: 'inherit',
                  cursor: 'pointer',
                  transition: 'border-color var(--motion-fast) ease, color var(--motion-fast) ease',
                  '&:hover': { borderColor: 'var(--mc-primary)', color: 'var(--mc-primary)' },
                }}
              >
                Try: “{prompt}”
              </Box>
            ))}
          </Stack>
        </Box>
      </Paper>
    </>
  )
}
