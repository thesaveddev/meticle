/**
 * Throwaway verification for the marketing opt-out.
 *
 * The Marketing tool's own driver (better-sqlite3) has no native build on this
 * machine, so this runs the real modules against the same SQL through Node's
 * built-in SQLite, and the real sender against a fake transport. Nothing of the
 * behaviour under test is mocked — only the driver and the SMTP socket.
 *
 * Run: npx tsx verify-unsubscribe.cts   (then delete)
 */
import express from 'express'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

// A secret, so the link is signed: without one the module deliberately falls back
// to accepting an unsigned link (and says so on stderr).
process.env.MARKETING_UNSUBSCRIBE_SECRET = 'verify-only-secret'

const sqlite = new DatabaseSync(':memory:')
sqlite.exec(`
  CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT NOT NULL,
    contact_email TEXT,
    status TEXT DEFAULT 'new',
    campaign_stage INTEGER DEFAULT 0,
    last_contacted TEXT,
    next_followup TEXT,
    unsubscribed_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    template_name TEXT,
    subject TEXT,
    status TEXT DEFAULT 'sent'
  );
  CREATE TABLE email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL
  );
  INSERT INTO email_templates (name, subject, body_html)
    VALUES ('intro', 'Readiness for {{provider_name}}', '<p>Hi {{contact_name}}</p>');
`)

// Swap the driver, not the code: every query below is the module's own SQL. The
// module is replaced in the require cache rather than patched, because the
// compiled export is a getter and assigning to it is silently ignored.
const Module = require('node:module')
function fakeModule(modulePath: string, exports: unknown) {
  const stub = new Module(modulePath)
  stub.filename = modulePath
  stub.loaded = true
  stub.exports = exports
  require.cache[modulePath] = stub
}

const dbPath = require.resolve('./src/db/database')
fakeModule(dbPath, {
  getDb: () => ({
    prepare: (sql: string) => ({
      get: (...params: unknown[]) => sqlite.prepare(sql).get(...(params as any[])),
      all: (...params: unknown[]) => sqlite.prepare(sql).all(...(params as any[])),
      run: (...params: unknown[]) => sqlite.prepare(sql).run(...(params as any[])),
    }),
  }),
})

/** Every message the sender tried to put on the wire. */
const sentMails: any[] = []
// Flat, exactly like the real CJS module: the compiled `import nodemailer from
// 'nodemailer'` reads `.default`, which the interop fills with `module.exports`.
fakeModule(require.resolve('nodemailer'), {
  createTransport: () => ({
    sendMail: async (opts: any) => {
      sentMails.push(opts)
      return { accepted: [opts.to], messageId: `<${sentMails.length}@verify>` }
    },
  }),
})

const {
  appendUnsubscribeFooter,
  isUnsubscribed,
  unsubscribeHeaders,
  unsubscribeUrl,
  verifyUnsubscribeSignature,
} = require('./src/email/unsubscribe')
const unsubscribeRoutes = require('./src/routes/unsubscribe').default

const leadId = Number(
  sqlite
    .prepare(`INSERT INTO leads (provider_name, contact_email, status) VALUES (?, ?, 'new')`)
    .run('Test Care Ltd', 'lead@example.com').lastInsertRowid,
)

let failures = 0
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures++
    console.log(`  FAIL ${name}: ${(err as Error).message}`)
  }
}

async function main() {
  const url: string = unsubscribeUrl(leadId)
  const signature = new URL(url).searchParams.get('sig')!
  const withFooter: string = appendUnsubscribeFooter('<p>Hi</p>', url, 'Test Care Ltd')

  await check('the footer carries the way out, and no unrendered placeholder', () => {
    assert.ok(withFooter.includes('Test Care Ltd'))
    assert.ok(withFooter.includes(`href="${url}"`), 'the footer must link to the signed URL')
    assert.ok(!withFooter.includes('{{'), 'a placeholder here would reach the recipient literally')
  })

  await check('the mail-client header names the same URL as the footer', () => {
    const headers: Record<string, string> = unsubscribeHeaders(url)
    assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
    assert.ok(headers['List-Unsubscribe'].includes(url))
  })

  await check('a forged or missing signature is refused', () => {
    assert.equal(verifyUnsubscribeSignature(leadId, 'forged'), false)
    assert.equal(verifyUnsubscribeSignature(leadId, null), false)
    assert.equal(verifyUnsubscribeSignature(leadId + 1, signature), false, 'one lead cannot use another lead’s link')
    assert.equal(verifyUnsubscribeSignature(leadId, signature), true)
  })

  const app = express()
  app.use(express.urlencoded({ extended: false }))
  app.use('/', unsubscribeRoutes)
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const port = (server.address() as { port: number }).port
  const base = `http://127.0.0.1:${port}`
  const link = `${base}/u/${leadId}?sig=${encodeURIComponent(signature)}`

  await check('GET shows the confirmation and changes nothing', async () => {
    const res = await fetch(link)
    assert.equal(res.status, 200)
    assert.ok((await res.text()).includes('Stop these emails?'))
    assert.equal(isUnsubscribed(leadId), false, 'a link scanner must not unsubscribe anybody')
  })

  await check('GET with a forged signature is refused', async () => {
    const res = await fetch(`${base}/u/${leadId}?sig=forged`)
    assert.equal(res.status, 400)
    assert.equal(isUnsubscribed(leadId), false)
  })

  await check("a mail client's one-click POST records the opt-out", async () => {
    const res = await fetch(link, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    assert.equal(res.status, 200)
    assert.equal(isUnsubscribed(leadId), true)
  })

  await check('the lead is marked and its follow-up is cleared', () => {
    const row = sqlite
      .prepare('SELECT unsubscribed_at, next_followup FROM leads WHERE id = ?')
      .get(leadId) as { unsubscribed_at: string | null; next_followup: string | null }
    assert.ok(row.unsubscribed_at, 'unsubscribed_at must be set')
    assert.equal(row.next_followup, null)
  })

  await check('a second POST is still a 2xx', async () => {
    assert.equal((await fetch(link, { method: 'POST' })).status, 200)
    assert.ok(isUnsubscribed(leadId))
  })

  const { sendEmail, sendCampaign } = require('./src/email/sender')

  await check('no email is sent to an opted-out lead, by hand or by campaign', async () => {
    sentMails.length = 0
    await sendEmail(leadId, 'intro')
    const campaign = await sendCampaign('new', 'intro', 5)
    assert.equal(sentMails.length, 0, 'nothing may leave the building for an opted-out lead')
    assert.equal(campaign.sent, 0)
  })

  await check('a lead who has not opted out is mailed, and the message carries the link', async () => {
    const otherId = Number(
      sqlite
        .prepare(`INSERT INTO leads (provider_name, contact_email, status) VALUES (?, ?, 'new')`)
        .run('Other Care Ltd', 'other@example.com').lastInsertRowid,
    )
    sentMails.length = 0
    const ok = await sendEmail(otherId, 'intro')
    assert.equal(ok, true, 'a send to a live lead has to still work')
    assert.equal(sentMails.length, 1)
    const mail = sentMails[0]
    assert.ok(mail.html.includes(`/u/${otherId}?sig=`), 'the message must carry its own signed way out')
    assert.ok(mail.html.includes('Unsubscribe'))
    assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
    assert.ok(mail.headers['List-Unsubscribe'].includes(`/u/${otherId}?sig=`))
  })

  server.close()
  console.log(failures === 0 ? '\nAll marketing unsubscribe checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
