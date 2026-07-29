function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function emailLayout(title: string, body: string) {
  const domain = 'meticle.com';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 0 32px 0;text-align:center">
<span style="font-size:24px;font-weight:800;color:#0F4C81;letter-spacing:-0.5px">Meticle</span>
</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
${body}
</td></tr>
<tr><td style="padding:32px 0 0 0;text-align:center;font-size:13px;color:#9CA3AF;line-height:1.7">
<span style="font-weight:600;color:#6B7280">Meticle</span><br>
Care operations, unified.<br>
<a href="${process.env.FRONTEND_URL || `https://${domain}`}" style="color:#0F4C81;text-decoration:none;font-weight:600">${domain}</a>
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
    ? `<tr><td style="padding:28px 0 8px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0F4C81;border-radius:10px;text-align:center;padding:0"><a href="${cta.url}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px">${cta.label}</a></td></tr></table></td></tr>`
    : ''

  return emailLayout(
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:800;color:#111827;padding:0 0 20px 0;letter-spacing:-0.3px">${heading}</td></tr>
<tr><td style="font-size:15px;color:#4B5563;line-height:1.7">${content}</td></tr>
${ctaHtml}
<tr><td style="padding:24px 0 0 0;border-top:1px solid #F3F4F6;margin-top:24px;font-size:13px;color:#9CA3AF;line-height:1.6">
If the button doesn't work, paste this link in your browser:<br>
<a href="${(cta?.url) || ''}" style="color:#0F4C81;word-break:break-all;font-weight:500">${(cta?.url) || ''}</a>
</td></tr>
</table>`
  )
}

export function buildCodeEmailHtml(code: string) {
  return emailLayout(
    'Your Verification Code',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:800;color:#111827;padding:0 0 16px 0;letter-spacing:-0.3px">Verify your email address</td></tr>
<tr><td style="font-size:15px;color:#4B5563;line-height:1.7">Use the code below to verify your email and complete your Meticle registration. This code expires in 10 minutes.</td></tr>
<tr><td style="padding:28px 0;text-align:center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background:#F3F4F6;border-radius:12px;padding:18px 40px;text-align:center">
<span style="font-size:34px;font-weight:800;color:#0F4C81;letter-spacing:10px;font-family:'Courier New',monospace">${code}</span>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 0 0 0;border-top:1px solid #F3F4F6;font-size:13px;color:#9CA3AF;line-height:1.6">
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

  const detailsHtml = details.map(d => `<tr><td style="padding:6px 0;font-size:15px;color:#4B5563;line-height:1.6">${d}</td></tr>`).join('')

  const ctaHtml = cta
    ? `<tr><td style="padding:24px 0 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0F4C81;border-radius:10px;text-align:center;padding:0"><a href="${cta.url}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px">${cta.label}</a></td></tr></table></td></tr>`
    : ''

  return emailLayout(
    title,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 24px 0">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr><td style="background:${bgColor};color:${color};font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;text-transform:uppercase;letter-spacing:0.4px">${statusLabel}</td></tr>
</table>
</td></tr>
<tr><td style="font-size:22px;font-weight:800;color:#111827;padding:0 0 20px 0;letter-spacing:-0.3px">${heading}</td></tr>
${detailsHtml}
${ctaHtml}
</table>`
  )
}
