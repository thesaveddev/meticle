import { EMAIL_BRAND } from './email.template';

/**
 * Security notice that lives *outside* the white card (under the CTA) — where
 * the web auth pages put their reassurance copy. The send* helpers append this
 * after buildTransactionalEmailHtml's closing table; it reuses the same 600px
 * table so widths match across clients.
 */
export function EmailSecurityNoticeHtml(text: string): string {
  return `
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr>
<td style="background:${EMAIL_BRAND.infoSoft};border:1px solid ${EMAIL_BRAND.infoBorder};border-radius:12px;padding:14px 20px;font-size:13px;color:${EMAIL_BRAND.infoText};line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${text}
</td>
</tr></table>`;
}
