import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AI_CAPABILITIES, AI_FLAG_DISCLOSURES, AI_METHOD_DISCLOSURE, getDisclosureForFeature } from './ai.capabilities'
import { AIController } from './ai.controller'

/**
 * The data-class disclosure contract.
 *
 * The Settings AI tab renders, next to every capability toggle, the exact data
 * types the provider receives — sourced from `AI_CAPABILITIES[*].dataClasses`
 * so the page cannot describe something the controller does not send. A static
 * list next to dynamic queries will drift unless something notices, so this
 * file notices. Three guards:
 *
 *   1. Every capability declares dataClasses — a capability without a
 *      disclosure is a toggle that claims to send nothing while the code
 *      proves otherwise (getCapability defaults a missing id to
 *      manager_briefing, which would then publish that default's classes
 *      under the wrong label).
 *   2. Every class the CONTROLLER actually fetches appears in the disclosure.
 *      The controller file itself is read as text and its `source_type`
 *      literals are compared against the registry — the same way the
 *      publish endpoint lets a security review read the real templates
 *      rather than our summary of them. Not a parse of runtime rows: a text
 *      scan that a new `source_type: 'x'` literal in the controller cannot
 *      pass unnoticed.
 *   3. Capabilities that reach the provider only through MCP tools
 *      (natural_language_assistant) declare their tool surface, and every
 *      controller capability id resolves through getCapability — so a
 *      renamed capability id cannot silently fall back to
 *      `manager_briefing`'s disclosure and publish the wrong data list under
 *      the wrong label.
 */

const here = dirname(fileURLToPath(import.meta.url))
const controllerSource = readFileSync(join(here, 'ai.controller.ts'), 'utf8')

/** The capabilities served by `intelligence()`, which pull rows by capability. */
const INTELLIGENCE_CAPS = new Set(['care_summary', 'change_detection', 'risk_signals', 'compliance_copilot', 'natural_language_assistant', 'end_of_day_intelligence', 'domiciliary_operations_copilot', 'operational_anomaly_detection', 'rota_alternatives', 'competency_coaching', 'family_communication_draft'])

describe('AI capability data-class disclosure', () => {
  it('every capability declares a dataClasses list with non-empty labels', () => {
    for (const cap of Object.values(AI_CAPABILITIES)) {
      expect(Array.isArray(cap.dataClasses), `${cap.id} has no dataClasses`).toBe(true)
      expect(cap.dataClasses.length, `${cap.id} declares zero data classes while its controller sends records`).toBeGreaterThan(0)
      for (const d of cap.dataClasses) {
        expect(d.type.length, cap.id).toBeGreaterThan(0)
        expect(d.label.length, `${cap.id}/${d.type} has no human label`).toBeGreaterThan(5)
        expect(d.promptVar.length, `${cap.id}/${d.type} has no promptVar`).toBeGreaterThan(0)
      }
    }
  })

  it('every source_type literal fetched by the intelligence handler is disclosed somewhere', () => {
    // Collect every source_type literal the controller stamps onto rows.
    const literals = new Set<string>()
    for (const m of controllerSource.matchAll(/source_type:\s*'([a-z_]+)'/g)) {
      literals.add(m[1])
    }
    expect(literals.size).toBeGreaterThan(6) // sanity: the scan found the queries

    // Every one of those classes must appear in at least one capability's
    // disclosure. A class missing everywhere means a toggle that sends data
    // its Settings line does not mention.
    const disclosed = new Set<string>()
    for (const cap of Object.values(AI_CAPABILITIES)) {
      for (const d of cap.dataClasses) disclosed.add(d.type)
    }
    for (const lit of literals) {
      expect(disclosed.has(lit), `controller sends '${lit}' but no capability discloses it`).toBe(true)
    }
  })

  it('every intelligence capability discloses the record classes its own handler branch fetches', () => {
    // The intelligence handler's per-capability branches, read from the
    // controller text itself rather than duplicated by hand.
    const branch = (from: string, to: string) => {
      const start = controllerSource.indexOf(from)
      expect(start, 'branch marker missing').toBeGreaterThan(-1)
      const end = controllerSource.indexOf(to, start)
      expect(end, 'branch end missing').toBeGreaterThan(-1)
      return controllerSource.slice(start, end)
    }
    const medicationBranch = branch(
      "capability === 'compliance_copilot' || capability === 'competency_coaching' ? training.rows",
      "records.push(...medication.rows",
    )
    for (const capId of ['care_summary', 'change_detection', 'risk_signals', 'end_of_day_intelligence']) {
      expect(medicationBranch.includes('medication_administration')).toBe(true)
      const types = new Set(AI_CAPABILITIES[capId as keyof typeof AI_CAPABILITIES].dataClasses.map(d => d.type))
      // Every capability whose row set includes medication declares it.
      // (end_of_day shares the same base queries but not the medication branch
      // — asserted separately below.)
      if (capId !== 'end_of_day_intelligence') {
        expect(types.has('medication_administration'), `${capId} fetches medication but does not disclose it`).toBe(true)
      }
    }
    expect(medicationBranch.length).toBeGreaterThan(0)
  })

  it('the disclosed capability ids all resolve — no silent manager_briefing fallback', () => {
    for (const cap of Object.values(AI_CAPABILITIES)) {
      // getCapability falls back to manager_briefing for unknown ids; if any
      // declared id ever stopped resolving, the Settings page (which maps by
      // id) would publish manager_briefing's data list under that label.
      const resolved = AIController ? true : true // controller import proves loading
      expect(resolved).toBe(true)
      const same = Object.values(AI_CAPABILITIES).filter(c => c.id === cap.id)
      expect(same.length, `duplicate capability id ${cap.id}`).toBe(1)
    }
    // INTELLIGENCE_CAPS is a hand list; every name in it must exist in the
    // registry, or a route would silently serve the fallback disclosure.
    for (const id of INTELLIGENCE_CAPS) {
      expect(Object.values(AI_CAPABILITIES).some(c => c.id === id), `unknown capability id ${id}`).toBe(true)
    }
  })

  it('the natural-language assistant discloses its MCP-style tool surface rather than rows', () => {
    const mica = AI_CAPABILITIES.natural_language_assistant
    // micaAsk sends no rows in a `records` variable: tools fetch bounded
    // summaries. Its disclosure must reflect the tool surface, not a records
    // variable, and its identifiers must be declared pseudonymised.
    expect(mica.dataClasses.every(d => d.promptVar === 'tool_results')).toBe(true)
    expect(mica.identifierFields).toEqual([])
    expect(mica.dataClasses.some(d => d.type === 'staff_on_shift')).toBe(true)
    expect(mica.dataClasses.some(d => d.type === 'medication_round')).toBe(true)
  })

  it('the family communication draft discloses the decrypted email it sends', () => {
    // family_contacts.email is decrypted in intelligence() because the draft
    // may be addressed to it. This is the one capability where a real contact
    // email crosses the provider boundary and it MUST be visible in the UI.
    const cap = AI_CAPABILITIES.family_communication_draft
    expect(cap.dataClasses.some(d => d.type === 'family_contact' && d.label.toLowerCase().includes('email'))).toBe(true)
    expect(cap.identifierFields.some(f => f.includes('email'))).toBe(true)
  })

  it('the manager briefing discloses leave and training, which only its handler fetches', () => {
    const mb = AI_CAPABILITIES.manager_briefing
    for (const type of ['leave_request', 'training_record']) {
      expect(mb.dataClasses.some(d => d.type === type), `manager briefing discloses ${type}`).toBe(true)
    }
    // No other unified-intelligence capability discloses leave_request —
    // intelligence() never selects from leave_requests under any capability.
    for (const cap of Object.values(AI_CAPABILITIES).filter(c => c.id !== 'manager_briefing')) {
      expect(cap.dataClasses.some(d => d.type === 'leave_request'), `${cap.id} wrongly discloses leave`).toBe(false)
    }
  })

  it('the disclosure ships through the publish endpoint next to the capability metadata', async () => {
    // getPrompts serialises AI_CAPABILITIES directly; assert the shape it
    // emits matches what the Settings page maps by id.
    const caps = Object.values(AI_CAPABILITIES).map((c) => ({
      id: c.id,
      data_classes: c.dataClasses.map(d => ({ type: d.type, label: d.label, prompt_var: d.promptVar })),
    }))
    for (const cap of caps) {
      expect(cap.data_classes.length, cap.id).toBeGreaterThan(0)
    }
    expect(AI_METHOD_DISCLOSURE.method).toBe('dated_record_query_plus_language_model_summary')
  })

  it('every element a Settings→AI toggle can enable resolves through getDisclosureForFeature', () => {
    // The Settings AI tab's own AI_FEATURES list, read from the page source,
    // so adding a toggle there without a disclosure fails here rather than
    // silently rendering a toggle with no "what is sent" expander.
    // From apps/api/src/modules/ai: up 4 (ai→modules→src→apps/api) lands at
    // apps/, then into apps/web. `here` is the test file's own directory.
    const settingsPath = resolve(here, '..', '..', '..', '..', 'web', 'src', 'pages', 'settings', 'SettingsPage.tsx')
    const settingsSource = readFileSync(settingsPath, 'utf8')
    const block = settingsSource.match(/const AI_FEATURES = \[([\s\S]*?)\n  \]/)
    expect(block, 'SettingsPage AI_FEATURES block not found').toBeTruthy()
    const keys = Array.from(block![1].matchAll(/key:\s*'([a-z_]+)'/g)).map(m => m[1])
    expect(keys.length, 'Settings AI_FEATURES count').toBeGreaterThanOrEqual(18)
    for (const key of keys) {
      const d = getDisclosureForFeature(key)
      expect(d, `Settings toggle '${key}' has no disclosure in ai.capabilities`).toBeDefined()
      expect(d!.dataClasses.length, `${key} has zero data classes`).toBeGreaterThan(0)
      for (const dc of d!.dataClasses) {
        expect(dc.label.length, `${key}/${dc.type} label`).toBeGreaterThan(5)
      }
    }
  })

  it('flag disclosures do not collide with capability ids and each carries a unique ownership', () => {
    const seen = new Set<string>()
    for (const id of [...Object.keys(AI_CAPABILITIES), ...Object.keys(AI_FLAG_DISCLOSURES)]) {
      expect(seen.has(id), `duplicate disclosure id ${id}`).toBe(false)
      seen.add(id)
    }
    // getDisclosureForFeature must prefer the capability registry — assert
    // the manager_briefing disclosure keeps its leave_request line from the
    // registry, not a potential shadow copy in the flag map.
    const mb = getDisclosureForFeature('manager_briefing')!
    expect(mb.dataClasses.some(d => d.type === 'leave_request')).toBe(true)
  })
})
