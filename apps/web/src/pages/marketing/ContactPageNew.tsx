import { useRef, useState } from 'react'
import { Alert, Box, Button, Container, Grid, Link, Stack, Typography } from '@mui/material'
import {
  ArrowForward,
  Check,
  ChevronRight,
  ErrorOutline,
  ExpandMore,
} from '@mui/icons-material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import api from '../../services/api'

/* ─── Colours pinned from Figma frame 1.6 Contact (node 49:78) ───────
 * Page ground:  linear-gradient #EAF3FC → #F8FAFD (55%) → #FFFFFF
 * Eyebrow pill: white, hairline #E3EAF1, dot #0164C8, text #2A3A50
 * Title:        #0C1B2E · lede: #51637A
 * Detail rows:  hairline #E3EAF1 · icon boxes white + hairline, icons #0164C8
 *   labels #51637A · values #0C1B2E (email value #0164C8)
 * Expect steps: number chips bg #EAF3FD text #0164C8 · text #2A3A50
 * Form card:    white, radius 20, hairline #E3EAF1,
 *               shadow 0 24px 48px rgba(12,27,46,.14), padding 40
 * Fields:      labels #0C1B2E · boxes white radius 10 hairline #C9D5E2
 *               h46 (textarea h120) · placeholder #51637A
 * Checkbox:    20px box radius 6, 1.5px #C9D5E2 · label #2A3A50
 * Submit:      #0164C8 radius 14, white label + arrow,
 *               shadow 0 10px 24px rgba(1,99,199,.28) + 0 2px 4px rgba(1,99,199,.20)
 * Disclaimer:  #51637A
 * ─── States from 06 · Forms (node 73:152) ──────────────────────────
 * Focus:  1.5px #0164C8 border + rgba(1,100,200,.15) ring
 * Filled: default border, ink text
 * Error:  1px #B42318 border, #B42318 helper below the field,
 *         #FDECEC banner ("N field(s) need attention…")
 * Disabled: #F4F9FC fill
 * Success: mint #D2FBF4 circle + #004E45 check, ink title, slate sub,
 *         #F4F9FC summary box (radius 12, hairline row dividers),
 *         "While you wait, explore the platform" link
 */

const NAVY = M.navy
const INK = '#0C1B2E'
const BODY = '#2A3A50'
const SLATE = '#51637A'
const FAINT = '#E3EAF1'
const INPUT_LINE = '#C9D5E2'
const PALE_BLUE = '#EAF3FD'
const DEEP_BLUE_TEXT = '#0152A6'
const ERROR = '#B42318'
const ERROR_BG = '#FDECEC'
const MINT = '#D2FBF4'
const TEAL_DEEP = '#004E45'
const MIST_GROUND = '#F4F9FC'

function Breadcrumb() {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: { xs: 3, md: 4 } }}>
      <Typography
        component={RouterLink}
        to="/"
        sx={{ color: SLATE, fontSize: '0.85rem', textDecoration: 'none', '&:hover': { color: NAVY } }}
      >
        Home
      </Typography>
      <ChevronRight sx={{ fontSize: 14, color: '#8A9AAE' }} />
      <Box
        component="span"
        sx={{
          bgcolor: PALE_BLUE,
          color: DEEP_BLUE_TEXT,
          fontSize: '0.8rem',
          fontWeight: 600,
          borderRadius: '999px',
          px: '10px',
          py: '4px',
          lineHeight: 1.2,
        }}
      >
        Book a demo
      </Box>
    </Stack>
  )
}

function EyebrowPill() {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        bgcolor: '#fff',
        border: `1px solid ${FAINT}`,
        borderRadius: '999px',
        px: '10px',
        py: '5px',
        pr: '12px',
        mb: 3,
        boxShadow: '0 1px 2px rgba(11,27,45,0.06), 0 4px 12px rgba(11,27,45,0.05)',
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: NAVY }} />
      <Typography sx={{ color: BODY, fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.4 }}>
        Get in touch
      </Typography>
    </Box>
  )
}

/* Figma Icon/message, Icon/map-pin, Icon/clock (2:105, 2:95, 2:109):
 * 18px line icons, 2px #0164C8 strokes, round caps and joins. */
function DetailIcon({ d }: { d: 'mail' | 'pin' | 'clock' }) {
  const paths =
    d === 'mail' ? (
      <>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <path d="M22 6l-10 7L2 6" />
      </>
    ) : d === 'pin' ? (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  )
}

const details: { icon: 'mail' | 'pin' | 'clock'; label: string; value: string; href?: string }[] = [
  { icon: 'mail', label: 'Email', value: 'hello@meticlecare.com', href: 'mailto:hello@meticlecare.com' },
  { icon: 'pin', label: 'Based in', value: 'United Kingdom' },
  { icon: 'clock', label: 'Response time', value: 'Within one business day' },
]

function Details() {
  return (
    // Raw node data (49:84): each row carries ONLY a top hairline — no outer
    // box, no horizontal padding. The dividers are the rows' own top borders.
    <Box sx={{ mt: 1, pt: '8px' }}>
      {details.map((d) => (
        <Stack
          key={d.label}
          direction="row"
          alignItems="center"
          spacing="14px"
          sx={{ borderTop: `1px solid ${FAINT}`, py: '14px' }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              border: `1px solid ${FAINT}`,
              bgcolor: '#fff',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <DetailIcon d={d.icon} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: SLATE, fontSize: '0.75rem', fontWeight: 500, lineHeight: '17px' }}>{d.label}</Typography>
            {d.href ? (
              <Typography
                component="a"
                href={d.href}
                sx={{ color: NAVY, fontSize: '0.9375rem', fontWeight: 600, lineHeight: '21px', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {d.value}
              </Typography>
            ) : (
              <Typography sx={{ color: INK, fontSize: '0.9375rem', fontWeight: 600, lineHeight: '21px' }}>{d.value}</Typography>
            )}
          </Box>
        </Stack>
      ))}
    </Box>
  )
}

const expectations = [
  'We reply within one business day.',
  'We shape the conversation around your service.',
  'You see how care delivery, scheduling, medication, risk, compliance and reporting connect.',
]

function WhatToExpect() {
  return (
    <Box sx={{ mt: 4, pt: 2 }}>
      <Typography sx={{ color: INK, fontSize: '1rem', fontWeight: 600, mb: 1.5 }}>
        What to expect
      </Typography>
      <Stack spacing={1.5}>
        {expectations.map((text, i) => (
          <Stack key={text} direction="row" alignItems={i === 2 ? 'flex-start' : 'center'} spacing={1.5}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: PALE_BLUE,
                color: NAVY,
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                mt: i === 2 ? '2px' : 0,
              }}
            >
              {i + 1}
            </Box>
            <Typography sx={{ color: BODY, fontSize: '0.95rem', lineHeight: 1.5 }}>{text}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

/* ─── Form controls (Form/Input, Form/Select, Form/Textarea, Form/Checkbox) ─── */

const fieldLabelSx = { color: INK, fontSize: '0.85rem', fontWeight: 500, mb: '6px', display: 'block' } as const

const inputSx = {
  width: '100%',
  height: 46,
  borderRadius: '10px',
  border: `1px solid ${INPUT_LINE}`,
  bgcolor: '#fff',
  px: '14px',
  fontSize: '0.9375rem',
  color: INK,
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
  '&::placeholder': { color: SLATE, opacity: 1 },
  '&:focus': {
    borderColor: NAVY,
    borderWidth: '1.5px',
    px: '13.5px',
    boxShadow: '0 0 0 3px rgba(1,100,200,0.15)',
  },
} as const

const inputErrorSx = {
  borderColor: ERROR,
  '&:focus': {
    borderColor: ERROR,
    borderWidth: '1px',
    px: '14px',
    boxShadow: '0 0 0 3px rgba(180,35,24,0.12)',
  },
} as const

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography component="label" htmlFor={id} sx={fieldLabelSx}>
        {label}
      </Typography>
      {children}
      {error && (
        <Typography sx={{ color: ERROR, fontSize: '0.75rem', lineHeight: 1.35, mt: '6px' }}>
          {error}
        </Typography>
      )}
    </Box>
  )
}

function CheckboxRow({
  checked,
  onChange,
  required,
  error,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  required?: boolean
  error?: boolean
  label: React.ReactNode
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box
          component="span"
          onClick={() => onChange(!checked)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              onChange(!checked)
            }
          }}
          role="checkbox"
          aria-checked={checked}
          tabIndex={0}
          sx={{
            width: 20,
            height: 20,
            borderRadius: '6px',
            border: `1.5px solid ${error ? ERROR : checked ? NAVY : INPUT_LINE}`,
            bgcolor: checked ? NAVY : '#fff',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            mt: '1px',
            outline: 'none',
            '&:focus-visible': { boxShadow: '0 0 0 3px rgba(1,100,200,0.15)' },
          }}
        >
          {checked && (
            <Box
              component="span"
              sx={{
                width: 10,
                height: 6,
                borderLeft: '2px solid #fff',
                borderBottom: '2px solid #fff',
                transform: 'rotate(-45deg) translateY(-1px)',
              }}
            />
          )}
        </Box>
        <input
          type="checkbox"
          checked={checked}
          required={required}
          onChange={(e) => onChange(e.target.checked)}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
        />
        <Typography
          onClick={() => onChange(!checked)}
          sx={{ color: BODY, fontSize: '0.9rem', lineHeight: 1.5, cursor: 'pointer' }}
        >
          {label}
        </Typography>
      </Stack>
      {error && (
        <Typography sx={{ color: ERROR, fontSize: '0.75rem', lineHeight: 1.35, mt: '6px', ml: '32px' }}>
          Please agree to the Privacy Policy so we can reply to your enquiry.
        </Typography>
      )}
    </Box>
  )
}

/* ─── Page ─── */

type FormState = {
  name: string
  company: string
  email: string
  role: string
  careType: string
  message: string
  website: string
  privacyConsent: boolean
  marketingConsent: boolean
}

const initialForm: FormState = {
  name: '',
  company: '',
  email: '',
  role: '',
  careType: '',
  message: '',
  website: '',
  privacyConsent: false,
  marketingConsent: false,
}

type FormErrors = Partial<Record<'name' | 'company' | 'email' | 'message' | 'privacy', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const roleLabels: Record<string, string> = {
  owner: 'Owner / Director',
  'registered-manager': 'Registered Manager',
  operations: 'Operations Director',
  compliance: 'Compliance Manager',
  coordinator: 'Care Coordinator',
  other: 'Other',
}

const careTypeLabels: Record<string, string> = {
  domiciliary: 'Domiciliary care',
  'supported-living': 'Supported living',
  both: 'Both',
  other: 'Other',
}

export default function ContactPageNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendError, setSendError] = useState('')
  const topRef = useRef<HTMLDivElement>(null)

  const update = (field: 'name' | 'company' | 'email' | 'role' | 'careType' | 'message' | 'website') =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setForm((current) => ({ ...current, [field]: value }))
      if (submitAttempted) {
        setErrors((current) => {
          if (!current[field as keyof FormErrors]) return current
          const next = { ...current }
          delete next[field as keyof FormErrors]
          return next
        })
      }
    }

  const validate = (state: FormState): FormErrors => {
    const next: FormErrors = {}
    if (!state.name.trim()) next.name = 'Please enter your name'
    if (!state.company.trim()) next.company = 'Please enter your organisation'
    if (!state.email.trim()) next.email = 'Enter a full email address, like name@organisation.co.uk'
    else if (!EMAIL_RE.test(state.email.trim())) next.email = 'Enter a full email address, like name@organisation.co.uk'
    if (!state.message.trim()) next.message = 'Please tell us a little about your service'
    if (!state.privacyConsent) next.privacy = 'required'
    return next
  }

  const errorCount = Object.keys(errors).length

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    setSubmitAttempted(true)
    setSendError('')
    if (Object.keys(found).length > 0) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      await api.post('/contact', {
        name: form.name,
        company: form.company,
        email: form.email,
        role: form.role || undefined,
        careType: form.careType || undefined,
        message: form.message,
        website: form.website,
        source: 'website-contact',
        utmSource: params.get('utm_source') || undefined,
        utmMedium: params.get('utm_medium') || undefined,
        utmCampaign: params.get('utm_campaign') || undefined,
        referrer: document.referrer || undefined,
        privacyConsent: form.privacyConsent,
        marketingConsent: form.marketingConsent,
        privacyPolicyVersion: '2026-09-20',
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'We could not send your enquiry. Please try again or email hello@meticlecare.com.'
      setSendError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const firstName = form.name.trim().split(/\s+/)[0] || 'there'
  const summaryRows: { label: string; value: string }[] = []
  if (form.company.trim()) summaryRows.push({ label: 'Organisation', value: form.company.trim() })
  if (form.careType && careTypeLabels[form.careType]) summaryRows.push({ label: 'Care type', value: careTypeLabels[form.careType] })
  if (form.role && roleLabels[form.role]) summaryRows.push({ label: 'Role', value: roleLabels[form.role] })

  return (
    <MarketingLayout>
      <PageMeta
        title="Book a demo"
        description="Book a demo to see how MeticleCare can support your domiciliary or supported living care operation."
        canonicalPath="/contact"
      />
      <Box
        component="section"
        sx={{
          background: 'linear-gradient(180deg, #EAF3FC 0%, #F8FAFD 55%, #FFFFFF 100%)',
          pt: { xs: 4, md: 6 },
          pb: { xs: 10, md: 15 },
        }}
      >
        <Container maxWidth="lg">
          <div ref={topRef} />
          <Breadcrumb />
          <Grid container spacing={{ xs: 5, md: 12 }}>
            <Grid item xs={12} md={5}>
              <Box sx={{ pt: { md: 3 } }}>
                <EyebrowPill />
                <Typography
                  variant="h1"
                  sx={{
                    color: INK,
                    fontSize: { xs: '2.6rem', md: '3.9rem' },
                    fontWeight: 600,
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                    mb: 3,
                  }}
                >
                  Book a demo.
                </Typography>
                <Typography sx={{ color: SLATE, fontSize: '1.0625rem', lineHeight: 1.65, mb: 3 }}>
                  See how MeticleCare connects care delivery, scheduling, medication, risk, compliance
                  and reporting in one platform. We will shape the conversation around your service.
                </Typography>
                <Details />
                <WhatToExpect />
              </Box>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  bgcolor: '#fff',
                  borderRadius: '20px',
                  border: `1px solid ${FAINT}`,
                  boxShadow: '0 24px 48px rgba(12,27,46,0.14)',
                  p: { xs: 3, md: '40px' },
                }}
              >
                {submitted ? (
                  <Box sx={{ textAlign: 'center', py: { xs: 2, md: 3 } }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        bgcolor: MINT,
                        display: 'grid',
                        placeItems: 'center',
                        mx: 'auto',
                        mb: 3,
                      }}
                    >
                      <Check sx={{ fontSize: 28, color: TEAL_DEEP, fontWeight: 600 }} />
                    </Box>
                    <Typography sx={{ color: INK, fontWeight: 600, fontSize: '1.25rem', mb: 1 }}>
                      Thanks, {firstName} — we’ve got your request.
                    </Typography>
                    <Typography sx={{ color: SLATE, fontSize: '0.95rem', lineHeight: 1.6, mb: 3 }}>
                      We’ll reply to {form.email.trim()} within one business day to arrange a time
                      that suits your team.
                    </Typography>
                    {summaryRows.length > 0 && (
                      <Box
                        sx={{
                          bgcolor: MIST_GROUND,
                          borderRadius: '12px',
                          mb: 3,
                          textAlign: 'left',
                          overflow: 'hidden',
                        }}
                      >
                        {summaryRows.map((row, i) => (
                          <Stack
                            key={row.label}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            spacing={2}
                            sx={{
                              px: '16px',
                              py: '11px',
                              borderTop: i === 0 ? 'none' : `1px solid ${FAINT}`,
                            }}
                          >
                            <Typography sx={{ color: SLATE, fontSize: '0.85rem' }}>{row.label}</Typography>
                            <Typography sx={{ color: INK, fontSize: '0.85rem', fontWeight: 500, textAlign: 'right' }}>
                              {row.value}
                            </Typography>
                          </Stack>
                        ))}
                      </Box>
                    )}
                    <Button
                      variant="text"
                      endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                      onClick={() => navigate('/platform')}
                      sx={{ color: NAVY, fontWeight: 600, fontSize: '0.9rem', textTransform: 'none' }}
                    >
                      While you wait, explore the platform
                    </Button>
                  </Box>
                ) : (
                  <form onSubmit={handleSubmit} noValidate>
                    <Box sx={{ mb: '20px' }}>
                      <Typography sx={{ color: INK, fontSize: '1.3rem', fontWeight: 600, mb: '4px' }}>
                        Tell us about your service
                      </Typography>
                      <Typography sx={{ color: SLATE, fontSize: '0.85rem' }}>
                        Fields marked * are required.
                      </Typography>
                    </Box>
                    <Stack spacing="20px">
                      {sendError && <Alert severity="error">{sendError}</Alert>}
                      {submitAttempted && errorCount > 0 && (
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing="10px"
                          role="alert"
                          sx={{
                            bgcolor: ERROR_BG,
                            borderRadius: '10px',
                            px: '14px',
                            py: '12px',
                          }}
                        >
                          <ErrorOutline sx={{ fontSize: 18, color: ERROR, flexShrink: 0 }} />
                          <Typography sx={{ color: ERROR, fontSize: '0.85rem', lineHeight: 1.4 }}>
                            {errorCount === 1
                              ? '1 field needs attention before we can send your request.'
                              : `${errorCount} fields need attention before we can send your request.`}
                          </Typography>
                        </Stack>
                      )}
                      <Box sx={{ display: 'flex', gap: '16px', flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Field id="contact-name" label="Your name *" error={submitAttempted ? errors.name : undefined}>
                            <Box
                              component="input"
                              id="contact-name"
                              value={form.name}
                              onChange={update('name')}
                              placeholder="Your full name"
                              autoComplete="name"
                              sx={{ ...inputSx, ...(submitAttempted && errors.name ? inputErrorSx : null) }}
                            />
                          </Field>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Field id="contact-company" label="Organisation *" error={submitAttempted ? errors.company : undefined}>
                            <Box
                              component="input"
                              id="contact-company"
                              value={form.company}
                              onChange={update('company')}
                              placeholder="Care provider name"
                              autoComplete="organization"
                              sx={{ ...inputSx, ...(submitAttempted && errors.company ? inputErrorSx : null) }}
                            />
                          </Field>
                        </Box>
                      </Box>
                      <Field id="contact-email" label="Email address *" error={submitAttempted ? errors.email : undefined}>
                        <Box
                          component="input"
                          id="contact-email"
                          type="email"
                          value={form.email}
                          onChange={update('email')}
                          autoComplete="email"
                          sx={{ ...inputSx, ...(submitAttempted && errors.email ? inputErrorSx : null) }}
                        />
                      </Field>
                      <Box sx={{ display: 'flex', gap: '16px', flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Field id="contact-role" label="Role">
                            <Box sx={{ position: 'relative' }}>
                              <Box
                                component="select"
                                id="contact-role"
                                value={form.role}
                                onChange={update('role')}
                                sx={{
                                  ...inputSx,
                                  appearance: 'none',
                                  pr: '40px',
                                  color: form.role ? INK : SLATE,
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="">Select your role</option>
                                <option value="owner">Owner / Director</option>
                                <option value="registered-manager">Registered Manager</option>
                                <option value="operations">Operations Director</option>
                                <option value="compliance">Compliance Manager</option>
                                <option value="coordinator">Care Coordinator</option>
                                <option value="other">Other</option>
                              </Box>
                              <ExpandMore
                                sx={{
                                  position: 'absolute',
                                  right: 12,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: 18,
                                  color: SLATE,
                                  pointerEvents: 'none',
                                }}
                              />
                            </Box>
                          </Field>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Field id="contact-care-type" label="Care type">
                            <Box sx={{ position: 'relative' }}>
                              <Box
                                component="select"
                                id="contact-care-type"
                                value={form.careType}
                                onChange={update('careType')}
                                sx={{
                                  ...inputSx,
                                  appearance: 'none',
                                  pr: '40px',
                                  color: form.careType ? INK : SLATE,
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="">Select service type</option>
                                <option value="domiciliary">Domiciliary care</option>
                                <option value="supported-living">Supported living</option>
                                <option value="both">Both</option>
                                <option value="other">Other</option>
                              </Box>
                              <ExpandMore
                                sx={{
                                  position: 'absolute',
                                  right: 12,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: 18,
                                  color: SLATE,
                                  pointerEvents: 'none',
                                }}
                              />
                            </Box>
                          </Field>
                        </Box>
                      </Box>
                      <Field id="contact-message" label="How can we help? *" error={submitAttempted ? errors.message : undefined}>
                        <Box
                          component="textarea"
                          id="contact-message"
                          value={form.message}
                          onChange={update('message')}
                          rows={5}
                          sx={{
                            ...inputSx,
                            height: 120,
                            py: '12px',
                            px: '14px',
                            '&:focus': { px: '14px' },
                            resize: 'vertical',
                            lineHeight: 1.5,
                            ...(submitAttempted && errors.message ? inputErrorSx : null),
                          }}
                        />
                      </Field>
                      <input
                        value={form.website}
                        onChange={update('website')}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        style={{ display: 'none' }}
                      />
                      <CheckboxRow
                        checked={form.privacyConsent}
                        onChange={(checked) => {
                          setForm((c) => ({ ...c, privacyConsent: checked }))
                          if (submitAttempted && checked) {
                            setErrors((current) => {
                              const next = { ...current }
                              delete next.privacy
                              return next
                            })
                          }
                        }}
                        error={submitAttempted && !!errors.privacy}
                        label={
                          <>
                            I agree to the{' '}
                            <Link
                              href="/privacy"
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              sx={{ color: NAVY }}
                            >
                              Privacy Policy
                            </Link>
                            . *
                          </>
                        }
                      />
                      <CheckboxRow
                        checked={form.marketingConsent}
                        onChange={(checked) => setForm((c) => ({ ...c, marketingConsent: checked }))}
                        label="Send me occasional product updates and care-technology guidance."
                      />
                      <Button
                        type="submit"
                        disabled={submitting}
                        variant="contained"
                        disableElevation
                        endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
                        sx={{
                          width: '100%',
                          bgcolor: NAVY,
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          py: '14px',
                          borderRadius: '14px',
                          textTransform: 'none',
                          boxShadow:
                            '0 10px 24px rgba(1,99,199,0.28), 0 2px 4px rgba(1,99,199,0.20)',
                          '&:hover': { bgcolor: '#0157AD' },
                          '&:disabled': { bgcolor: NAVY, opacity: 0.7, color: '#fff' },
                        }}
                      >
                        {submitting ? 'Sending…' : 'Book a demo'}
                      </Button>
                      <Typography sx={{ color: SLATE, fontSize: '0.82rem', lineHeight: 1.6 }}>
                        We use your details to respond to this enquiry. Optional updates are sent only
                        if you opt in. You can unsubscribe at any time.
                      </Typography>
                    </Stack>
                  </form>
                )}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
