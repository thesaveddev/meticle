/**
 * Nation-specific staff vetting.
 *
 * The gap this closes, stated plainly: the compliance layer treated "DBS" as
 * the one background check, for every provider, in every nation. The Disclosure
 * and Barring Service is the England and Wales scheme. It is not recognised in
 * Scotland, which uses the PVG scheme and Disclosure Scotland, nor in Northern
 * Ireland, which uses AccessNI. A Scottish provider running MeticleCare was
 * being marked non-compliant for not holding a document that is meaningless in
 * Scotland — and a real PVG check was not one of the types it looked for.
 *
 * That is the difference between supporting four regulators at the scoring layer
 * and supporting them at the operational layer. This is the operational part,
 * for staff vetting, which is the part that determines whether a provider is
 * actually inspection-ready.
 *
 * What this is NOT: a claim that we are compliant with any of these schemes.
 * The schemes below are the correct names and tiers as a factual matter, and
 * the legal and regulatory framing around them is not ours to assert — the
 * provider is the regulated party. This registry tells the software which
 * documents to look for; it does not tell a provider they are compliant.
 *
 * Sources for the scheme names and tiers, which are stable and public:
 *   England & Wales — DBS, tiers basic / standard / enhanced / enhanced + barred
 *   Scotland — PVG (Protecting Vulnerable Groups), tiers basic / standard /
 *     advanced / advanced + barring; Disclosure Scotland is a separate
 *     disclosure route run by the same body
 *   Northern Ireland — AccessNI, tiers basic / standard / enhanced /
 *     enhanced + barred
 *   Ireland — Garda vetting, no tiers. Applications go to the National Vetting
 *     Bureau (vetting.garda.ie); disclosures are made by the Garda National
 *     Vetting Bureau, the unit formerly called the Garda Central Vetting Unit.
 *     Verified against garda.ie, 30 September 2026.
 *
 * Confirming these against current regulator guidance before a customer relies
 * on them is tracked as T2-12. Getting a tier name wrong here would make a real
 * check look missing, which is the exact failure this is meant to remove.
 *
 * ## Why Ireland is in here but not finished
 *
 * A scoping spike, not a supported regulator. What is verified is in the row:
 * the scheme exists, it is called Garda vetting, the bodies are named correctly,
 * and it has no tiers. What is not verified is right-to-work evidence, so that
 * list is empty rather than copied — see the note on the row itself and T2-29.
 * Copying the UK PASSPORT/VISA/RIGHT_TO_WORK set across would mark nearly every
 * Irish care worker non-compliant, because Ireland is in the EU and the Common
 * Travel Area and an Irish citizen needs no visa. That failure would be silent:
 * the check would run correctly against a requirement that does not exist.
 */

export type Nation = 'england' | 'wales' | 'scotland' | 'northern_ireland' | 'ireland'

export type VettingScheme = {
  /** Stable key stored on the staff record. */
  id: string
  nation: Nation
  /** The regulator whose framework this scheme exists to satisfy. */
  regulator: 'cqc' | 'ciw' | 'care-inspectorate' | 'rqia' | 'hiqa'
  /** The check itself, e.g. "DBS". Also the key used for it in status output. */
  checkName: string
  /** Body that issues and maintains the check. */
  issuer: string
  /** The tiers, weakest first. A role requirement names one of these. */
  tiers: string[]
  /**
   * Documents that satisfy the background check itself. At least one is
   * required; holding all of them is not.
   *
   * This is a set rather than a single type because Scotland has two routes
   * into the same scheme — a PVG certificate, or a Disclosure Scotland record —
   * and asking for both would tell a correctly-vetted Scottish carer that they
   * are missing a document they do not need. Everywhere else it holds one.
   */
  checkDocumentTypes: string[]
  /**
   * Documents required outright, every one of them, on top of the check.
   *
   * `PASSPORT`, `VISA` and `RIGHT_TO_WORK` are here for all four nations
   * because right-to-work checking is a UK-wide immigration requirement with
   * nothing to do with which nation's vetting scheme applies.
   */
  requiredDocumentTypes: string[]
  /**
   * Every type that counts as identity evidence for this scheme — the union of
   * the two lists above. This is what a query filters on, so it is a superset
   * of what is strictly required.
   */
  documentTypes: string[]
  /** Short note for the settings screen, so a manager can see why it differs. */
  note: string
}

/** Right-to-work evidence is a UK-wide requirement, not a nation-specific one. */
const RIGHT_TO_WORK = ['PASSPORT', 'VISA', 'RIGHT_TO_WORK']

/**
 * The Republic of Ireland's position, which is emphatically not the UK's.
 *
 * Named rather than inlined at the one row that uses it, so that the reason it
 * is empty cannot be quietly lost. Ireland is in the EU and the Common Travel
 * Area, an Irish citizen has an implicit right to work, and requiring a visa
 * document would report most Irish care workers non-compliant for a document
 * that does not apply to them. That is the Scotland/PVG defect repeated in a new
 * country, and it would be invisible because the compliance machinery is fine —
 * the requirement underneath it is what is wrong.
 *
 * Until somebody establishes what Irish right-to-work evidence is, we require
 * nothing. A visible gap beats an invisible false one. T2-29.
 */
const IRELAND_RIGHT_TO_WORK: string[] = []

/**
 * Build a scheme so the derived `documentTypes` cannot drift from the two
 * lists it is the union of. Every scheme is written through this, which is why
 * a scheme cannot be added that forgets its own union.
 */
function scheme(def: Omit<VettingScheme, 'documentTypes'>): VettingScheme {
  return { ...def, documentTypes: [...def.checkDocumentTypes, ...def.requiredDocumentTypes] }
}

export const VETTING_SCHEMES: Record<string, VettingScheme> = {
  dbs_england_wales: scheme({
    id: 'dbs_england_wales',
    nation: 'england',
    regulator: 'cqc',
    checkName: 'DBS',
    issuer: 'Disclosure and Barring Service',
    tiers: ['basic', 'standard', 'enhanced', 'enhanced_with_barred'],
    checkDocumentTypes: ['DBS'],
    requiredDocumentTypes: [...RIGHT_TO_WORK],
    note: 'The Disclosure and Barring Service covers England and Wales only.',
  }),
  ciw_wales: scheme({
    id: 'ciw_wales',
    nation: 'wales',
    regulator: 'ciw',
    checkName: 'DBS',
    issuer: 'Disclosure and Barring Service',
    tiers: ['basic', 'standard', 'enhanced', 'enhanced_with_barred'],
    checkDocumentTypes: ['DBS'],
    requiredDocumentTypes: [...RIGHT_TO_WORK],
    note: 'Wales uses the same DBS scheme as England, under CIW inspection.',
  }),
  pvg_scotland: scheme({
    id: 'pvg_scotland',
    nation: 'scotland',
    regulator: 'care-inspectorate',
    checkName: 'PVG',
    issuer: 'Protecting Vulnerable Groups (Disclosure Scotland)',
    tiers: ['basic', 'standard', 'advanced', 'advanced_with_barring'],
    checkDocumentTypes: ['PVG', 'DISCLOSURE_SCOTLAND'],
    requiredDocumentTypes: [...RIGHT_TO_WORK],
    note: 'Scotland uses the PVG scheme rather than DBS. A DBS is not accepted here.',
  }),
  accessni_northern_ireland: scheme({
    id: 'accessni_northern_ireland',
    nation: 'northern_ireland',
    regulator: 'rqia',
    checkName: 'AccessNI',
    issuer: 'AccessNI',
    tiers: ['basic', 'standard', 'enhanced', 'enhanced_with_barred'],
    checkDocumentTypes: ['ACCESSNI'],
    requiredDocumentTypes: [...RIGHT_TO_WORK],
    note: 'Northern Ireland uses AccessNI, operated on behalf of the Department of Health.',
  }),
  garda_vetting_ireland: scheme({
    id: 'garda_vetting_ireland',
    nation: 'ireland',
    regulator: 'hiqa',
    checkName: 'Garda vetting',
    // The NVB receives applications; the GNVB makes the disclosures. Naming the
    // receiving body is the one a provider actually applies to.
    issuer: 'National Vetting Bureau, An Garda Síochána',
    // One state, not four. Garda vetting has no tiers, and inventing a tier
    // ladder to fill this column would be the `NI-S1` failure again.
    tiers: ['garda_vetting_disclosure'],
    checkDocumentTypes: ['GARDA_VETTING'],
    // Deliberately empty — see IRELAND_RIGHT_TO_WORK. NOT the UK set.
    requiredDocumentTypes: [...IRELAND_RIGHT_TO_WORK],
    note: 'Garda vetting is a single process with no tiers: an organisation applies on behalf of a person and receives a disclosure. Disclosures are issued by the Garda National Vetting Bureau and go to an authorised liaison person at the organisation, so an Irish provider must appoint one. No identity document is required here yet: Irish right-to-work evidence has not been verified and the UK PASSPORT/VISA/RIGHT_TO_WORK set does not apply.',
  }),
}

/** The scheme assumed when a staff record says nothing. England is the largest market. */
export const DEFAULT_VETTING_SCHEME = 'dbs_england_wales'

export function getVettingScheme(schemeId: string | null | undefined): VettingScheme {
  if (schemeId && VETTING_SCHEMES[schemeId]) return VETTING_SCHEMES[schemeId]
  return VETTING_SCHEMES[DEFAULT_VETTING_SCHEME]
}

/** The document types to require, for one scheme or for every scheme. */
export function identityTypesFor(schemeIds: string[]): string[] {
  const types = new Set<string>()
  for (const id of schemeIds.length ? schemeIds : [DEFAULT_VETTING_SCHEME]) {
    for (const t of getVettingScheme(id).documentTypes) types.add(t)
  }
  // Stable order so a query parameter and a rendered list agree run to run.
  return [...types].sort()
}

/** Every scheme, for a settings screen or a framework listing. */
export function listVettingSchemes(): Array<Pick<VettingScheme, 'id' | 'nation' | 'checkName' | 'issuer' | 'tiers'>> {
  return Object.values(VETTING_SCHEMES).map((s) => ({
    id: s.id, nation: s.nation, checkName: s.checkName, issuer: s.issuer, tiers: s.tiers,
  }))
}

/** The scheme a regulator implies, for when an org has not chosen one. */
export function schemeForRegulator(regulator: string): VettingScheme {
  const match = Object.values(VETTING_SCHEMES).find((s) => s.regulator === regulator)
  return match ?? getVettingScheme(null)
}

/**
 * A person's effective scheme: their own override, else the organisation's.
 *
 * Staff override is a column the org can set per person; NULL means "same as
 * the organisation", which is the normal case and must never be stored as a
 * literal copy of the org value, or changing the org would silently leave
 * everyone behind.
 */
export function resolveVettingScheme(
  staffSchemeId: string | null | undefined,
  orgSchemeId: string | null | undefined,
): VettingScheme {
  if (staffSchemeId && VETTING_SCHEMES[staffSchemeId]) return VETTING_SCHEMES[staffSchemeId]
  if (orgSchemeId && VETTING_SCHEMES[orgSchemeId]) return VETTING_SCHEMES[orgSchemeId]
  return VETTING_SCHEMES[DEFAULT_VETTING_SCHEME]
}

/** Every document type that is identity evidence under any scheme. */
export function identityTypesForAllSchemes(): string[] {
  return identityTypesFor(Object.keys(VETTING_SCHEMES))
}

/** Background-check documents across every scheme — the nation-specific ones. */
export function checkDocumentTypesForAllSchemes(): string[] {
  return [
    ...new Set(Object.values(VETTING_SCHEMES).flatMap((s) => s.checkDocumentTypes)),
  ].sort()
}

/** True when this document type is identity evidence, under some scheme. */
export function isIdentityType(type: string, schemeId?: string | null): boolean {
  if (schemeId) return getVettingScheme(schemeId).documentTypes.includes(type)
  return identityTypesForAllSchemes().includes(type)
}

/**
 * A SQL CASE expression mapping a resolved scheme id to its document types.
 *
 * The queries that count identity evidence span five modules with five
 * different FROM clauses, so this is written as a self-contained expression
 * rather than a join: it drops into any of them next to the `sp` and `o`
 * columns, and — because the array literals are generated from
 * VETTING_SCHEMES rather than typed out — a scheme added here cannot be
 * forgotten in a query. `vetting.test.ts` asserts that.
 *
 * `resolvedSchemeIdSql` must evaluate to the effective scheme id, normally
 * COALESCE(sp.vetting_scheme, o.vetting_scheme), which is why those queries
 * now join organizations.
 */
export function vettingDocumentTypeSql(
  resolvedSchemeIdSql: string,
  which: 'identity' | 'check' = 'identity',
): string {
  // A quoted string cast to text[], not ARRAY{...}: Postgres has no `ARRAY{`
  // literal, and getting that wrong is a syntax error in every query that uses
  // the expression rather than a subtly wrong result.
  const literal = (types: string[]) => `'{${types.map((t) => `"${t}"`).join(',')}}'::text[]`
  const typesFor = (s: VettingScheme) =>
    which === 'check' ? s.checkDocumentTypes : s.documentTypes
  const whenClauses = Object.values(VETTING_SCHEMES).map(
    (s) => `WHEN '${s.id}' THEN ${literal(typesFor(s))}`
  )
  const fallback = literal(typesFor(getVettingScheme(DEFAULT_VETTING_SCHEME)))
  return `(CASE (${resolvedSchemeIdSql}) ${whenClauses.join(' ')} ELSE ${fallback} END)`
}
