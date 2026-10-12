/**
 * Print/export document tokens — the client-side export builders' answer to
 * PDF_TEXT in apps/api. The two web pages that ship their own HTML for
 * download/print (EvidencePacksPage, CqcReadinessPage) previously hard-coded
 * their own divergent hex ramp; these names give both one vocabulary so a
 * palette change is a one-line edit per token.
 *
 * Values mirror the server-side PDF documents (apps/api PDF_TEXT) where they
 * share a job — near-black body ink, hairline rules, brand navy, status chip
 * fills — and keep the brand-blue figures the web dashboards already print.
 * Typography rules are baked in here too: no uppercase transforms, no weight
 * above 600, Inter like everything else in the web app.
 */
export const X = {
  /* ── Ink ─────────────────────────────────────────── */
  /** Body ink on paper. */
  ink:        '#0C1B2E',
  /** Strongest ink — headings, key figures. */
  heading:    '#1F2937',
  /** Paragraph copy, table cells. */
  body:       '#0C1B2E',
  /** Secondary copy — captions, labels. */
  secondary:  '#51637A',
  /** Faintest copy — meta, footers, legal lines. */
  muted:      '#5D6E85',

  /* ── Rules & surfaces ────────────────────────────── */
  /** Table rules, card borders. */
  line:       '#E3E9F0',
  /** Softer rules (row hairlines inside panels). */
  lineSoft:   '#D6E2EE',
  /** Table header fill, row striping, soft panels. */
  headerBg:   '#F4F9FC',
  panelBg:    '#F7FAFE',

  /* ── Brand ───────────────────────────────────────── */
  /** Brand blue — headings, figure accents, section rules. */
  brand:      '#0164C8',
  /** Wordmark + footer text accent. */
  brandDeep:  '#087A55',
  /** AI-section accent and its soft panel fill. */
  accent:     '#8B7CF6',
  accentSoft: '#EAF3FF',

  /* ── Status tones ────────────────────────────────── */
  okBg:       '#EAFBF5',
  okFg:       '#087A55',
  warnBg:     '#FFF7E6',
  warnFg:     '#9A6700',
  badBg:      '#FEF0F0',
  badFg:      '#B42318',
  neutralBg:  '#F0F5FC',
  neutralFg:  '#3A4551',

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  /** Weight ceiling for every printed document (600 is bold here). */
  strong: 600 as const,
  regular: 400 as const,
} as const

/** Backwards-compatible short alias used by a few export-adjacent surfaces. */
export const EX = X
