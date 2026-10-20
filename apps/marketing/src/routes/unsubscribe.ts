import { Router, Request, Response } from 'express'
import {
  isUnsubscribed,
  recordUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribeSignature,
} from '../email/unsubscribe'

/**
 * The public opt-out, at `/u/:leadId`.
 *
 * One route for both audiences, deliberately: a person clicking the footer link
 * gets a page that states what will stop and asks them to confirm, and a mail
 * client's one-click button POSTs to the same address and gets a 2xx. A GET only
 * renders — scanner software and link previews follow URLs in email, and a link
 * that unsubscribed on fetch would take providers off the list who never asked.
 *
 * No sign-in, obviously: the recipient has no account here. The signature is what
 * stands in for one.
 */

const NAVY = '#0F4C81'
const INK = '#1B2430'
const MUTED = '#5D6E85'

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex">
</head>
<body style="margin:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
  <main style="max-width:520px;margin:0 auto;padding:64px 24px">
    <div style="background:#fff;border:1px solid #E6E1D7;border-radius:14px;padding:32px">
      <h1 style="margin:0 0 12px;font-size:20px;color:${INK}">${title}</h1>
      ${body}
    </div>
  </main>
</body>
</html>`
}

function confirmPage(leadId: string, sig: string): string {
  const action = `/u/${encodeURIComponent(leadId)}${sig ? `?sig=${encodeURIComponent(sig)}` : ''}`
  return page(
    'Stop these emails?',
    `<p style="margin:0 0 16px;line-height:1.7;color:${MUTED}">We will stop emailing this address and will not add it to another campaign.</p>
     <form method="post" action="${action}">
       <button type="submit" style="background:${NAVY};color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer">Unsubscribe</button>
     </form>
     <p style="margin:16px 0 0;font-size:13px;color:${MUTED}">Changed your mind? Just close this page — nothing has changed yet.</p>`,
  )
}

function donePage(): string {
  return page(
    'You are unsubscribed',
    `<p style="margin:0 0 8px;line-height:1.7;color:${MUTED}">We will not email this address again. If a message is already on its way, that will be the last one.</p>`,
  )
}

function invalidPage(): string {
  return page(
    'This link is not valid',
    `<p style="margin:0;line-height:1.7;color:${MUTED}">The link may have been shortened by your mail client. Reply to the message you received and we will take you off the list by hand.</p>`,
  )
}

const router = Router()

router.get('/u/:leadId', (req: Request, res: Response) => {
  const { leadId } = req.params
  const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
  if (!verifyUnsubscribeSignature(leadId, sig)) {
    res.status(400).type('html').send(invalidPage())
    return
  }
  // Already out: say so rather than asking again, so a second click is not
  // mistaken for a failed one.
  res.status(200).type('html').send(isUnsubscribed(leadId) ? donePage() : confirmPage(leadId, sig))
})

router.post('/u/:leadId', (req: Request, res: Response) => {
  const { leadId } = req.params
  const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
  if (!verifyUnsubscribeSignature(leadId, sig)) {
    res.status(400).type('html').send(invalidPage())
    return
  }
  try {
    recordUnsubscribe(leadId)
  } catch (err) {
    console.error('Failed to record unsubscribe:', (err as Error).message)
    res.status(500).type('html').send(invalidPage())
    return
  }
  console.log(`Unsubscribe recorded for lead ${leadId}`)
  res.status(200).type('html').send(donePage())
})

export default router
