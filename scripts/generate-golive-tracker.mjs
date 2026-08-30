#!/usr/bin/env node
import { execSync } from 'child_process';
try { require.resolve('exceljs'); } catch { execSync('npm install exceljs --no-save', { stdio: 'inherit' }); }
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const wb = new ExcelJS.Workbook();
wb.creator = 'MeticleCare';
wb.created = new Date();

// ─── Sheet 1: Go-Live Readiness Checklist ───
const ws1 = wb.addWorksheet('Go-Live Readiness', { views: [{ state: 'frozen', ySplit: 1 }] });

ws1.columns = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Item', key: 'item', width: 45 },
  { header: 'Description', key: 'description', width: 55 },
  { header: 'Owner', key: 'owner', width: 16 },
  { header: 'Est. Effort', key: 'effort', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
  { header: '% Complete', key: 'pct', width: 12 },
  { header: 'Target Date', key: 'targetDate', width: 14 },
  { header: 'Notes / Blockers', key: 'notes', width: 40 },
];

// Style header
ws1.getRow(1).eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = { bottom: { style: 'medium', color: { argb: 'FF0A3A5C' } } };
});

const items = [
  // CRITICAL
  { id: 'CRIT-01', priority: '🔴 CRITICAL', category: 'Security', item: 'Penetration test', description: 'Hire CREST/CHECK-certified pen tester to test auth bypass, IDOR, SQL injection, XSS, API rate limiting, health data leakage', owner: '', effort: '1-2 weeks', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'CRIT-02', priority: '🔴 CRITICAL', category: 'Legal / GDPR', item: 'Data Protection Impact Assessment (DPIA)', description: 'Required under UK GDPR Article 35 for processing special category health data at scale. Must cover lawful basis, data minimisation, retention, international transfers, AI automated decision-making', owner: '', effort: '1 week', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'CRIT-03', priority: '🔴 CRITICAL', category: 'QA', item: 'Run full QA test pack', description: 'Execute all 381 test cases in docs/MeticleCare_QA_UAT_Test_Pack.xlsx. Fill in Pass/Fail and Comments. Return for bug fixes', owner: '', effort: '3-5 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'CRIT-04', priority: '🔴 CRITICAL', category: 'Security', item: 'SSL certificates verified', description: 'Verify production has valid SSL certs with auto-renewal configured. Test HTTPS on all endpoints', owner: '', effort: '1 hour', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'CRIT-05', priority: '🔴 CRITICAL', category: 'Data', item: 'Backup & recovery testing', description: 'Perform test database restore from backup. Verify data integrity. Document RTO/RPO. Test point-in-time recovery', owner: '', effort: '1 day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'CRIT-06', priority: '🔴 CRITICAL', category: 'Infrastructure', item: 'Database connection pooling verified', description: 'Verify PgBouncer or equivalent is configured. Test connection pool exhaustion under load. Set up connection pool monitoring', owner: '', effort: 'Half day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'CRIT-07', priority: '🔴 CRITICAL', category: 'Legal / GDPR', item: 'DPIA reviewed by DPO or legal counsel', description: 'The DPIA document must be reviewed and signed off by a qualified Data Protection Officer or solicitor before launch', owner: '', effort: '1-2 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },

  // HIGH
  { id: 'HIGH-01', priority: '🟠 HIGH', category: 'Legal / GDPR', item: 'ICO registration', description: 'Register as data controller with ICO (ico.org.uk). Required if processing personal data. Currently £40-60/year for small orgs', owner: '', effort: '1 hour', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-02', priority: '🟠 HIGH', category: 'Monitoring', item: 'Uptime monitoring & alerting', description: 'Set up uptime monitoring (UptimeRobot, Betterstack, or similar). Configure alerts for API downtime, high error rates, database issues, disk space', owner: '', effort: '2-3 hours', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-03', priority: '🟠 HIGH', category: 'Legal', item: 'Solicitor review — Terms of Use', description: 'Have a solicitor review Terms of Use for enforceability, limitation of liability, indemnification clauses specific to health/social care software', owner: '', effort: '1-2 weeks', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-04', priority: '🟠 HIGH', category: 'Legal', item: 'Solicitor review — Privacy Policy', description: 'Review Privacy Policy for UK GDPR compliance. Ensure lawful basis for processing health data is clearly documented. Verify data subject rights are covered', owner: '', effort: '1-2 weeks', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-05', priority: '🟠 HIGH', category: 'Legal', item: 'Create standalone DPA document', description: 'The Terms of Use references a Data Processing Agreement. Create a standalone DPA for care homes signing up as data controllers', owner: '', effort: '3-5 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-06', priority: '🟠 HIGH', category: 'Legal', item: 'Cookie policy accuracy review', description: 'Verify Cookie Policy accurately reflects all cookies used. Update if any analytics or tracking is added post-launch', owner: '', effort: '2 hours', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-07', priority: '🟠 HIGH', category: 'Insurance', item: 'Professional indemnity insurance', description: 'Obtain PI insurance covering software defects that could cause harm in a care setting. Also consider cyber liability insurance for data breach', owner: '', effort: '1 week', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-08', priority: '🟠 HIGH', category: 'Infrastructure', item: 'Redis configured for Socket.IO', description: 'Verify Redis adapter is configured for horizontal scaling of real-time features (chat, notifications, mission control). Test with multiple API instances', owner: '', effort: 'Half day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-09', priority: '🟠 HIGH', category: 'Security', item: 'API key rotation policy', description: 'Implement or document a policy for rotating API keys (OpenAI, Anthropic, Stripe). Set calendar reminders for quarterly rotation', owner: '', effort: '2 hours', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'HIGH-10', priority: '🟠 HIGH', category: 'Security', item: 'Rate limiting verified in production', description: 'Verify rate limits are applied to all public-facing endpoints. Test with concurrent requests to confirm 429 responses', owner: '', effort: '2 hours', status: 'Not Started', pct: 0, targetDate: '', notes: '' },

  // MEDIUM
  { id: 'MED-01', priority: '🟡 MEDIUM', category: 'Compliance', item: 'CQC registration guidance', description: 'Clarify whether MeticleCare needs CQC registration (only if providing care directly) or if it is purely software for care providers', owner: '', effort: 'Research', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-02', priority: '🟡 MEDIUM', category: 'Operations', item: 'Incident response plan', description: 'Document what happens when: data breach occurs, system goes down, safeguarding concern arises. Who to call, what to do, comms templates', owner: '', effort: '2-3 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-03', priority: '🟡 MEDIUM', category: 'Operations', item: 'Staff onboarding documentation', description: 'Create internal docs for any team members who will support the platform: how to access logs, how to reset users, how to check billing', owner: '', effort: '1-2 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-04', priority: '🟡 MEDIUM', category: 'Infrastructure', item: 'Production environment audit', description: 'Review docker-compose.prod.yml, verify all services have health checks, proper resource limits, log rotation, and restart policies', owner: '', effort: 'Half day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-05', priority: '🟡 MEDIUM', category: 'Data', item: 'Data retention policy implementation', description: 'Ensure the app enforces data retention periods. Health data retention per NHS records management code of practice. Implement auto-deletion or archival', owner: '', effort: '2-3 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-06', priority: '🟡 MEDIUM', category: 'AI', item: 'AI content labelling audit', description: 'Verify all AI-generated outputs (daily notes, meal plans, incident triage, compliance analysis) are clearly labelled as AI-generated in the UI and database', owner: '', effort: '1 day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-07', priority: '🟡 MEDIUM', category: 'Operations', item: 'Disaster recovery runbook', description: 'Document step-by-step recovery procedures: database restore, service restart, DNS failover, data integrity checks. Test the runbook', owner: '', effort: '1-2 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'MED-08', priority: '🟡 MEDIUM', category: 'Accessibility', item: 'WCAG 2.1 AA compliance audit', description: 'Run axe-core or similar against key pages. Fix critical violations (missing alt text, colour contrast, keyboard navigation, screen reader support)', owner: '', effort: '2-3 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },

  // LOW
  { id: 'LOW-01', priority: '🟢 LOW', category: 'Performance', item: 'Load testing', description: 'Run k6 or Artillery against the API. Simulate 50, 100, 200 concurrent users. Measure response times, error rates, and resource usage', owner: '', effort: '1-2 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'LOW-02', priority: '🟢 LOW', category: 'Infrastructure', item: 'Domain & DNS setup', description: 'Finalise production domain. Configure DNS records. Set up email sending (SPF/DKIM/DMARC for transactional emails)', owner: '', effort: '2-3 hours', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'LOW-03', priority: '🟢 LOW', category: 'Operations', item: 'Customer support process', description: 'Define how support tickets are handled: email, chat, phone. Who responds. SLA targets. Escalation path for urgent issues', owner: '', effort: 'Half day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'LOW-04', priority: '🟢 LOW', category: 'Compliance', item: 'CQC evidence pack auto-generation test', description: 'Verify evidence packs generate correctly with real data. Test all CQC domains (Safe, Effective, Caring, Responsive, Well-led)', owner: '', effort: 'Half day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'LOW-05', priority: '🟢 LOW', category: 'Marketing', item: 'Landing page A/B test plan', description: 'Plan initial A/B tests for the landing page: headline variations, CTA placement, pricing display, trust strip positioning', owner: '', effort: 'Half day', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'LOW-06', priority: '🟢 LOW', category: 'Documentation', item: 'API documentation', description: 'Generate or write API docs for any public-facing or integration APIs. Consider OpenAPI/Swagger spec generation', owner: '', effort: '2-3 days', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
  { id: 'LOW-07', priority: '🟢 LOW', category: 'Marketing', item: 'Social proof & testimonials', description: 'Collect early beta user feedback. Create case studies or testimonials. Add to landing page once available', owner: '', effort: 'Ongoing', status: 'Not Started', pct: 0, targetDate: '', notes: '' },
];

items.forEach((item) => {
  const row = ws1.addRow(item);
  row.alignment = { vertical: 'middle', wrapText: true };

  // Priority colouring
  const prioCell = row.getCell('priority');
  if (item.priority.includes('CRITICAL')) {
    prioCell.font = { bold: true, color: { argb: 'FFDC2626' } };
  } else if (item.priority.includes('HIGH')) {
    prioCell.font = { bold: true, color: { argb: 'FFD97706' } };
  } else if (item.priority.includes('MEDIUM')) {
    prioCell.font = { bold: true, color: { argb: 'FF2563EB' } };
  } else {
    prioCell.font = { bold: true, color: { argb: 'FF16A34A' } };
  }

  // Alternating row colours
  const idx = items.indexOf(item);
  if (idx % 2 === 0) {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  }

  // Borders on all cells
  row.eachCell((cell) => {
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
});

// Data validation for Status column
for (let r = 2; r <= items.length + 1; r++) {
  ws1.getCell(r, 8).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"Not Started,In Progress,Blocked,Complete,N/A"'],
  };
  ws1.getCell(r, 7).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"1 hour,Half day,1 day,2-3 days,3-5 days,1 week,1-2 weeks,2-3 weeks,Ongoing,Research"'],
  };
}

// Conditional formatting for Status
ws1.addConditionalFormatting({
  ref: 'H2:H100',
  rules: [
    { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"Complete"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } }, font: { color: { argb: 'FF16A34A' }, bold: true } } },
    { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"In Progress"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDBEAFE' } }, font: { color: { argb: 'FF2563EB' }, bold: true } } },
    { type: 'cellIs', operator: 'equal', priority: 3, formulae: ['"Blocked"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } }, font: { color: { argb: 'FFDC2626' }, bold: true } } },
    { type: 'cellIs', operator: 'equal', priority: 4, formulae: ['"Not Started"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF1F5F9' } }, font: { color: { argb: 'FF94A3B8' } } } },
  ],
});

// ─── Sheet 2: Summary Dashboard ───
const ws2 = wb.addWorksheet('Summary');
ws2.columns = [
  { header: 'Priority', key: 'priority', width: 18 },
  { header: 'Total', key: 'total', width: 10 },
  { header: 'Not Started', key: 'notStarted', width: 14 },
  { header: 'In Progress', key: 'inProgress', width: 14 },
  { header: 'Blocked', key: 'blocked', width: 12 },
  { header: 'Complete', key: 'complete', width: 12 },
  { header: '% Complete', key: 'pctComplete', width: 14 },
];

ws2.getRow(1).eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
});

const priorities = ['🔴 CRITICAL', '🟠 HIGH', '🟡 MEDIUM', '🟢 LOW'];
priorities.forEach((p) => {
  const count = items.filter((i) => i.priority === p).length;
  ws2.addRow({
    priority: p,
    total: count,
    notStarted: count,
    inProgress: 0,
    blocked: 0,
    complete: 0,
    pctComplete: '0%',
  });
});
ws2.addRow({
  priority: 'TOTAL',
  total: items.length,
  notStarted: items.length,
  inProgress: 0,
  blocked: 0,
  complete: 0,
  pctComplete: '0%',
});
ws2.getRow(priorities.length + 2).eachCell((cell) => {
  cell.font = { bold: true, size: 11 };
  cell.border = { top: { style: 'medium', color: { argb: 'FF0F4C81' } } };
});

// ─── Sheet 3: Category Breakdown ───
const ws3 = wb.addWorksheet('By Category');
ws3.columns = [
  { header: 'Category', key: 'category', width: 22 },
  { header: 'Total Items', key: 'total', width: 12 },
  { header: 'Critical', key: 'critical', width: 10 },
  { header: 'High', key: 'high', width: 10 },
  { header: 'Medium', key: 'medium', width: 10 },
  { header: 'Low', key: 'low', width: 10 },
];

ws3.getRow(1).eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
});

const cats = [...new Set(items.map((i) => i.category))];
cats.forEach((cat) => {
  const catItems = items.filter((i) => i.category === cat);
  ws3.addRow({
    category: cat,
    total: catItems.length,
    critical: catItems.filter((i) => i.priority.includes('CRITICAL')).length,
    high: catItems.filter((i) => i.priority.includes('HIGH')).length,
    medium: catItems.filter((i) => i.priority.includes('MEDIUM')).length,
    low: catItems.filter((i) => i.priority.includes('LOW')).length,
  });
});

// ─── Sheet 4: Timeline ───
const ws4 = wb.addWorksheet('Timeline');
ws4.columns = [
  { header: 'Week', key: 'week', width: 12 },
  { header: 'Focus Area', key: 'focus', width: 40 },
  { header: 'Key Items', key: 'items', width: 60 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Notes', key: 'notes', width: 40 },
];

ws4.getRow(1).eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
});

const timeline = [
  { week: 'Week 1', focus: 'Security & Legal', items: 'Engage pen tester, begin DPIA draft, ICO registration, SSL verification', status: 'Not Started', notes: '' },
  { week: 'Week 2', focus: 'QA & Testing', items: 'Run full QA test pack (381 cases), document all failures, begin load testing', status: 'Not Started', notes: '' },
  { week: 'Week 3', focus: 'Legal & Compliance', items: 'DPIA review by DPO, solicitor review of Terms + Privacy Policy, create DPA document', status: 'Not Started', notes: '' },
  { week: 'Week 4', focus: 'Infrastructure & Monitoring', items: 'Uptime monitoring setup, backup recovery testing, Redis scaling test, prod audit', status: 'Not Started', notes: '' },
  { week: 'Week 5', focus: 'Bug Fixes & Polish', items: 'Fix all QA failures, address pen test findings, AI labelling audit, WCAG fixes', status: 'Not Started', notes: '' },
  { week: 'Week 6', focus: 'Launch Prep', items: 'Final smoke test, incident response runbook, monitoring live, disaster recovery test', status: 'Not Started', notes: '' },
];

timeline.forEach((t) => {
  const row = ws4.addRow(t);
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
  });
});

const outPath = path.join(process.cwd(), 'docs', 'MeticleCare_GoLive_Readiness.xlsx');
await wb.xlsx.writeFile(outPath);
console.log(`✅ Written: ${outPath}`);
console.log(`   ${items.length} items across 4 priority levels`);
