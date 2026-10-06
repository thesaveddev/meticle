/**
 * Guards the MeticleCare master palette against legacy-colour regressions.
 *
 * ## What went wrong
 *
 * The application-wide colour overhaul migrated ~230 files off the legacy
 * system (deep navy `#0F4C81` family, slate greys `#6B7280`/`#5B6672`,
 * off-spec semantic tones like `#DC2626`/`#16A34A`/`#D97706`, and random
 * purples/indigos) onto the centralised master palette in
 * `context/ThemeContext.tsx` (`METICLE_COLORS`, `METICLE_CHART_PALETTE`),
 * `index.css` (`--mc-*`), and `mobile/src/theme.tsx` (`lightColors`,
 * `CHART_PALETTE`). A codemod cannot prevent the *next* copy-paste from a
 * stale snippet, an old branch, or muscle memory — six files still carrying
 * legacy values (`theme-color` meta, a navy family-feedback page, an
 * indigo profile page, role/avatar colours) were only found by the audit
 * that motivated this test.
 *
 * ## What is asserted
 *
 * 1. No legacy palette hex appears in `apps/web/src` or `apps/mobile/src`
 *    (case-insensitive; comments stripped so historical explanations are
 *    exempt). If a legacy value is genuinely needed at runtime (e.g.
 *    recognising a stored org branding colour), isolate it behind the
 *    central theme module and document it here — do not scatter it.
 * 2. No `grey.*` MUI palette references (they resolve to near-white in both
 *    modes — use `#E6EAF0` / notice tokens).
 * 3. No 3-digit shorthand hex (always expand to the 6-digit master token).
 * 4. No navy-tinted `rgba(11,44,81,…)` shadows (use ink `rgba(23,32,42,…)`).
 * 5. Every chart palette follows the master order exactly.
 * 6. Mobile avatar colours come from the shared `CHART_PALETTE`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Every hex retired by the colour overhaul. Matched case-insensitively. */
const LEGACY_HEX = [
  // Deep navy brand family (never a background; never dominant).
  '#0F4C81', '#0A3A5C', '#0A3A63', '#0A3A61', '#0A3A66', '#005EB8', '#0D3F6E',
  '#0D3F6B', '#0B1426', '#162033', '#1E2D45', '#1E3A5F',
  // Bright/material blues (use #2F80ED; supporting #6B8AFD only for charts).
  '#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE', '#EFF6FF',
  '#BFDBFE', '#BAE6FD', '#E0F2FE', '#E3F2FD', '#BBDEFB', '#0284C7', '#0369A1',
  '#075985', '#1565C0', '#1D4ED8',
  // Teal/cyan strays (use #10BFA5 family; supporting #55BFD3/#5CC8B7 only).
  '#0EA5E9', '#0891B2', '#00C9A7', '#00A88C', '#99F6E4', '#134E4A', '#3B9FE8',
  '#66BEFA', '#33CCFF', '#39C5D9', '#4FD9B1', '#5DE2D1', '#48DAD0',
  // Legacy greys and ink (use #667085 / #98A2B3 / #E6EAF0 / #D8DEE7 / #17202A).
  '#6B7280', '#5B6672', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6', '#F1F5F9',
  '#E2E8F0', '#64748B', '#1B2430', '#111827', '#374151', '#4B5563', '#DDE3EA',
  '#B8C3D1', '#EEF1F5', '#EEF2F6', '#F8FAFD', '#F4F7FB', '#475569', '#1C1917',
  '#2D3F54', '#EDF2F7', '#ECFEFF', '#F7F9F7', '#FAFAFA', '#FAFBFC',
  // Off-spec greens (success is #10B981 on #EAFBF5 with #087A55 text;
  // secondary teal is #10BFA5 on #E8FAF6).
  '#16A34A', '#15803D', '#166534', '#065F46', '#065F56', '#047857', '#059669',
  '#087F5B', '#078B6B', '#14532D', '#22C55E', '#DCFCE7', '#D1FAE5', '#BBF7D0',
  '#ECFDF5', '#F0FDF4', '#E9F7F0', '#E8F6F0', '#E8F5E9', '#E0F7F1', '#A5D6A7',
  // Off-spec ambers (warning is #F59E0B on #FFF7E6 with #9A6700 text).
  '#D97706', '#92400E', '#78350F', '#B45309', '#B54708', '#9A3412', '#7C2D12',
  '#B77908', '#A16207', '#C2410C', '#FFFBEB', '#FEF3C7', '#FDE68A', '#FFF7ED',
  '#FFF7E8', '#FFF5D9', '#FEF9C3', '#FED7AA', '#FCD34D', '#EA580C', '#F97316',
  '#EAB308', '#FF6B35', '#FDBA74',
  // Off-spec reds (danger is #EF4444 on #FEF0F0 with #B42318 text).
  '#DC2626', '#B91C1C', '#991B1B', '#C93737', '#F97066', '#FEF2F2', '#FEE2E2',
  '#FECACA', '#FDECEC', '#FFEBEE', '#7F1D1D', '#EA4335', '#BE123C',
  // Random purples / indigos (supporting #8B7CF6 / #6B8AFD are charts-only).
  '#7C3AED', '#6D28D9', '#A855F7', '#6366F1', '#4F46E5', '#2D3A8C', '#5B21B6',
  '#9333EA', '#E9D5FF', '#DDD6FE', '#EDE9FE', '#EEF2FF', '#E0E7FF', '#C4B5FD',
  '#F5F3FF', '#FAF8FF', '#D946EF', '#EC4899', '#FCE7F3',
  // Legacy warm neutrals (backgrounds are #F7F9FC / #F9FAFB).
  '#F7F4EE', '#E7E1D6', '#E0D9CA', '#E7EEF4', '#D8E0EA', '#CAD6E5',
]

/** The one chart order used by every module. */
const CHART_ORDER =
  "['#2F80ED', '#10BFA5', '#10B981', '#F59E0B', '#EF4444', '#8B7CF6', '#6B8AFD', '#94A3B8']"

const CHART_FILES = [
  'components/charts/AreaChart.tsx',
  'components/charts/BarChart.tsx',
  'components/charts/LineChart.tsx',
  'components/charts/PieChart.tsx',
  'pages/training/TrainingMatrixPage.tsx',
]

function sourceRoots(): string[] {
  const roots = [join(process.cwd(), 'src'), join(process.cwd(), '..', 'mobile', 'src')]
  for (const root of roots) {
    if (!existsSync(root)) throw new Error(`palette audit: expected source root ${root}`)
  }
  return roots
}

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        walk(p)
      } else if (/\.(ts|tsx|css)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        out.push(p)
      }
    }
  }
  for (const root of sourceRoots()) walk(root)
  return out
}

/** Removes block and full-line comments so historical explanations are exempt. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
}

const display = (p: string) => p.replace(/\\/g, '/')

describe('master palette guardrails', () => {
  it('no legacy palette hexes in web or mobile sources', () => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'))
      const lowered = code.toLowerCase()
      for (const hex of LEGACY_HEX) {
        if (lowered.includes(hex.toLowerCase())) {
          offenders.push(`${display(file)}: ${hex}`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('no MUI grey.* palette references', () => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'))
      const bad = code.match(/['"`]grey\.\d{2,3}['"`]/g)
      if (bad) offenders.push(`${display(file)}: ${[...new Set(bad)].join(', ')}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('no 3-digit shorthand hex', () => {
    // The lookbehind keeps URL fragments such as /features#backup out.
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'))
      const bad = code.match(/(?<![A-Za-z0-9_/$-])#[0-9A-Fa-f]{3}(?![0-9A-Fa-f])/g)
      if (bad) offenders.push(`${display(file)}: ${[...new Set(bad)].join(', ')}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('no navy-tinted rgba shadows', () => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'))
      if (/rgba\(\s*11\s*,\s*44\s*,\s*81/i.test(code)) offenders.push(display(file))
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('every chart palette follows the master order', () => {
    const root = join(process.cwd(), 'src')
    const offenders: string[] = []
    for (const rel of CHART_FILES) {
      const code = stripComments(readFileSync(join(root, rel), 'utf8'))
      if (!code.includes(CHART_ORDER)) {
        offenders.push(`${rel}: palette differs from ${CHART_ORDER}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('mobile avatar colours come from the shared CHART_PALETTE', () => {
    const mobile = join(process.cwd(), '..', 'mobile', 'src')
    const theme = stripComments(readFileSync(join(mobile, 'theme.tsx'), 'utf8'))
    expect(theme.includes('CHART_PALETTE'), 'theme.tsx must export CHART_PALETTE').toBe(true)
    const offenders: string[] = []
    for (const file of sourceFiles().filter((f) => display(f).includes('/mobile/src/'))) {
      const code = stripComments(readFileSync(file, 'utf8'))
      if (/AVATAR_COLORS\s*=\s*\[/.test(code)) {
        offenders.push(`${display(file)}: hardcoded avatar array — use CHART_PALETTE`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
