import { generatePdf as sharedGeneratePdf } from '../../shared/pdf/pdf.service'
import { getRegulator } from './regulators'
import {
  findFramework,
  domainsForServiceTypes,
  resolveRqiaStandardsSet,
  RQIA_STANDARDS_SETS,
  type FrameworkDef,
  type DomainDef,
} from '../cqc/frameworks'

/**
 * Which evidence sections sit under which framework domain.
 *
 * Keyed on the domain key, so Wales ("well-being"), England ("caring") and
 * Northern Ireland ("compassionate") each get their own arrangement. A key that
 * is not in here renders as "no evidence mapped" rather than silently falling
 * back to everything — a theme with no evidence under it should look empty,
 * because an empty theme is information and a wrongly-filled one is not.
 */
const EVIDENCE_BY_DOMAIN: Record<string, string[]> = {
  // Shared by the CQC and our RQIA groupings, which is why one key serves both.
  safe: ['incidents', 'documents', 'training'],
  effective: ['care_plans', 'competency', 'nutrition'],
  'well-led': ['staff', 'training', 'documents'],
  // CQC only
  caring: ['people', 'satisfaction', 'nutrition_concerns'],
  responsive: ['care_plans', 'satisfaction'],
  // CIW
  'well-being': ['people', 'care_plans', 'incidents', 'satisfaction'],
  'care-and-support': ['care_plans', 'competency', 'nutrition'],
  'leadership-and-management': ['documents', 'training', 'competency', 'staff'],
  // We hold no premises, equipment or maintenance records at all, so this one is
  // empty by design rather than by omission. CIW rates it; we cannot speak to it.
  environment: [],
  // Care Inspectorate
  'quality-care-support': ['care_plans', 'people', 'nutrition'],
  // Our RQIA groupings
  compassionate: ['people', 'satisfaction', 'nutrition_concerns'],
}

/**
 * The framework named on the cover of an evidence pack.
 *
 * This was a hardcoded 'CQC' and the same file's controller scores four
 * frameworks, so a Welsh or Scottish provider downloaded a document with a CQC
 * badge on the cover and no way to tell that was a default rather than their
 * regulator. An evidence pack is a document a provider shows an inspector: a
 * wrong regulator on the cover is the first thing noticed and it undermines
 * every number inside it.
 *
 * Falls back to the organisation's stored regulator, then to saying so rather
 * than to a guess. "Not recorded" is a sentence an administrator can act on;
 * a confident wrong answer is not.
 */
export function resolveFrameworkName(regulatorId?: string | null): string {
  if (!regulatorId) return 'Not recorded'
  const reg = getRegulator(regulatorId)
  return reg ? reg.name : 'Not recorded'
}

/**
 * Escape text going into the pack.
 *
 * Every name in here is a person's name, entered by whoever typed it, and the
 * evidence pack interpolates those straight into HTML that a headless browser
 * then renders. A resident called "<script>" or an ampersand in "Smith & Co"
 * either breaks the layout or executes. Nothing in this file used to escape,
 * which is why a single care home with an ampersand in its name could produce a
 * truncated PDF.
 */
function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function date(value: any): string {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString()
}

const H2 = (t: string) => `<h2 style="color:#0F4C81;font-size:18px;margin-top:24px">${esc(t)}</h2>`

/** A chip used for status and severity columns. */
const chip = (text: string, bg: string) =>
  `<span style="background:${bg};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${esc(text)}</span>`

/**
 * The evidence sections, keyed so a regulator's themes can pull them.
 *
 * Before this was a `const` per section and a fixed order in the template, which
 * is precisely why the pack was in our database's order rather than the
 * regulator's.
 */
function buildSections(data: any): Record<string, string> {
  const sections: Record<string, string> = {}

  sections.staff = data.staff?.length
    ? `${H2('Staff Summary')}
       <table><thead><tr><th>Name</th><th>Email</th><th>Profile</th><th>Compliance Rate</th></tr></thead><tbody>
       ${data.staff.map((s: any) => `<tr><td>${esc(s.first_name)} ${esc(s.last_name)}</td><td>${esc(s.email || '-')}</td><td>${esc(s.compliance_profile || '-')}</td><td>${esc(s.compliance_rate || 0)}%</td></tr>`).join('')}
       </tbody></table>`
    : ''

  sections.people = data.people?.length
    ? `${H2(`People (${data.people.length} total, ${data.people.filter((s: any) => s.status === 'active').length} active)`)}
       <table><thead><tr><th>Name</th><th>Room</th><th>Status</th><th>Care Plans</th><th>Open Risks</th><th>Goals</th></tr></thead><tbody>
       ${data.people.map((su: any) => `<tr><td>${esc(su.first_name)} ${esc(su.last_name)}</td><td>${esc(su.room_number || '-')}</td><td>${chip(su.status, su.status === 'active' ? '#DCFCE7' : '#F3F4F6')}</td><td>${esc(su.active_care_plans || 0)}</td><td>${esc(su.open_risks || 0)}</td><td>${esc(su.total_goals || 0)}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  sections.care_plans = data.care_plans?.length
    ? `${H2(`Care Plans (${data.care_plans.length})`)}
       <table><thead><tr><th>Person</th><th>Title</th><th>Category</th><th>Status</th><th>Review Date</th></tr></thead><tbody>
       ${data.care_plans.map((cp: any) => `<tr><td>${esc(cp.first_name)} ${esc(cp.last_name)}</td><td>${esc(cp.title)}</td><td>${esc(String(cp.category || '').replace(/_/g, ' '))}</td><td>${chip(cp.status, cp.status === 'active' ? '#DCFCE7' : '#F3F4F6')}</td><td>${date(cp.review_date)}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  sections.incidents = data.incidents?.length
    ? `${H2(`Incidents (${data.incidents.length})`)}
       <table><thead><tr><th>Title</th><th>Involved Residents</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead><tbody>
       ${data.incidents.map((inc: any) => {
         const bg = inc.severity === 'critical' || inc.severity === 'high' ? '#FEE2E2' : inc.severity === 'medium' ? '#FEF3C7' : '#F3F4F6'
         return `<tr><td>${esc(inc.title)}</td><td>${esc(inc.involved_people || 'N/A')}</td><td>${chip(inc.severity, bg)}</td><td>${esc(inc.status)}</td><td>${date(inc.incident_date)}</td></tr>`
       }).join('')}
       </tbody></table>`
    : ''

  sections.training = data.training?.length
    ? `${H2(`Training Records (${data.training.length})`)}
       <table><thead><tr><th>Staff</th><th>Module</th><th>Category</th><th>Status</th><th>Completed</th></tr></thead><tbody>
       ${data.training.map((t: any) => `<tr><td>${esc(t.first_name)} ${esc(t.last_name)}</td><td>${esc(t.module_name)}</td><td>${esc(t.module_category || '-')}</td><td>${chip(t.status || 'pending', t.status === 'completed' ? '#DCFCE7' : '#FEF3C7')}</td><td>${date(t.completed_at)}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  sections.documents = data.documents?.length
    ? `${H2(`Documents (${data.documents.length})`)}
       <table><thead><tr><th>Staff</th><th>Type</th><th>Status</th><th>Expires</th></tr></thead><tbody>
       ${data.documents.map((d: any) => {
         const bg = d.status === 'approved' ? '#DCFCE7' : d.status === 'pending' ? '#FEF3C7' : '#FEE2E2'
         return `<tr><td>${esc(d.first_name)} ${esc(d.last_name)}</td><td>${esc(d.type)}</td><td>${chip(d.status, bg)}</td><td>${date(d.expiry_date)}</td></tr>`
       }).join('')}
       </tbody></table>`
    : ''

  sections.competency = data.competency?.length
    ? `${H2(`Competency Assessments (${data.competency.length})`)}
       <table><thead><tr><th>Staff</th><th>Template</th><th>Result</th><th>Assessor</th><th>Date</th></tr></thead><tbody>
       ${data.competency.map((c: any) => `<tr><td>${esc(c.first_name)} ${esc(c.last_name)}</td><td>${esc(c.template_name)}</td><td>${chip(c.passed ? 'Passed' : 'Failed', c.passed ? '#DCFCE7' : '#FEE2E2')}</td><td>${esc(`${c.assessor_first || ''} ${c.assessor_last || ''}`.trim())}</td><td>${date(c.assessed_at)}</td></tr>`).join('')}
       </tbody></table>`
    : ''

  sections.satisfaction = data.satisfaction?.total > 0
    ? `${H2('Satisfaction Surveys')}
       <div class="summary-grid">
         <div class="summary-card"><div class="num">${esc(data.satisfaction.avg_rating)}/5</div><div class="label">Average Rating</div></div>
         <div class="summary-card"><div class="num">${esc(data.satisfaction.total)}</div><div class="label">Total Responses</div></div>
         <div class="summary-card"><div class="num">${esc(data.satisfaction.positive)}</div><div class="label">Positive (4+)</div></div>
       </div>`
    : ''

  const nutritionPeople = (data.nutrition || []).filter((n: any) => n.dietary_type)
  const nutritionWithConcerns = (data.nutrition || []).filter(
    (n: any) => (n.nutrition_concerns_7d || 0) > 0 || (n.refused_last_7d || 0) > 0 || (n.avg_consumed_7d && n.avg_consumed_7d < 50)
  )
  const totalFluid7d = (data.nutrition || []).reduce((sum: number, n: any) => sum + (n.total_fluid_7d || 0), 0)
  const avgFluidPerPerson = nutritionPeople.length > 0 ? Math.round(totalFluid7d / nutritionPeople.length) : 0

  sections.nutrition_summary = data.nutrition && data.nutrition.length > 0
    ? `${H2('Nutrition Overview')}
       <div class="summary-grid">
         <div class="summary-card"><div class="num">${esc(data.summary?.people_with_dietary_profiles || 0)}/${esc(data.summary?.total_people || 0)}</div><div class="label">Dietary Profiles</div></div>
         <div class="summary-card"><div class="num">${esc(nutritionWithConcerns.length)}</div><div class="label">Nutrition Concerns (7d)</div></div>
         <div class="summary-card"><div class="num">${esc(avgFluidPerPerson)}ml</div><div class="label">Avg Fluid/Person (7d)</div></div>
         <div class="summary-card"><div class="num">${esc(nutritionPeople.filter((n: any) => n.texture_modified && n.texture_modified !== 'None').length)}</div><div class="label">Texture Modified</div></div>
       </div>`
    : ''

  sections.nutrition = nutritionPeople.length > 0
    ? `${H2(`Nutrition & Dietary Records (${nutritionPeople.length} people)`)}
       <table><thead><tr><th>Person</th><th>Diet</th><th>Texture</th><th>Appetite</th><th>Meals (7d)</th><th>Refused</th><th>Avg Consumed</th><th>Fluid (7d)</th><th>Flags</th></tr></thead><tbody>
       ${nutritionPeople.map((n: any) => {
         const flags: string[] = []
         if (n.vegetarian) flags.push('V')
         if (n.vegan) flags.push('VG')
         if (n.halal) flags.push('H')
         if (n.kosher) flags.push('K')
         if (n.gluten_free) flags.push('GF')
         if (n.dairy_free) flags.push('DF')
         if (n.nut_allergy) flags.push('NUT')
         if (n.other_allergies) flags.push('ALLERGY')
         const isConcern = (n.nutrition_concerns_7d || 0) > 0 || (n.refused_last_7d || 0) > 0 || (n.avg_consumed_7d && n.avg_consumed_7d < 50)
         return `<tr${isConcern ? ' style="background:#FEF2F2"' : ''}>
           <td>${esc(n.person_name)}</td>
           <td>${esc(n.dietary_type || '-')}</td>
           <td>${esc(n.texture_modified && n.texture_modified !== 'None' ? n.texture_modified : '-')}</td>
           <td>${esc(n.appetite_level || '-')}</td>
           <td>${esc(n.meals_last_7d || 0)}</td>
           <td>${(n.refused_last_7d || 0) > 0 ? chip(n.refused_last_7d, '#FEE2E2') : '0'}</td>
           <td>${n.avg_consumed_7d != null ? esc(n.avg_consumed_7d) + '%' : '-'}</td>
           <td>${esc(n.total_fluid_7d || 0)}ml</td>
           <td>${flags.length > 0 ? `<span style="font-size:9px">${flags.join(' ')}</span>` : '-'}</td>
         </tr>`
       }).join('')}
       </tbody></table>`
    : ''

  sections.nutrition_concerns = nutritionWithConcerns.length > 0
    ? `<div class="section-break"></div>
       <h2 style="color:#DC2626;font-size:18px;margin-top:24px">&#9888; Nutrition Concerns (${nutritionWithConcerns.length} people)</h2>
       <p style="color:#6B7280;font-size:12px">People with low intake, meal refusals, or declining appetite in the last 7 days &mdash; require care plan review and staff follow-up.</p>
       <table><thead><tr><th>Person</th><th>Diet</th><th>Meals (7d)</th><th>Refused</th><th>Avg Consumed</th><th>Fluid (7d)</th><th>Target</th><th>Below Target</th></tr></thead><tbody>
       ${nutritionWithConcerns.map((n: any) => {
         const deficit = (n.fluid_daily_target_ml || 2000) - (n.total_fluid_7d || 0)
         return `<tr style="background:#FEF2F2">
           <td><strong>${esc(n.person_name)}</strong></td>
           <td>${esc(n.dietary_type || '-')}</td>
           <td>${esc(n.meals_last_7d || 0)}</td>
           <td>${chip(n.refused_last_7d || 0, '#DC2626')}</td>
           <td>${n.avg_consumed_7d != null ? esc(n.avg_consumed_7d) + '%' : '-'}</td>
           <td>${esc(n.total_fluid_7d || 0)}ml</td>
           <td>${esc(n.fluid_daily_target_ml || 2000)}ml</td>
           <td>${deficit > 0 ? `<span style="color:#DC2626;font-weight:600">-${esc(deficit)}ml</span>` : 'On target'}</td>
         </tr>`
       }).join('')}
       </tbody></table>`
    : ''

  return sections
}

/**
 * A source citation, or an honest statement that there isn't one.
 *
 * The verified/unverified split is the whole point of this file, so it goes on
 * the cover in the regulator's document rather than in a footer nobody reads.
 */
function sourceBlock(framework: FrameworkDef | null): string {
  if (!framework) {
    return `<div class="note-box"><strong>No framework recorded.</strong>
      <p>This organisation has no regulator recorded in its settings, so this pack is arranged by Meticle Care alone. It is not laid out against any regulatory framework and should not be presented as though it were.</p></div>`
  }
  const unverified = Object.entries(framework.verifiedAspects || {}).filter(([, v]) => !v.verified)
  return `<div class="source-box">
    <div class="source-label">Framework source</div>
    <p><strong>${esc(framework.name)}</strong> &mdash; ${esc(framework.country)}</p>
    <p>${esc(framework.description)}</p>
    <p>${esc(framework.source)}</p>
    ${framework.sourceUrl ? `<p class="source-url">${esc(framework.sourceUrl)}</p>` : ''}
    ${framework.sourcePublishedOn ? `<p class="source-meta">Published ${esc(framework.sourcePublishedOn)}${framework.sourceRetrievedOn ? ` &middot; Checked ${esc(framework.sourceRetrievedOn)}` : ''}</p>` : ''}
    ${unverified.length
      ? `<p class="source-meta"><strong>Not verified:</strong> ${unverified.map(([k, v]) => esc(`${k} — ${v.detail}`)).join(' ')}</p>`
      : ''}
  </div>`
}

/** The rating scale in the regulator's words, or a note that we have none. */
function ratingBlock(framework: FrameworkDef | null): string {
  if (!framework) return ''
  if (!framework.ratings || framework.ratings.length === 0) {
    return `<div class="note-box"><strong>No rating is shown for this service.</strong>
      <p>${framework.id === 'rqia'
        ? 'We have not verified a published RQIA rating scale, so this pack does not display one. The RQIA inspects against the minimum standards published for your registered setting and publishes narrative inspection reports, not a quality rating for the service.'
        : `We have not verified a published rating scale for ${esc(framework.name)}, so this pack does not display one.`}</p></div>`
  }
  return `<div class="scale">
    <div class="scale-label">${esc(framework.ratings.length)} ratings used by ${esc(resolveFrameworkName(framework.id))}, most positive first</div>
    <div class="scale-items">${framework.ratings.map((r: { label: string }) => `<span class="scale-item">${esc(r.label)}</span>`).join('')}</div>
    ${framework.ratingsNote ? `<p class="source-meta">${esc(framework.ratingsNote)}</p>` : ''}
  </div>`
}

/**
 * The RQIA standards block.
 *
 * Prints which of the nine published sets applies and how we decided, and lists
 * the others so a provider whose setting is recorded wrongly can see the
 * alternative without contacting us. When nothing is recorded it says that
 * instead of defaulting, because picking one of nine is a guess about the
 * document most likely to be checked.
 */
function rqiaBlock(framework: FrameworkDef, primaryServiceType?: string | null): string {
  const set = resolveRqiaStandardsSet(primaryServiceType)
  const others = RQIA_STANDARDS_SETS.filter((s) => s !== set?.standards)
  return `<div class="note-box"><strong>Applicable standards</strong>
    ${set
      ? `<p><strong>${esc(set.standards)}</strong>, inferred from your recorded service type <em>${esc(set.derivedFrom)}</em>.</p>
         <p class="source-meta">RQIA registers the setting name itself, which this product does not hold, so the mapping from your service type is ours. If it is wrong, say so and the pack is regenerated against the right document.</p>`
      : `<p><strong>No service type is recorded for your organisation</strong>, so we cannot tell which of the nine published sets applies and have not guessed. Record your primary service type and regenerate this pack.</p>`}
    ${framework.caveat ? `<p>${esc(framework.caveat)}</p>` : ''}
    ${others.length ? `<p class="source-meta">The other published sets, none of which this pack is arranged against: ${others.map((s) => esc(s)).join('; ')}.</p>` : ''}
  </div>`
}

/**
 * The contents list, built from the framework's own themes.
 *
 * A contents page is where the reader learns whether this pack speaks their
 * regulator's language, so it is generated from the framework rather than
 * hardcoded.
 */
function contentsBlock(framework: FrameworkDef | null, sections: Record<string, string>, domains: DomainDef[] | null): string {
  if (framework && domains && domains.length > 0) {
    return `<h2 style="color:#0F4C81;font-size:16px;margin-top:20px">Contents, by ${esc(framework.name)}</h2>
      <ul class="contents">${domains
        .map((d: DomainDef) => {
          const present = (EVIDENCE_BY_DOMAIN[d.key] || []).filter((k: string) => sections[k])
          return `<li><strong>${esc(d.label)}</strong> <span class="contents-note">${
            present.length
              ? esc(present.length + ' section' + (present.length === 1 ? '' : 's') + ' of evidence')
              : 'no evidence in this pack'
          }</span></li>`
        })
        .join('')}</ul>`
  }
  const present = Object.entries(sections).filter(([, v]) => v)
  return `<h2 style="color:#0F4C81;font-size:16px;margin-top:20px">Contents</h2>
    <p class="source-meta">Arranged by Meticle Care. No framework is recorded for this regulator, so there is no regulator ordering to follow and this pack is not arranged against one.</p>
    <ul class="contents">${present.map(([k]) => `<li>${esc(k.replace(/_/g, ' '))}</li>`).join('')}</ul>`
}

/**
 * Build the evidence pack.
 *
 * `primaryServiceType` matters only for RQIA, whose framework is chosen by
 * setting rather than fixed. Everything else resolves from the regulator.
 */
export function buildEvidencePackHtml(
  data: any,
  orgName?: string,
  regulatorId?: string | null,
  primaryServiceType?: string | null,
): string {
  const frameworkName = resolveFrameworkName(regulatorId)
  const framework = findFramework(regulatorId)
  const now = new Date().toLocaleString()
  const sections = buildSections(data)

  /**
   * The domains that apply to this provider.
   *
   * `domainsForServiceTypes` exists because CIW carves out its own exception:
   * it does not rate Environment for domiciliary services. A Welsh domiciliary
   * provider should not be shown a theme its regulator never scores it on, so
   * the pack honours the carve-out rather than printing all four themes at
   * everyone.
   */
  const domains = framework
    ? domainsForServiceTypes(framework, primaryServiceType ? [primaryServiceType] : null)
    : null

  /**
   * Render the sections for a theme, skipping ones already printed.
   *
   * Nutrition is referenced by two CIW themes. Repeating the table would double
   * the page count and read as though there were twice the evidence, so the
   * second mention cross-references the first.
   */
  const rendered = new Set<string>()
  const bodyFor = (keys: string[]) => {
    const out: string[] = []
    for (const key of keys) {
      const html = sections[key]
      if (!html) continue
      if (rendered.has(key)) {
        out.push(`<p class="xref">${esc(key.replace(/_/g, ' '))} is shown in full earlier in this pack.</p>`)
        continue
      }
      rendered.add(key)
      out.push(html)
    }
    return out.join('')
  }

  const themeBody = framework && domains && domains.length > 0
    ? `<div class="section-break"></div>
       ${domains
         .map((d: DomainDef) => {
           const keys = EVIDENCE_BY_DOMAIN[d.key] || []
           const present = keys.filter((k: string) => sections[k])
           const mapped = keys.length > 0
           return `<div class="section-break"></div>
             <h2 class="theme">${esc(d.label)}</h2>
             ${d.description ? `<p class="theme-intent">${esc(d.description)}</p>` : ''}
             ${
               d.key === 'environment'
                 ? `<div class="gap-box"><strong>Nothing in this product speaks to this theme.</strong>
                     <p>${esc(framework.name)} rates this theme and we hold no premises, equipment or maintenance records. It is printed so that it is not silently absent — an inspector asking about it should be told we hold nothing, not shown an empty page and left to assume the answer is elsewhere in the document.</p></div>`
                 : ''
             }
             ${
               mapped
                 ? `<p class="theme-evidence">Evidence in this section: ${esc(keys.map((k: string) => k.replace(/_/g, ' ')).join(', '))}</p>`
                 : `<p class="theme-evidence">No evidence in this pack is mapped to this theme.</p>`
             }
             ${
               d.statements && d.statements.length
                 ? `<table class="statements"><thead><tr><th>What ${esc(framework.name)} calls for</th><th>Is this the regulator's wording?</th></tr></thead><tbody>
                     ${d.statements
                       .map(
                         (s) => `<tr><td>${esc(s.label)}</td><td>${
                           s.wordingOurs
                             ? 'Meticle Care\u2019s wording, not the regulator\u2019s'
                             : 'Regulator wording'
                         }</td></tr>`
                       )
                       .join('')}
                     </tbody></table>`
                 : ''
             }
             ${bodyFor(keys)}`
         })
         .join('')}`
    : ''

  // With no framework, fall back to the old fixed order, and say on the cover
  // that that is what happened rather than letting the reader assume otherwise.
  const genericBody = !themeBody
    ? `<div class="section-break"></div>
       ${['staff', 'people', 'care_plans', 'incidents', 'training', 'documents', 'competency', 'satisfaction', 'nutrition_summary', 'nutrition', 'nutrition_concerns']
         .map((k) => (sections[k] ? `<div class="section-break"></div>${sections[k]}` : ''))
         .join('')}`
    : ''

  const rqiaSection =
    framework?.id === 'rqia'
      ? `<div class="section-break"></div><h2 style="color:#0F4C81;font-size:18px">Standards this pack is offered against</h2>${rqiaBlock(framework, primaryServiceType)}`
      : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.5; margin: 0; padding: 0; }
  .cover { text-align: center; padding: 70px 40px; page-break-after: always; }
  .cover h1 { color: #0F4C81; font-size: 28px; margin-bottom: 8px; }
  .cover .subtitle { color: #6B7280; font-size: 16px; }
  .cover .meta { margin-top: 32px; color: #9CA3AF; font-size: 13px; }
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
  .theme { color: #0F4C81; font-size: 18px; margin-top: 0; border-bottom: 1px solid #D1D5DB; padding-bottom: 6px; }
  .theme-intent { color: #374151; font-size: 12px; }
  .theme-evidence { color: #9CA3AF; font-size: 10px; font-style: italic; }
  .xref { color: #6B7280; font-size: 11px; font-style: italic; }
  .note-box, .gap-box { border: 1px solid #D97706; background: #FFFBEB; padding: 12px 14px; margin: 16px 0; font-size: 11px; border-radius: 6px; }
  .gap-box { border-color: #DC2626; background: #FEF2F2; }
  .note-box p, .gap-box p { margin: 6px 0 0 0; }
  .source-box { border: 1px solid #D1D5DB; background: #F9FAFB; padding: 12px 14px; margin: 16px 0; font-size: 11px; border-radius: 6px; text-align: left; }
  .source-box p { margin: 4px 0 0 0; }
  .source-label, .scale-label { color: #6B7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  .source-url { color: #0F4C81; word-break: break-all; }
  .source-meta { color: #6B7280; font-size: 10px; }
  .scale { margin: 16px 0; text-align: left; }
  .scale-items { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
  .scale-item { border: 1px solid #0F4C81; color: #0F4C81; border-radius: 14px; padding: 2px 12px; font-size: 11px; font-weight: 600; }
  .contents { list-style: none; padding-left: 0; font-size: 12px; }
  .contents li { padding: 4px 0; border-bottom: 1px dotted #E5E7EB; }
  .contents-note { color: #9CA3AF; font-size: 10px; font-weight: 400; }
  table.statements { font-size: 11px; }
  table.statements td:last-child { color: #6B7280; font-size: 10px; }
</style></head><body>
  <div class="cover">
    <div class="badge">${esc(frameworkName)}</div>
    <h1>Evidence Pack</h1>
    <p class="subtitle">${esc(orgName || 'Meticle Care')} &mdash; ${esc(now)}</p>
    ${framework && framework.name ? `<p class="source-meta">Arranged against: ${esc(framework.name)}</p>` : ''}
    <div class="meta">
      <p>Total Staff: ${esc(data.summary?.total_staff || 0)}</p>
      <p>People: ${esc(data.summary?.total_people || 0)} (${esc(data.summary?.active_people || 0)} active)</p>
      <p>Training Records: ${esc(data.summary?.training_records || 0)}</p>
      <p>Documents: ${esc(data.summary?.documents || 0)}</p>
      <p>Competency Assessments: ${esc(data.summary?.competency_records || 0)}</p>
      <p>Incidents: ${esc(data.summary?.incidents || 0)}</p>
      ${data.satisfaction?.avg_rating ? `<p>Satisfaction: ${esc(data.satisfaction.avg_rating)}/5 (${esc(data.satisfaction.total)} responses)</p>` : ''}
      ${data.summary?.people_with_dietary_profiles ? `<p>People with Dietary Profiles: ${esc(data.summary.people_with_dietary_profiles)}/${esc(data.summary?.total_people || 0)}</p>` : ''}
      ${data.summary?.people_with_nutrition_concerns ? `<p>Nutrition Concerns (7 days): ${esc(data.summary.people_with_nutrition_concerns)}</p>` : ''}
    </div>
    <div style="max-width:520px;margin:28px auto 0;text-align:left">
      ${ratingBlock(framework)}
      ${sourceBlock(framework)}
    </div>
  </div>

  <h1>Executive Summary</h1>
  <div class="summary-grid">
    <div class="summary-card"><div class="num">${esc(data.summary?.total_staff || 0)}</div><div class="label">Staff</div></div>
    <div class="summary-card"><div class="num">${esc(data.summary?.total_people || 0)}</div><div class="label">People</div></div>
    <div class="summary-card"><div class="num">${esc(data.summary?.training_records || 0)}</div><div class="label">Training</div></div>
    <div class="summary-card"><div class="num">${esc(data.summary?.documents || 0)}</div><div class="label">Documents</div></div>
    <div class="summary-card"><div class="num">${esc(data.summary?.competency_records || 0)}</div><div class="label">Competency</div></div>
    ${data.satisfaction?.avg_rating ? `<div class="summary-card"><div class="num">${esc(data.satisfaction.avg_rating)}/5</div><div class="label">Satisfaction</div></div>` : ''}
    ${data.summary?.people_with_dietary_profiles ? `<div class="summary-card"><div class="num">${esc(data.summary.people_with_dietary_profiles)}</div><div class="label">Dietary Profiles</div></div>` : ''}
    ${data.summary?.people_with_nutrition_concerns ? `<div class="summary-card" style="${data.summary.people_with_nutrition_concerns > 0 ? 'border-color:#DC2626' : ''}"><div class="num" style="${data.summary.people_with_nutrition_concerns > 0 ? 'color:#DC2626' : ''}">${esc(data.summary.people_with_nutrition_concerns)}</div><div class="label">Nutrition Concerns</div></div>` : ''}
  </div>
  <p style="color:#6B7280;font-size:12px">Generated by Meticle Care on ${esc(now)}</p>
  ${contentsBlock(framework, sections, domains)}

  ${rqiaSection}
  ${themeBody}
  ${genericBody}

  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #D1D5DB;font-size:10px;color:#9CA3AF;text-align:center">
    Meticle Care Evidence Pack &bull; ${esc(frameworkName)} &bull; Generated ${esc(now)} &bull; For inspection purposes
  </div>
</body></html>`
}

export { sharedGeneratePdf as generatePdf }
