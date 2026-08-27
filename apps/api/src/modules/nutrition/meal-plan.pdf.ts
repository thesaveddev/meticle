import { generatePdf, buildReportStyles } from '../../shared/pdf/pdf.service'

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', color: '#F59E0B' },
  { value: 'morning_snack', label: 'Morning Snack', color: '#10B981' },
  { value: 'lunch', label: 'Lunch', color: '#3B82F6' },
  { value: 'afternoon_snack', label: 'Afternoon Snack', color: '#8B5CF6' },
  { value: 'dinner', label: 'Dinner', color: '#EF4444' },
  { value: 'evening_snack', label: 'Evening Snack', color: '#EC4899' },
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

export function buildMealPlanHtml(weeklyPlan: any, shoppingList?: any): string {
  const styles = buildReportStyles()
  const now = new Date().toLocaleString('en-GB')
  const person = weeklyPlan.person_context || {}
  const week = weeklyPlan.week || {}
  const totals = weeklyPlan.weekly_totals || {}

  // Build person context section
  const allergenBadges = (person.allergens || [])
    .map((a: string) => `<span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:4px">⚠ No ${a}</span>`)
    .join('')

  const contextBadges = []
  if (person.dietary_summary) contextBadges.push(`<span style="background:#ECFDF5;color:#065F46;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">Diet: ${person.dietary_summary}</span>`)
  if (person.texture_modification && person.texture_modification !== 'None') contextBadges.push(`<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">Texture: ${person.texture_modification}</span>`)
  if (person.fluid_target_ml) contextBadges.push(`<span style="background:#E0F2FE;color:#0284C7;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">💧 Fluid: ${person.fluid_target_ml}ml/day</span>`)

  // Build weekly grid
  let gridHtml = `
    <h1 style="color:#0F4C81;font-size:20px;border-bottom:2px solid #0F4C81;padding-bottom:6px">Weekly Meal Plan</h1>
    <div style="margin-bottom:12px">
      ${contextBadges.join(' ')}
      ${allergenBadges ? '<br>' + allergenBadges : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:10px">
      <thead>
        <tr>
          <th style="background:#F3F4F6;padding:8px;text-align:left;border:1px solid #D1D5DB;width:12%">Meal</th>
          ${DAYS.map(d => `<th style="background:#F3F4F6;padding:8px;text-align:center;border:1px solid #D1D5DB;width:${88/7}%">${DAY_LABELS[d]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>`

  for (const mt of MEAL_TYPES) {
    gridHtml += `<tr>`
    gridHtml += `<td style="padding:6px 8px;border:1px solid #D1D5DB;background:${mt.color}10;font-weight:700;color:${mt.color};vertical-align:top;font-size:10px">${mt.label}</td>`
    for (const day of DAYS) {
      const meal = week[day]?.[mt.value]
      if (meal) {
        const items = (meal.items || []).map((it: any) => `<div style="font-size:9px;color:#6B7280;margin-top:2px">• ${it.name} (${it.portion})</div>`).join('')
        gridHtml += `<td style="padding:6px;border:1px solid #D1D5DB;vertical-align:top">
          <div style="font-weight:600;font-size:10px;margin-bottom:2px">${meal.name}</div>
          <div style="font-size:9px;color:#6B7280">${meal.estimated_calories || ''} kcal</div>
          ${items}
        </td>`
      } else {
        gridHtml += `<td style="padding:6px;border:1px solid #D1D5DB;color:#D1D5DB;text-align:center">—</td>`
      }
    }
    gridHtml += `</tr>`
  }

  gridHtml += `</tbody></table>`

  // Weekly totals
  if (totals.avg_daily_calories || totals.avg_daily_fluid_ml) {
    gridHtml += `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px;margin:16px 0">
      <strong style="color:#166534">Weekly Summary</strong><br>
      <span style="background:#DCFCE7;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:8px">~${totals.avg_daily_calories} kcal/day avg</span>
      <span style="background:#E0F2FE;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:8px">~${totals.avg_daily_fluid_ml}ml fluid/day avg</span>
      ${totals.total_unique_meals ? `<span style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${totals.total_unique_meals} unique meals</span>` : ''}
    </div>`
  }

  // Nutritional notes
  if (weeklyPlan.nutritional_notes?.length > 0) {
    gridHtml += `
    <div style="margin:16px 0">
      <strong style="font-size:13px;color:#374151">Nutritional Notes</strong>
      <ul style="margin:4px 0;padding-left:20px;font-size:11px;color:#6B7280">
        ${weeklyPlan.nutritional_notes.map((n: string) => `<li>${n}</li>`).join('')}
      </ul>
    </div>`
  }

  // Shopping list section
  let shoppingHtml = ''
  if (shoppingList?.categories?.length > 0) {
    shoppingHtml = `
    <div class="section-break"></div>
    <h1 style="color:#059669;font-size:20px;border-bottom:2px solid #059669;padding-bottom:6px">🛒 Weekly Shopping List</h1>
    <p style="color:#6B7280;font-size:11px;margin:0 0 16px">Consolidated ingredients for ${person.name || 'this person'}'s weekly meal plan</p>`

    for (const category of shoppingList.categories) {
      const items = category.items || []
      shoppingHtml += `
      <div style="margin-bottom:16px;page-break-inside:avoid">
        <h2 style="color:#374151;font-size:14px;margin:0 0 6px;background:#F9FAFB;padding:6px 10px;border-radius:4px;border-left:3px solid #059669">${category.icon || '📦'} ${category.name} (${items.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead>
            <tr>
              <th style="background:#F3F4F6;padding:6px 8px;text-align:left;border:1px solid #D1D5DB;width:30%">Item</th>
              <th style="background:#F3F4F6;padding:6px 8px;text-align:left;border:1px solid #D1D5DB;width:20%">Quantity</th>
              <th style="background:#F3F4F6;padding:6px 8px;text-align:left;border:1px solid #D1D5DB;width:35%">Used In</th>
              <th style="background:#F3F4F6;padding:6px 8px;text-align:left;border:1px solid #D1D5DB;width:15%">Allergens</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #D1D5DB;font-weight:600">
                  ${item.name}
                  ${item.notes ? `<div style="font-weight:400;font-size:9px;color:#9CA3AF;font-style:italic">${item.notes}</div>` : ''}
                </td>
                <td style="padding:6px 8px;border:1px solid #D1D5DB">
                  <span style="background:#ECFDF5;color:#065F46;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600">${item.quantity} ${item.unit || ''}</span>
                </td>
                <td style="padding:6px 8px;border:1px solid #D1D5DB;font-size:9px;color:#6B7280">${(item.used_in || []).join(', ') || '—'}</td>
                <td style="padding:6px 8px;border:1px solid #D1D5DB">${(item.allergens || []).map((a: string) => `<span style="background:#FEE2E2;color:#991B1B;padding:1px 4px;border-radius:3px;font-size:9px;margin-right:2px">${a}</span>`).join(' ') || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`
    }

    // Storage notes
    if (shoppingList.storage_notes?.length > 0) {
      shoppingHtml += `
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;padding:10px;margin:12px 0">
        <strong style="color:#9A3412;font-size:12px">🧊 Storage Notes</strong>
        <ul style="margin:4px 0;padding-left:20px;font-size:10px;color:#78350F">
          ${shoppingList.storage_notes.map((n: string) => `<li>${n}</li>`).join('')}
        </ul>
      </div>`
    }

    // Tips
    if (shoppingList.tips?.length > 0) {
      shoppingHtml += `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;padding:10px;margin:12px 0">
        <strong style="color:#166534;font-size:12px">💡 Kitchen Tips</strong>
        <ul style="margin:4px 0;padding-left:20px;font-size:10px;color:#166534">
          ${shoppingList.tips.map((t: string) => `<li>${t}</li>`).join('')}
        </ul>
      </div>`
    }
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 15mm; }
  ${styles}
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <div class="cover" style="padding:40px;text-align:center;page-break-after:always">
    <div class="badge">MeticleCare</div>
    <h1 style="color:#0F4C81;font-size:28px;margin-bottom:4px">Weekly Meal Plan</h1>
    <p class="subtitle" style="color:#6B7280;font-size:16px;margin-top:0">${person.name || 'Person'}</p>
    <div class="meta" style="margin-top:30px;color:#9CA3AF;font-size:12px">
      <p>${weeklyPlan.plan_name || 'Weekly Meal Plan'}</p>
      <p>${weeklyPlan.description || ''}</p>
      <div style="margin-top:16px">
        ${contextBadges.join(' ')}
        ${allergenBadges ? '<br><br>' + allergenBadges : ''}
      </div>
      <div style="margin-top:20px">
        ${totals.avg_daily_calories ? `<span style="display:inline-block;background:#F3F4F6;padding:4px 12px;border-radius:4px;margin:4px;font-size:12px">~${totals.avg_daily_calories} kcal/day</span>` : ''}
        ${totals.avg_daily_fluid_ml ? `<span style="display:inline-block;background:#E0F2FE;padding:4px 12px;border-radius:4px;margin:4px;font-size:12px">~${totals.avg_daily_fluid_ml}ml fluid/day</span>` : ''}
      </div>
    </div>
    <p style="color:#D1D5DB;font-size:11px;margin-top:40px">Generated by MeticleCare on ${now}</p>
  </div>

  ${gridHtml}
  ${shoppingHtml}

  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #D1D5DB;font-size:9px;color:#9CA3AF;text-align:center">
    MeticleCare Weekly Meal Plan &bull; Generated ${now} &bull; This plan should be reviewed by a qualified care professional before implementation.
  </div>
</body></html>`
}

export async function generateMealPlanPdf(weeklyPlan: any, shoppingList?: any): Promise<Buffer> {
  const html = buildMealPlanHtml(weeklyPlan, shoppingList)
  return generatePdf(html, {
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    landscape: true,
    headerTemplate: '<div style="font-size:8px;color:#9CA3AF;width:100%;text-align:center;padding:3px 12mm">MeticleCare Weekly Meal Plan</div>',
    footerTemplate: '<div style="font-size:8px;color:#9CA3AF;width:100%;text-align:center;padding:3px 12mm">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  })
}
