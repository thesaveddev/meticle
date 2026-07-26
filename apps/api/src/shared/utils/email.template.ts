function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function emailLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#F4F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6F8"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 0 24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left" style="font-size:22px;font-weight:800;color:#0F4C81;letter-spacing:-0.5px">Meticle</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
${body}
</td></tr>
<tr><td style="padding:24px 0 0 0;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.6">
Meticle &mdash; Care operations, unified.<br>
<a href="${process.env.FRONTEND_URL || 'https://meticlecare.com'}" style="color:#0F4C81;text-decoration:none">${process.env.FRONTEND_URL || 'https://meticlecare.com'}</a>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`
}

export function buildEmailHtml(title: string, heading: string, content: string, cta?: { label: string; url: string }) {
  title = escapeHtml(title);
  heading = escapeHtml(heading);
  const ctaHtml = cta
    ? `<tr><td style="padding:24px 0 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#0F4C81;border-radius:8px;text-align:center;padding:0"><a href="${cta.url}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${cta.label}</a></td></tr></table></td></tr>`
    : ''

  return emailLayout(
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:700;color:#1F2937;padding:0 0 16px 0">${heading}</td></tr>
<tr><td style="font-size:14px;color:#4B5563;line-height:1.7">${content}</td></tr>
${ctaHtml}
<tr><td style="padding:20px 0 0 0;border-top:1px solid #F3F4F6;margin-top:20px;font-size:12px;color:#9CA3AF;line-height:1.5">
If the button above doesn't work, copy and paste this link into your browser:<br>
<a href="${(cta?.url) || ''}" style="color:#0F4C81;word-break:break-all">${(cta?.url) || ''}</a>
</td></tr>
</table>`
  )
}

export function buildCodeEmailHtml(code: string) {
  return emailLayout(
    'Your Verification Code',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:700;color:#1F2937;padding:0 0 16px 0">Verify your email address</td></tr>
<tr><td style="font-size:14px;color:#4B5563;line-height:1.7">Use the code below to verify your email and complete your Meticle registration. This code expires in 10 minutes.</td></tr>
<tr><td style="padding:24px 0;text-align:center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background-color:#F3F4F6;border-radius:12px;padding:16px 32px;text-align:center">
<span style="font-size:32px;font-weight:800;color:#0F4C81;letter-spacing:8px;font-family:'Courier New',monospace">${code}</span>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:12px 0 0 0;border-top:1px solid #F3F4F6;font-size:12px;color:#9CA3AF;line-height:1.5">
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
  const colors = { approved: '#065F46', rejected: '#991B1B', pending: '#92400E', info: '#0F4C81' }
  const bgColors = { approved: '#D1FAE5', rejected: '#FEE2E2', pending: '#FEF3C7', info: '#E7EEF4' }
  const color = colors[status]
  const bgColor = bgColors[status]

  const detailsHtml = details.map(d => `<tr><td style="padding:4px 0;font-size:14px;color:#4B5563">${d}</td></tr>`).join('')

  const ctaHtml = cta
    ? `<tr><td style="padding:20px 0 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#0F4C81;border-radius:8px;text-align:center;padding:0"><a href="${cta.url}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${cta.label}</a></td></tr></table></td></tr>`
    : ''

  return emailLayout(
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 20px 0">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr><td style="background-color:${bgColor};color:${color};font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.3px">${statusLabel}</td></tr>
</table>
</td></tr>
<tr><td style="font-size:20px;font-weight:700;color:#1F2937;padding:0 0 16px 0">${heading}</td></tr>
${detailsHtml}
${ctaHtml}
</table>`
  )
}
