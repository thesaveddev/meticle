import { ReactElement, ReactNode, SVGProps } from 'react'
import { SvgIcon, type SvgIconProps } from '@mui/material'

/**
 * Stroke-based icon set used in landing + marketing pages.
 * All icons:
 *  - inherit currentColor (so MUI's <Typography> / <Box> colour cascades)
 *  - use a 24x24 viewBox
 *  - 1.75 stroke, round caps, round joins
 *  - render the .cap-arrow-style slot the same way (no fill, stroke only)
 */

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  title?: string
}

function Base({
  size = 24,
  title,
  children,
  ...rest
}: IconProps & { children: ReactElement | ReactElement[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

// ── Capability group 1 — care & medication ──────────────────────────────
export const EmarIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <line x1="7" y1="9" x2="17" y2="9" />
    <line x1="7" y1="13" x2="17" y2="13" />
    <line x1="7" y1="17" x2="13" y2="17" />
    <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" />
  </Base>
)

export const CareNoteIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M16 4v3h3" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </Base>
)

export const SupportPlanIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
    <path d="M16 7l1.5 1.5L21 5" />
  </Base>
)

export const BodyMapIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v6" />
    <path d="M9 11l-2 9" />
    <path d="M15 11l2 9" />
    <path d="M9 13l-3 2" />
    <path d="M15 13l3 2" />
    <path d="M10 13h4" />
  </Base>
)

export const AppointmentIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
    <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
  </Base>
)

export const GoalsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Base>
)

// ── Capability group 2 — people & operations ─────────────────────────────
export const RotaIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="3" y1="14" x2="21" y2="14" />
    <line x1="9" y1="5" x2="9" y2="19" />
    <line x1="14" y1="5" x2="14" y2="19" />
  </Base>
)

export const LeaveIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 18l8-12 8 12" />
    <path d="M6 18l5-8 5 8" />
    <path d="M9 18l2-3 2 3" />
  </Base>
)

export const IncidentIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l9 16H3z" />
    <line x1="12" y1="10" x2="12" y2="14" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </Base>
)

export const TaskIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 12l3 3 5-7" />
  </Base>
)

export const ChatIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4 4v-4H4a0 0 0 0 1 0 0z" />
    <line x1="8" y1="9" x2="15" y2="9" />
    <line x1="8" y1="12" x2="13" y2="12" />
  </Base>
)

export const TrainingIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 9l9-4 9 4-9 4-9-4z" />
    <path d="M7 11v4c0 1.5 2.2 2.5 5 2.5s5-1 5-2.5v-4" />
    <line x1="21" y1="9" x2="21" y2="14" />
  </Base>
)

// ── Capability group 3 — compliance & oversight ──────────────────────────
export const ShieldIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Base>
)

export const EvidenceIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 3h10l4 4v14a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0z" />
    <path d="M15 3v4h4" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </Base>
)

export const SurveyIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 8l2 2 4-4" />
    <line x1="9" y1="14" x2="15" y2="14" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </Base>
)

export const PolicyIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M9 15l6-6" />
  </Base>
)

export const DsptIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="10" width="16" height="10" rx="1.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
  </Base>
)

export const AuditIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 3h10l-1 4H6z" />
    <path d="M6 7l-1 14h14l-1-14" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </Base>
)

// ── Role icons ────────────────────────────────────────────────────────
export const ManagerIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="6" r="3" />
    <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" />
    <circle cx="18" cy="5" r="1.2" fill="currentColor" stroke="none" />
  </Base>
)

export const CareWorkerIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="7" r="3" />
    <path d="M6 21v-7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v7" />
    <path d="M11 14h2v3h-2z" fill="currentColor" stroke="none" />
  </Base>
)

export const FamilyIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="7" cy="9" r="2.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M3 20c0-3 2-5 4-5s4 2 4 5" />
    <path d="M13 20c0-3 2-5 4-5s4 2 4 5" />
  </Base>
)

export const OwnerIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
  </Base>
)

// ── Step icons (timeline accumulator) ─────────────────────────────────
export const PillIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)" />
    <line x1="9" y1="6" x2="15" y2="6" transform="rotate(-30 12 12)" />
  </Base>
)

export const FamilyBellIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 17V11a6 6 0 0 1 12 0v6" />
    <path d="M5 17h14" />
    <path d="M11 6V3h2v3" />
    <circle cx="8" cy="20" r="1.4" fill="currentColor" stroke="none" />
  </Base>
)

export const StethoscopeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 3v6a4 4 0 0 0 8 0V3" />
    <path d="M11 13v3a4 4 0 0 0 8 0v-2" />
    <circle cx="19" cy="11" r="1.5" />
  </Base>
)

/* ── Nav glyph group — Figma 02 · Navigation states ─────────────────────
 * Feather/Lucide-style line icons matching the Figma menu glyph set.
 * Every dropdown glyph is a monochrome outline inheriting currentColor —
 * the nav renders them in brand blue; the heart carries a pulse line inside,
 * per the Figma menu set.
 * (24-grid, 2px strokes, round caps and joins — Icon/heart 2:47,
 * Icon/pill 2:102, Icon/users 2:39, Icon/calendar 2:17, Icon/alert 2:114,
 * Icon/chart 2:62, Icon/home 2:98, Icon/sparkles 2:44). Colour cascades.
 */

const navPaths: Record<string, ReactNode> = {
  heart: (
    <>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      <polyline points="4 12 8 12 10 9.5 14 14.5 16 12 20 12" />
    </>
  ),
  pill: (
    <>
      <path d="m10.5 20.5-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  alert: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  chart: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </>
  ),
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M18.5 3.5v4M16.5 5.5h4" />
    </>
  ),
  phone: <rect x="5" y="2" width="14" height="20" rx="2" />,
  arrowRight: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
}

export type MarketingIconName = keyof typeof navPaths

export function FIcon({ name, size = 18, ...props }: { name: MarketingIconName; size?: number } & Omit<SvgIconProps, 'children' | 'fontSize'>) {
  return (
    <SvgIcon
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      sx={{ fontSize: size, ...(props.sx ?? {}) }}
    >
      {navPaths[name]}
    </SvgIcon>
  )
}
