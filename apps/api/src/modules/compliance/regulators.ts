/**
 * The four UK service regulators, and where each one is registered.
 *
 * Why this exists. Migration 128 gave the *staff vetting* side of a nation a
 * registry. The other side — "which body regulates this service, and what is
 * our registration number with them" — had nowhere to live at all. There was no
 * registration field on an organisation for any regulator, England included, so
 * a Welsh provider was not specially unable to record a registration number: the
 * capability was simply missing, and the one field people assumed existed
 * ("DBS") was the England-and-Wales background check, not a registration.
 *
 * Two axes, deliberately kept apart, because conflating them is the mistake
 * Wales invites:
 *
 *   - Service regulators register *services and providers*. CQC, CIW, the Care
 *     Inspectorate and RQIA. A provider is registered with these.
 *   - Workforce bodies register *individuals*. Social Care Wales and the
 *     Northern Ireland Social Care Council sit here. Social Care Wales in
 *     particular does NOT register care services — CIW does. Treating an SCW
 *     number as a provider registration would be recording the wrong document.
 *
 * On formats. A `formatHint` is present only where it is verified, and it is a
 * hint shown to the user, not a validation rule — a wrong regex on a regulator's
 * own numbering scheme is how a real registration number gets rejected. CIW is
 * the one with a published format (gov.wales, 22 December 2022). CQC and RQIA
 * publish registers but we have not verified their numbering, so there is no
 * hint for them rather than a guessed one. Confirming those is T2-17.
 */

export type RegulatorId = 'cqc' | 'ciw' | 'care-inspectorate' | 'rqia'

/** A body that registers services, as opposed to one that registers people. */
export type RegulatorRole = 'service' | 'workforce'

export type RegulatorDef = {
  id: RegulatorId
  /** The body's name as it styles itself. */
  name: string
  /** The nation or nations whose services it regulates. */
  nations: string[]
  role: RegulatorRole
  /** What the body is, in one line, for the settings screen. */
  description: string
  /** What this registration is called, e.g. "CQC registration number". */
  registrationLabel: string
  /** Where the public register is, so a manager can check the number. */
  registerUrl: string
  /**
   * A published example of the numbering, where one is verified.
   *
   * Absent means "we have not verified one", not "no format exists". Shown to
   * the user as a hint; never used to reject a value.
   */
  formatHint?: string
  /** Which vetting scheme belongs to this regulator, when it has one. */
  vettingScheme?: string
  note: string
}

export const REGULATORS: Record<RegulatorId, RegulatorDef> = {
  cqc: {
    id: 'cqc',
    name: 'Care Quality Commission',
    nations: ['england'],
    role: 'service',
    description: 'Registers and inspects health and adult social care services in England.',
    registrationLabel: 'CQC registration number',
    registerUrl: 'https://www.cqc.org.uk/',
    vettingScheme: 'dbs_england_wales',
    note: 'The regulator for England. Providers are registered with the CQC, not with Social Care England, which has no registration role.',
  },
  ciw: {
    id: 'ciw',
    name: 'Care Inspectorate Wales',
    nations: ['wales'],
    role: 'service',
    description: 'Registers and inspects social care and childcare services in Wales.',
    registrationLabel: 'CIW registration number',
    registerUrl: 'https://www.careinspectorate.wales/register-provide-service',
    // Verified, gov.wales "Care Inspectorate Wales (CIW) registration number",
    // 22 December 2022: newer numbers are 11 characters beginning CYM, e.g.
    // CYM00002456. Older numbers start with W and are 10 or 12 characters, and
    // may contain a forward slash which must be kept.
    formatHint: 'Newer numbers are 11 characters and begin CYM, e.g. CYM00002456. Older numbers begin W and are 10 or 12 characters, and may contain a forward slash which must be kept.',
    vettingScheme: 'ciw_wales',
    note: 'CIW registers services in Wales under the Regulation and Inspection of Social Care (Wales) Act 2016. This is not the same as a Social Care Wales number: Social Care Wales registers individuals in the workforce, not services.',
  },
  'care-inspectorate': {
    id: 'care-inspectorate',
    name: 'Care Inspectorate',
    nations: ['scotland'],
    role: 'service',
    description: 'Registers and inspects care homes and other social care services in Scotland.',
    registrationLabel: 'Care Inspectorate registration number',
    registerUrl: 'https://www.careinspectorate.com/',
    vettingScheme: 'pvg_scotland',
    note: 'Scottish background checks are PVG records, run by Disclosure Scotland, not DBS. See the vetting registry.',
  },
  rqia: {
    id: 'rqia',
    name: 'Regulation and Quality Improvement Authority',
    nations: ['northern_ireland'],
    role: 'service',
    description: 'Registers and inspects health and social care services in Northern Ireland.',
    registrationLabel: 'RQIA registration number',
    registerUrl: 'https://www.rqia.org.uk/register/',
    vettingScheme: 'accessni_northern_ireland',
    // The Order is the Health and Personal *Social* Services (Quality,
    // Improvement and Regulation) (Northern Ireland) Order 2003 — confirmed on
    // both rqia.org.uk/guidance/legislation-and-standards and
    // health-ni.gov.uk/articles/care-standards. It was written here as
    // "Personal Care Services", which is not the title of the instrument.
    // DoH publishes nine sets of minimum standards, one per kind of service,
    // which the RQIA uses alongside the regulations for that setting. See
    // inspectionFrameworks.ts, which is where that lives.
    note: 'Established under the Health and Personal Social Services (Quality, Improvement and Regulation) (Northern Ireland) Order 2003. Northern Irish background checks are AccessNI, not DBS.',
  },
}

/**
 * The workforce bodies, listed separately and never used as a service
 * registration.
 *
 * Kept out of REGULATORS so that a service registration cannot be recorded
 * against one of them by accident. Which roles require registration varies and
 * is not asserted here; tracked as T2-18.
 */
export const WORKFORCE_BODIES: Array<Pick<RegulatorDef, 'id' | 'name' | 'nations' | 'registerUrl' | 'note'>> = [
  {
    id: 'cqc',
    name: 'Social Care Wales',
    nations: ['wales'],
    registerUrl: 'https://socialcare.wales/registration',
    note: 'Registers individuals working in social care in Wales. Not a service register — CIW registers services.',
  },
  {
    id: 'rqia',
    name: 'Northern Ireland Social Care Council',
    nations: ['northern_ireland'],
    registerUrl: 'https://www.niscc.org/',
    note: 'The Northern Ireland workforce body. Not a service register — RQIA registers services.',
  },
]

export function getRegulator(id: string | null | undefined): RegulatorDef | null {
  if (!id) return null
  return REGULATORS[id as RegulatorId] ?? null
}

export function isRegulatorId(id: string | null | undefined): id is RegulatorId {
  return !!id && id in REGULATORS
}

export function listRegulators(): RegulatorDef[] {
  return Object.values(REGULATORS)
}

/** Regulators that could inspect a service in the given nation. */
export function regulatorsForNation(nation: string): RegulatorDef[] {
  return listRegulators().filter((r) => r.nations.includes(nation))
}
