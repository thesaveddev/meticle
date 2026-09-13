import { Box, Typography, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import InboxIcon from '@mui/icons-material/Inbox'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

const stagger = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
} as const

const childFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'search' | 'error'
}

const VARIANT_CONFIG = {
  default: { bg: '#F0F9FF', color: '#0F4C81', Icon: InboxIcon },
  search: { bg: '#F3F4F6', color: '#6B7280', Icon: SearchOffIcon },
  error: { bg: '#FEF2F2', color: '#DC2626', Icon: ErrorOutlineIcon },
}

export function EmptyState({ icon, title, description, action, variant = 'default' }: EmptyStateProps) {
  const theme = useTheme()
  const config = VARIANT_CONFIG[variant]
  const IconComponent = config.Icon

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <Box
        sx={{
          py: 8,
          px: 4,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <motion.div variants={childFade}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: theme.palette.mode === 'dark' ? `${config.color}20` : config.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            {icon || <IconComponent sx={{ fontSize: 32, color: config.color }} />}
          </Box>
        </motion.div>

        <motion.div variants={childFade}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              mb: 1,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </Typography>
        </motion.div>

        {description && (
          <motion.div variants={childFade}>
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                maxWidth: 400,
                lineHeight: 1.6,
                mb: action ? 3 : 0,
              }}
            >
              {description}
            </Typography>
          </motion.div>
        )}

        {action && (
          <motion.div variants={childFade}>
            <Button
              variant="contained"
              onClick={action.onClick}
              sx={{
                borderRadius: '12px',
                px: 3,
                py: 1.5,
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              {action.label}
            </Button>
          </motion.div>
        )}
      </Box>
    </motion.div>
  )
}

interface EmptyRowProps {
  message: string
  colSpan?: number
}

export function EmptyRow({ message }: EmptyRowProps) {
  const theme = useTheme()
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <Box
        sx={{
          py: 8,
          px: 4,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <motion.div variants={childFade}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <InboxIcon sx={{ fontSize: 24, color: theme.palette.text.secondary }} />
          </Box>
        </motion.div>

        <motion.div variants={childFade}>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.secondary,
            }}
          >
            {message}
          </Typography>
        </motion.div>
      </Box>
    </motion.div>
  )
}
