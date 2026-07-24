import { generatePdf as sharedGeneratePdf } from '../../shared/pdf/pdf.service'

export function buildEvidencePackHtml(data: any, orgName?: string): string {
  const frameworkName = 'CQC'
  const now = new Date().toLocaleString()

  const staffSection = data.staff?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Staff Summary</h2>
       <table><thead><tr><th>Name</th><th>Email</th><th>Profile</th><th>Compliance Rate</th></tr></thead><tbody>
       ${data.staff.map((s: any) => `<tr><td>${s.first_name} ${s.last_name}</td><td>${s.email||'-'}</td><td>${s.compliance_profile||'-'}</td><td>${s.compliance_rate||'0'}%</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const trainingSection = data.training?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Training Records (${data.training.length})</h2>
       <table><thead><tr><th>Staff</th><th>Module</th><th>Category</th><th>Status</th><th>Completed</th></tr></thead><tbody>
       ${data.training.map((t: any) => `<tr><td>${t.first_name} ${t.last_name}</td><td>${t.module_name}</td><td>${t.module_category||'-'}</td><td><span style="background:${t.status==='completed'?'#DCFCE7':'#FEF3C7'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${t.status||'pending'}</span></td><td>${t.completed_at ? new Date(t.completed_at).toLocaleDateString() : '-'}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const docSection = data.documents?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Documents (${data.documents.length})</h2>
       <table><thead><tr><th>Staff</th><th>Type</th><th>Status</th><th>Expires</th></tr></thead><tbody>
       ${data.documents.map((d: any) => `<tr><td>${d.first_name} ${d.last_name}</td><td>${d.type}</td><td><span style="background:${d.status==='approved'?'#DCFCE7':d.status==='pending'?'#FEF3C7':'#FEE2E2'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${d.status}</span></td><td>${d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '-'}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const compSection = data.competency?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Competency Assessments (${data.competency.length})</h2>
       <table><thead><tr><th>Staff</th><th>Template</th><th>Result</th><th>Assessor</th><th>Date</th></tr></thead><tbody>
       ${data.competency.map((c: any) => `<tr><td>${c.first_name} ${c.last_name}</td><td>${c.template_name}</td><td><span style="background:${c.passed?'#DCFCE7':'#FEE2E2'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${c.passed?'Passed':'Failed'}</span></td><td>${c.assessor_first||''} ${c.assessor_last||''}</td><td>${c.assessed_at ? new Date(c.assessed_at).toLocaleDateString() : '-'}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const suSection = data.service_users?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Service Users (${data.service_users.length} total, ${data.service_users.filter((s:any) => s.status === 'active').length} active)</h2>
       <table><thead><tr><th>Name</th><th>Room</th><th>Status</th><th>Care Plans</th><th>Open Risks</th><th>Goals</th></tr></thead><tbody>
       ${data.service_users.map((su: any) => `<tr><td>${su.first_name} ${su.last_name}</td><td>${su.room_number||'-'}</td><td><span style="background:${su.status==='active'?'#DCFCE7':'#F3F4F6'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${su.status}</span></td><td>${su.active_care_plans||0}</td><td>${su.open_risks||0}</td><td>${su.total_goals||0}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const cpSection = data.care_plans?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Care Plans (${data.care_plans.length})</h2>
       <table><thead><tr><th>Service User</th><th>Title</th><th>Category</th><th>Status</th><th>Review Date</th></tr></thead><tbody>
       ${data.care_plans.map((cp: any) => `<tr><td>${cp.first_name} ${cp.last_name}</td><td>${cp.title}</td><td>${(cp.category||'').replace(/_/g,' ')}</td><td><span style="background:${cp.status==='active'?'#DCFCE7':'#F3F4F6'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${cp.status}</span></td><td>${cp.review_date ? new Date(cp.review_date).toLocaleDateString() : '-'}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const incSection = data.incidents?.length
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Incidents (${data.incidents.length})</h2>
       <table><thead><tr><th>Title</th><th>Involved Residents</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead><tbody>
       ${data.incidents.map((inc: any) => `<tr><td>${inc.title}</td><td>${inc.involved_residents||'N/A'}</td><td><span style="background:${inc.severity==='critical'||inc.severity==='high'?'#FEE2E2':inc.severity==='medium'?'#FEF3C7':'#F3F4F6'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${inc.severity}</span></td><td>${inc.status}</td><td>${inc.occurred_at ? new Date(inc.occurred_at).toLocaleDateString() : '-'}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  const satSection = data.satisfaction?.total > 0
    ? `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">Satisfaction Surveys</h2>
       <div class="summary-grid">
         <div class="summary-card"><div class="num">${data.satisfaction.avg_rating}/5</div><div class="label">Average Rating</div></div>
         <div class="summary-card"><div class="num">${data.satisfaction.total}</div><div class="label">Total Responses</div></div>
         <div class="summary-card"><div class="num">${data.satisfaction.positive}</div><div class="label">Positive (4+)</div></div>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.5; margin: 0; padding: 0; }
  .cover { text-align: center; padding: 80px 40px; page-break-after: always; }
  .cover h1 { color: #0F4C81; font-size: 28px; margin-bottom: 8px; }
  .cover .subtitle { color: #6B7280; font-size: 16px; }
  .cover .meta { margin-top: 40px; color: #9CA3AF; font-size: 13px; }
  .cover .badge { display: inline-block; background: #0F4C81; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 14px; font-weight: 700; margin-top: 16px; }
  h1 { color: #0F4C81; font-size: 22px; border-bottom: 2px solid #0F4C81; padding-bottom: 6px; }
  h2 { color: #0F4C81; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th, td { border: 1px solid #D1D5DB; padding: 6px 10px; text-align: left; }
  th { background: #F3F4F6; font-weight: 700; }
  tr:nth-child(even) { background: #F9FAFB; }
  .summary-grid { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
  .summary-card { flex: 1; min-width: 120px; text-align: center; padding: 16px; border: 1px solid #E5E7EB; border-radius: 8px; }
  .summary-card .num { font-size: 24px; font-weight: 700; color: #0F4C81; }
  .summary-card .label { font-size: 11px; color: #6B7280; }
  .section-break { page-break-before: always; }
</style></head><body>
  <div class="cover">
    <div class="badge">${frameworkName}</div>
    <h1>Evidence Pack</h1>
    <p class="subtitle">${orgName || 'Meticle'} — ${now}</p>
    <div class="meta">
      <p>Total Staff: ${data.summary?.total_staff || 0}</p>
      <p>Service Users: ${data.summary?.total_service_users || 0} (${data.summary?.active_service_users || 0} active)</p>
      <p>Training Records: ${data.summary?.training_records || 0}</p>
      <p>Documents: ${data.summary?.documents || 0}</p>
      <p>Competency Assessments: ${data.summary?.competency_records || 0}</p>
      <p>Incidents: ${data.summary?.incidents || 0}</p>
      ${data.satisfaction?.avg_rating ? `<p>Satisfaction: ${data.satisfaction.avg_rating}/5 (${data.satisfaction.total} responses)</p>` : ''}
    </div>
  </div>

  <h1>Executive Summary</h1>
  <div class="summary-grid">
    <div class="summary-card"><div class="num">${data.summary?.total_staff || 0}</div><div class="label">Staff</div></div>
    <div class="summary-card"><div class="num">${data.summary?.total_service_users || 0}</div><div class="label">Service Users</div></div>
    <div class="summary-card"><div class="num">${data.summary?.training_records || 0}</div><div class="label">Training</div></div>
    <div class="summary-card"><div class="num">${data.summary?.documents || 0}</div><div class="label">Documents</div></div>
    <div class="summary-card"><div class="num">${data.summary?.competency_records || 0}</div><div class="label">Competency</div></div>
    ${data.satisfaction?.avg_rating ? `<div class="summary-card"><div class="num">${data.satisfaction.avg_rating}/5</div><div class="label">Satisfaction</div></div>` : ''}
  </div>
  <p style="color:#6B7280;font-size:12px">Generated by Meticle on ${now}</p>

  <div class="section-break"></div>
  <h1>Summary</h1>

  ${staffSection ? `<div class="section-break"></div>${staffSection}` : ''}
  ${suSection ? `<div class="section-break"></div>${suSection}` : ''}
  ${cpSection ? `<div class="section-break"></div>${cpSection}` : ''}
  ${incSection ? `<div class="section-break"></div>${incSection}` : ''}
  ${trainingSection ? `<div class="section-break"></div>${trainingSection}` : ''}
  ${docSection ? `<div class="section-break"></div>${docSection}` : ''}
  ${compSection ? `<div class="section-break"></div>${compSection}` : ''}
  ${satSection ? `<div class="section-break"></div>${satSection}` : ''}

  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #D1D5DB;font-size:10px;color:#9CA3AF;text-align:center">
    Meticle Evidence Pack &bull; Generated ${now} &bull; For inspection purposes
  </div>
</body></html>`
}

export { sharedGeneratePdf as generatePdf }
