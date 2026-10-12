import { Box, Typography, Stack, Paper } from '@mui/material'
import MicaOrb from './MicaOrb'
import { useMicaSession } from './MicaProvider'
import { MICA_LABEL } from './mica.identity'

const TRY_PROMPTS = [
  'Record a care note…',
  'Who is on shift right now?',
  'Summarise today’s incidents…',
]

/**
 * Dashboard Mica launcher (brief §21/§22). Sits at the bottom of the dashboard
 * grid: quiet card, orb on the left, try-prompts that start the voice flow.
 *
 * It is an *entry point*, not a Mica of its own: it reads the shell's single
 * session (`MicaProvider`), so tapping here or the floating orb reaches the same
 * conversation, and the overlay and failure notice are rendered once by the
 * session rather than twice.
 */
export default function MicaAssistant() {
  const mica = useMicaSession()
  const active = mica.state !== 'idle'

  return (
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
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 'var(--font-lg)' }}>Mica</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Your AI care assistant</Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Find information, record care notes, create rotas…
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }} aria-label={MICA_LABEL.suggestions}>
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
  )
}
