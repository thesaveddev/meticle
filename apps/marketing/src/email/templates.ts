import { getDb } from '../db/database'

export function seedTemplates() {
  const db = getDb()

  const templates = [
    {
      name: 'intro',
      subject: 'Your compliance readiness score — {{provider_name}}',
      body_html: `<p>Hi {{contact_name}},</p>
<p>I built a tool that calculates a care provider's readiness score across the domains their own regulator uses — for CQC, Safe, Effective, Caring, Responsive and Well-led — from your actual records. It also generates your evidence pack in one click.</p>
<p>{{rating_line}}</p>
<p>I can show you in a free 15-minute demo. You'll see your actual compliance gaps and get a sample evidence pack.</p>
<p>Reply to this email or book a time here: <a href="{{tracking_link}}?action=book">{{tracking_link_display}}</a></p>
<p>Best,<br/>Meticle Care</p>`
    },
    {
      name: 'follow_up',
      subject: 'Re: Your CQC evidence pack — {{provider_name}}',
      body_html: `<p>Hi {{contact_name}},</p>
<p>Just following up on my previous email. I know how overwhelming a regulatory inspection can be, whichever of the four regulators you are registered with.</p>
<p>Meticle Care gives you:</p>
<ul>
  <li>A readiness score across the domains your own regulator uses — calculated from real records, not estimates</li>
  <li>AI gap analysis showing exactly what to fix</li>
  <li>One-click evidence packs, labelled with your regulator rather than someone else's</li>
  <li>Multi-regulator support: CQC, CIW, Care Inspectorate, RQIA</li>
</ul>
<p>{{provider_name}}'s own regulator is <strong>{{regulator}}</strong>, so that is the framework your evidence pack will be measured against. Let me show you where the gaps are — no commitment.</p>
<p>Reply or book here: <a href="{{tracking_link}}?action=book">{{tracking_link_display}}</a></p>
<p>Best,<br/>Meticle Care</p>`
    },
    {
      name: 'evidence_pack',
      subject: 'Here\'s what your evidence pack would look like — {{provider_name}}',
      body_html: `<p>Hi {{contact_name}},</p>
<p>I've generated a sample evidence pack for {{provider_name}}, laid out against the framework <strong>{{regulator}}</strong> uses. It shows:</p>
<ul>
  <li>Staff compliance status across all requirements</li>
  <li>Training matrix with completion rates</li>
  <li>Identity document expiry tracking</li>
  <li>Competency assessment records</li>
  <li>Person care plan coverage</li>
  <li>Incident log with severity classification</li>
</ul>
<p>All organised by CQC's 5 Key Lines of Enquiry. This is what inspectors expect — and what Meticle Care generates automatically.</p>
<p><strong>Want to see your real data in this format?</strong> Let's do a 15-minute call.</p>
<p><a href="{{tracking_link}}?action=book">Book a demo →</a></p>
<p>Best,<br/>Meticle Care</p>`
    },
  ]

  const insert = db.prepare('INSERT OR IGNORE INTO email_templates (name, subject, body_html) VALUES (?, ?, ?)')
  for (const t of templates) {
    insert.run(t.name, t.subject, t.body_html)
  }
}

export function getTemplate(name: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM email_templates WHERE name = ?').get(name) as any
}

export function renderTemplate(templateName: string, vars: Record<string, string>): { subject: string; html: string } {
  const db = getDb()
  const template = db.prepare('SELECT * FROM email_templates WHERE name = ?').get(templateName) as any
  if (!template) throw new Error(`Template "${templateName}" not found`)

  let subject = template.subject
  let html = template.body_html

  // Replace {{variable}} placeholders
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    subject = subject.replace(regex, value || '')
    html = html.replace(regex, value || '')
  }

  // Remove unmatched {{#conditional}}...{{/conditional}} blocks
  html = html.replace(/\{\{#\w+\}\}.*?\{\{\/\w+\}\}/gs, '')

  // Add tracking pixel
  html += `<img src="{{tracking_pixel}}" width="1" height="1" style="display:none" />`

  return { subject, html }
}
