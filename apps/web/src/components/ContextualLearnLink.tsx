import { HelpOutline as HelpIcon } from '@mui/icons-material'
import { Button } from '@mui/material'

export default function ContextualLearnLink({ topic, label = 'Learn more' }: { topic: string; label?: string }) {
  const href = `/learn?topic=${encodeURIComponent(topic)}`
  return (
    <Button
      component="a"
      href={href}
      size="small"
      variant="text"
      startIcon={<HelpIcon sx={{ fontSize: 16 }} />}
      sx={{ textTransform: 'none', fontWeight: 700, color: '#0F4C81', whiteSpace: 'nowrap' }}
    >
      {label}
    </Button>
  )
}
