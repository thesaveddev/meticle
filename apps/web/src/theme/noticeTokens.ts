/**
 * Mode-aware "notice" surfaces and their readable foregrounds.
 *
 * ## Why this exists
 *
 * Every notice in this app — allergy panels, incident cards, status chips,
 * quiet inset rows — is a hand-rolled `<Paper>`/`<Box>`/`<Chip>` with a tinted
 * `bgcolor` and a label sitting on top of it. Across 38 files that tint was
 * written as `bgcolor: 'notice.success.bg'` (and the `error`/`warning`/`info`
 * equivalents), on the assumption that `.light` is a pale tint.
 *
 * It is not. `palette.success.light` is a *mid* tone (`#4caf50` in light mode,
 * `#10B981` in dark). MUI's own `<Alert>` works precisely because it does not
 * use the tone directly — `Alert.js` derives a surface with
 * `lighten(light, 0.9)` and a foreground with `darken(light, 0.6)` in light
 * mode, and the inverse in dark mode. That derivation is why an Alert is
 * readable. Every hand-rolled site bypassed it and used the mid tone as a
 * background, which measured 4.53–7.32:1 against inherited body text in light
 * mode and 1.58–2.73:1 in dark — a hard WCAG AA failure.
 *
 * Repointing the palette itself was rejected: `palette.*.light` is documented
 * as a mid tone, MUI's Alert derives from it, and overriding it would silently
 * re-tint every Alert in the product. These tokens are the fix instead — the
 * same derivation, resolved once and named.
 *
 * `subtle` and `muted` replace `grey.50`/`grey.100`, which MUI also leaves
 * light-only: `#F9FAFB`/`#F7F9FC` are near-white in both modes, so they render
 * as white boxes on a dark page.
 */

export interface NoticePair {
  /** The surface. Pale in light mode, a low-alpha tint in dark. */
  bg: string
  /** A foreground guaranteed to clear 4.5:1 against `bg` in this mode. */
  fg: string
}

export interface NoticeTokens {
  success: NoticePair
  error: NoticePair
  warning: NoticePair
  info: NoticePair
  /** Replaces `grey.50` — a near-invisible inset, a shade off the surface. */
  subtle: { bg: string }
  /** Replaces `grey.100` — a slightly stronger inset than `subtle`. */
  muted: { bg: string }
}

declare module '@mui/material/styles' {
  interface Palette {
    notice: NoticeTokens
  }
  interface PaletteOptions {
    notice?: NoticeTokens
  }
}

const LIGHT: NoticeTokens = {
  // Light mode: master-palette surfaces with readable text (4.5:1+).
  success: { bg: '#EAFBF5', fg: '#087A55' },
  error: { bg: '#FEF0F0', fg: '#B42318' },
  warning: { bg: '#FFF7E6', fg: '#9A6700' },
  info: { bg: '#EAF3FF', fg: '#175CD3' },
  subtle: { bg: '#F8FAFC' },
  muted: { bg: '#F2F4F7' },
}

const DARK: NoticeTokens = {
  // Dark mode: a low-alpha tint of the hue over `background.paper`, so the
  // surface still reads as a distinct panel rather than a flat block, with a
  // light foreground for the label and any icon on it.
  success: { bg: 'rgba(34,197,94,0.16)', fg: '#86EFAC' },
  error: { bg: 'rgba(239,68,68,0.16)', fg: '#FCA5A5' },
  warning: { bg: 'rgba(245,158,11,0.16)', fg: '#F59E0B' },
  info: { bg: 'rgba(14,165,233,0.16)', fg: '#7DD3FC' },
  // Both insets need to clear their own surface against `background.paper`,
  // or a "subtle" row is just the page again. The first dark `muted` value
  // tried was `#1F2A3D`, which measured 1.01:1 against `#1E293B`.
  subtle: { bg: '#161F31' },
  muted: { bg: '#2A3A52' },
}

export function noticeTokens(mode: 'light' | 'dark'): NoticeTokens {
  return mode === 'dark' ? DARK : LIGHT
}
