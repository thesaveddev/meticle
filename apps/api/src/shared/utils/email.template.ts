function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeUrl(url: string): string {
  return escapeHtml(url);
}

function emailLayout(title: string, body: string) {
  const domain = 'meticlecare.com';
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_BRAND.textPrimary}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.pageBg}"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 0 24px 0;text-align:left">${EmailLogo()}</td></tr>
<tr><td style="background:${EMAIL_BRAND.surface};border:1px solid ${EMAIL_BRAND.border};border-radius:16px;padding:36px 32px">
${body}
</td></tr>
<tr><td style="padding:24px 4px 0;text-align:left;font-size:12px;color:${EMAIL_BRAND.textMuted};line-height:1.7">
<span style="font-weight:700;color:${EMAIL_BRAND.textSecondary}">MeticleCare</span> · Care operations, unified.<br>
<a href="${escapeUrl(process.env.FRONTEND_URL || `https://${domain}`)}" style="color:${EMAIL_BRAND.primary};text-decoration:underline">${domain}</a>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Web-brand transactional templates.
//
// The web authentication experience (apps/web/src/components/auth) uses the
// app's blue brand (#2F80ED family, --mc-primary) on an almost-white canvas
// with a white card. These builders give the transactional emails the same
// product feel: near-white page, white surface, one primary CTA, a soft blue
// security panel, and a shared footer. Email-safe throughout: table layout,
// inline styles only, system font stack, no external fonts or images except
// the wordmark rendered as text (safe in Outlook and dark mode).
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_BRAND = {
  pageBg: '#F7F9FC',
  surface: '#FFFFFF',
  border: '#E4EAF2',
  primary: '#2F80ED',
  primaryDeep: '#1F68C7',
  textPrimary: '#101828',
  textSecondary: '#667085',
  textMuted: '#98A2B3',
  infoSoft: '#EFF8FF',
  infoBorder: '#D6E9FF',
  infoText: '#175CD3',
  footerMuted: '#98A2B3',
} as const;

/**
 * Semantic text/line tokens. The legacy builders and body markup hard-coded
 * a near-identical Tailwind gray ramp; these names give every template one
 * vocabulary so a palette change is a one-line edit per token, not a
 * repo-wide hex sweep. Values keep the same visual weight as before.
 */
export const EMAIL_TEXT = {
  /** Strongest ink — headings and key figures. */
  heading: '#101828',
  /** Legacy inline markup used #111827/#1F2937 for the same job. */
  body: '#111827',
  /** Paragraph copy. */
  paragraph: '#4B5563',
  /** Secondary copy, table headers, captions. */
  secondary: '#6B7280',
  /** Faintest copy — legal lines, timestamps. */
  muted: '#9CA3AF',
  /** Table/rules hairlines. */
  line: '#E5E7EB',
  /** Row striping and soft panels inside the card. */
  panelBg: '#F9FAFB',
  /** Semantic status tones shared by the digest and audit templates. */
  toneOk: '#166534',
  toneWarn: '#B45309',
  toneBad: '#B91C1C',
} as const;

/** Text wordmark — never an image, so dark mode and Outlook cannot break it. */
export function EmailLogo(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:21px;font-weight:700;color:${EMAIL_BRAND.primary};letter-spacing:-0.4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">Meticle<span style="font-weight:400">Care</span></td>
</tr></table>`;
}

/** Single primary CTA — the only button any transactional email should carry. */
export function EmailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="background:${EMAIL_BRAND.primary};border-radius:12px;text-align:center">
<a href="${escapeUrl(url)}" style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${escapeHtml(label)}</a>
</td>
</tr></table>`;
}

export function EmailFooter(): string {
  const year = new Date().getFullYear();
  const domain = 'meticlecare.com';
  const base = process.env.FRONTEND_URL || `https://${domain}`;
  return `<tr><td style="padding:28px 8px 0;text-align:center;font-size:12px;color:${EMAIL_BRAND.footerMuted};line-height:1.8">
<span style="font-weight:700;color:${EMAIL_BRAND.textSecondary}">MeticleCare</span><br>
Care operations, unified.<br>
<a href="${escapeUrl(base)}/privacy" style="color:${EMAIL_BRAND.footerMuted};text-decoration:underline">Privacy Policy</a>
&nbsp;|&nbsp;
<a href="${escapeUrl(base)}/terms" style="color:${EMAIL_BRAND.footerMuted};text-decoration:underline">Terms of Service</a>
&nbsp;|&nbsp;
<a href="${escapeUrl(base)}/contact" style="color:${EMAIL_BRAND.footerMuted};text-decoration:underline">Help Centre</a><br>
© ${year} MeticleCare.<br>
MeticleCare is a product of 34 Orients Ltd. Cardiff, United Kingdom.
</td></tr>`;
}

/**
 * The shared transactional shell. Every auth email composes this, so the
 * password reset, verification and welcome emails read as one product — the
 * same shell the web auth pages use, translated to email-safe markup.
 */
export function buildTransactionalEmailHtml({
  title,
  heading,
  bodyHtml,
  cta,
}: {
  title: string;
  heading: string;
  /** Already-escaped HTML paragraphs. */
  bodyHtml: string;
  cta?: { label: string; url: string };
}): string {
  const ctaHtml = cta ? `<tr><td style="padding:26px 0 0 0">${EmailButton(cta.label, cta.url)}</td></tr>` : '';
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_BRAND.textPrimary}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.pageBg}"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 0 24px 0">${EmailLogo()}</td></tr>
<tr><td style="background:${EMAIL_BRAND.surface};border:1px solid ${EMAIL_BRAND.border};border-radius:20px;padding:40px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:26px;font-weight:700;color:${EMAIL_BRAND.textPrimary};letter-spacing:-0.4px;padding:0 0 14px 0">${escapeHtml(heading)}</td></tr>
<tr><td style="font-size:15px;color:${EMAIL_BRAND.textSecondary};line-height:1.7">${bodyHtml}</td></tr>
${ctaHtml}
</table>
</td></tr>
${EmailFooter()}
</table>
</td></tr></table>
</body>
</html>`;
}

// ── Existing builders (legacy palette, still used by other flows) ──────────

export function buildEmailHtml(title: string, heading: string, content: string, cta?: { label: string; url: string }) {
  title = escapeHtml(title);
  heading = escapeHtml(heading);
  const ctaHtml = cta
    ? `<tr><td style="padding:24px 0 4px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${EMAIL_BRAND.primary};border-radius:6px;text-align:center;padding:0"><a href="${escapeUrl(cta.url)}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(cta.label)}</a></td></tr></table></td></tr>`
    : ''

  return emailLayout(
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:21px;font-weight:700;color:${EMAIL_TEXT.heading};padding:0 0 16px 0;letter-spacing:-0.2px">${heading}</td></tr>
<tr><td style="font-size:15px;color:${EMAIL_TEXT.paragraph};line-height:1.65">${content}</td></tr>
${ctaHtml}
<tr><td style="padding:20px 0 0 0;border-top:1px solid ${EMAIL_TEXT.line};margin-top:20px;font-size:12px;color:${EMAIL_TEXT.secondary};line-height:1.5">
This message was sent by Meticle Care because it relates to your account or subscription.
</td></tr>
</table>`
  )
}

export function buildCodeEmailHtml(code: string) {
  return emailLayout(
    'Your Verification Code',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:800;color:${EMAIL_TEXT.heading};padding:0 0 16px 0;letter-spacing:-0.3px">Verify your email address</td></tr>
<tr><td style="font-size:15px;color:${EMAIL_TEXT.paragraph};line-height:1.7">Use the code below to verify your email and complete your Meticle Care registration. This code expires in 10 minutes.</td></tr>
<tr><td style="padding:28px 0;text-align:center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background:${EMAIL_TEXT.panelBg};border-radius:12px;padding:18px 40px;text-align:center">
<span style="font-size:34px;font-weight:800;color:${EMAIL_BRAND.primaryDeep};letter-spacing:10px;font-family:'Courier New',monospace">${code}</span>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 0 0 0;border-top:1px solid ${EMAIL_TEXT.panelBg};font-size:13px;color:${EMAIL_TEXT.muted};line-height:1.6">
If you didn't request this code, you can safely ignore this email.
</td></tr>
</table>`
  )
}

export function buildStatusEmailHtml(
  title: string,
  heading: string,
  status: 'approved' | 'rejected' | 'pending' | 'info',
  statusLabel: string,
  details: string[],
  cta?: { label: string; url: string }
) {
  title = escapeHtml(title);
  heading = escapeHtml(heading);
  const colors = { approved: '#067647', rejected: '#B42318', pending: '#B54708', info: EMAIL_BRAND.primaryDeep }
  const bgColors = { approved: '#ECFDF3', rejected: '#FEF3F2', pending: '#FFFAEB', info: '#E7EEF4' }
  const color = colors[status]
  const bgColor = bgColors[status]

  const detailsHtml = details.map(d => `<tr><td style="padding:6px 0;font-size:15px;color:${EMAIL_TEXT.paragraph};line-height:1.6">${d}</td></tr>`).join('')

  const ctaHtml = cta
    ? `<tr><td style="padding:24px 0 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${EMAIL_BRAND.primary};border-radius:12px;text-align:center;padding:0"><a href="${cta.url}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:0.2px">${cta.label}</a></td></tr></table></td></tr>`
    : ''

  return emailLayout(
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 18px 0">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr><td style="background:${bgColor};color:${color};font-size:11px;font-weight:700;padding:5px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.3px">${escapeHtml(statusLabel)}</td></tr>
</table>
</td></tr>
<tr><td style="font-size:21px;font-weight:700;color:${EMAIL_TEXT.heading};padding:0 0 16px 0;letter-spacing:-0.2px">${heading}</td></tr>
${detailsHtml}
${ctaHtml}
</table>`
  )
}
