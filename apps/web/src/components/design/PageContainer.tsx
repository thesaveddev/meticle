import { Box, BoxProps } from '@mui/material'

/**
 * Standard page container for all authenticated pages.
 *
 * Provides consistent max-width, centering, and spacing.
 * The Layout's <main> already applies horizontal padding (px: 4 = 32px).
 * PageContainer adds max-width constraint and centering where needed.
 *
 * Width variants:
 * - "standard" (default): 1280px — most pages
 * - "narrow": 800px — forms, profile, settings
 * - "wide": 100% — dashboards, tables, maps, chat
 * - "compact": 640px — minimal forms
 */

type ContainerWidth = 'compact' | 'narrow' | 'standard' | 'wide'

const WIDTH_MAP: Record<ContainerWidth, number | string> = {
  compact: 640,
  narrow: 800,
  standard: 1280,
  wide: '100%',
}

interface PageContainerProps extends BoxProps {
  width?: ContainerWidth
}

export default function PageContainer({ width = 'wide', sx, children, ...props }: PageContainerProps) {
  return (
    <Box
      sx={{
        maxWidth: WIDTH_MAP[width],
        mx: width !== 'wide' ? 'auto' : undefined,
        width: '100%',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}
