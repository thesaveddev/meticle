/**
 * Which medicines-in-care framework applies to a provider, and what it requires.
 *
 * The gap this closes, stated plainly. The eMAR enforced one thing about who may
 * give a medicine: a single boolean on the staff record, `medication_competent`,
 * set by a manager and never expiring. Everything else that a provider in
 * England, Wales or Scotland is actually held to was prose — a paragraph in a
 * seeded policy, a column on a printed MAR with underscores in it, a bullet on
 * the marketing site. Nothing in the software knew which country the provider
 * was in, so nothing could differ between them. A Scottish provider was
 * administered medicines on exactly the same terms as a Welsh one, and the only
 * rule that would have caught the difference — that covert administration sits
 * on a completely different legal footing north of the border — was not
 * expressible.
 *
 * The precedent is `compliance.vetting.ts`, which already made staff vetting
 * nation-aware after the same shape of bug: treating the England and Wales
 * background check as the only one, so Scottish staff were marked non-compliant
 * for not holding a document Scotland does not use. Medication is the same
 * failure one module over, and it is the same fix: a registry of what applies
 * where, resolved from data the provider has already given us, with the
 * differences encoded as values rather than branches.
 *
 * ── What this is not ──────────────────────────────────────────────────────
 *
 * This is not a claim that we are compliant with any of these frameworks, and
 * it is not advice on what the law requires. It tells the software which
 * framework a provider is operating under so it can ask for the right
 * evidence. The provider is the regulated party; we are the system that holds
 * their record. Where this file names a document, the name is the one the
 * sector uses for it — the framework identifier is stable, the edition and date
 * are not something we have verified against a primary source, and
 * `verifiedAgainstPrimarySource` is false for every entry to say so where a
 * reader can see it. Confirming those editions against the regulators is an
 * owner action, tracked as T2-22, and it is the same caveat that already sits
 * on the vetting registry as T2-12.
 *
 * That is a deliberate limit on what is asserted here. It would have been easy
 * to write specific statutory mechanics into this file and it would have been
 * the wrong thing to do: a wrong section number in a registry that gates
 * whether a care worker may give a medicine is worse than an honest gap, and
 * nobody reading this module would be able to tell which parts had been checked.
 */

/** The service regulator a provider is registered with. Reuses the compliance registry's ids. */
export type MedicationRegulator = 'cqc' | 'ciw' | 'care-inspectorate' | 'rqia'

/** The nation whose medicines-in-care framework applies. */
export type MedicationNation = 'england' | 'wales' | 'scotland' | 'northern_ireland'

/**
 * How hard a rule is enforced, which is the honest description of the system.
 *
 *   'blocked'  — an administration or a medicine record is refused outright if
 *                this is not satisfied. The refusal is the control.
 *   'recorded' — the system captures the evidence and will report on it, but
 *                refusing would strand a provider mid-shift. Said plainly in
 *                the readiness response rather than implied by silence.
 *
 * The distinction is the whole point of this file. A list of requirements that
 * do not gate anything is a description, and the sector has enough of those.
 * Anything that is only `recorded` says so out loud, in the product, so a
 * manager reading their readiness cannot mistake a warning for a control.
 */
export type RuleEnforcement = 'blocked' | 'recorded'

export type MedicationRule = {
  id: string
  /** Shown on the readiness screen, in the provider's words rather than a section number. */
  title: string
  /** What the system does about it. Never inferred from `id`. */
  enforcement: RuleEnforcement
  /**
   * What the provider would be told if this is not met.
   *
   * Written out in full so the API can return the sentence rather than making
   * the web and mobile apps each write their own, which is how a guarantee
   * drifts between platforms.
   */
  requirement: string
  /**
   * True where this rule is the same in every nation modelled.
   *
   * The readiness screen greys these out under a "common to all three
   * frameworks" heading, so that the rules that actually differ — the ones a
   * provider is being inspected against in its own country — are the ones they
   * read. A list of fifteen identical rows teaches nothing.
   */
  commonToAllNations: boolean
}

export type MedicationFramework = {
  id: string
  /** The framework's own name, as the sector uses it. */
  name: string
  nation: MedicationNation
  regulator: MedicationRegulator
  /** The body that inspects against this framework. */
  inspectedBy: string
  /**
   * The legal instrument that covert administration rests on, by name only.
   *
   * This is the sharpest difference between the three and the reason this
   * module exists. In England and Wales, covert administration is a
   * best-interests decision under the Mental Capacity Act 2005. In Scotland it
   * is not: it is exercised under the welfare powers in the Mental Welfare
   * (Scotland) Act 2000, and the Mental Welfare Commission expects a written
   * protocol for it. A system that asked a Scottish provider for a DoLS-style
   * best-interests determination would be asking for a document that is not
   * the instrument, and would accept one as satisfying the rule.
   */
  covertAuthority: {
    /** Named in a sentence, for the screen and the audit trail. */
    instrument: string
    /** What the provider has to record alongside it. Differs by nation. */
    requires: string
  }
  /**
   * Longest gap between structured medication reviews, in months.
   *
   * Data, not a constant, because the three are not identical and a future
   * framework will not be either. Null means the framework does not put a
   * number on it and the software will not invent one.
   */
  medicationReviewIntervalMonths: number | null
  /**
   * Whether a second competent person must witness a controlled drug being
   * given, and whether that person needs the controlled-drug scope themselves.
   */
  controlledDrugWitnessing: {
    required: boolean
    /** True where the witness must also hold the controlled-drug scope. */
    witnessMustBeCompetent: boolean
  }
  /** True where a PRN medicine cannot be prescribed without a stated indication. */
  requiresPrnIndication: boolean
  rules: MedicationRule[]
  /**
   * Explicitly false on every entry today. See the header.
   *
   * Not decoration: the readiness endpoint returns it, and a provider or an
   * inspector is entitled to know that the framework list came from us and not
   * from their regulator.
   */
  verifiedAgainstPrimarySource: boolean
  /** Where the reader should go to check it themselves. */
  sourceNote: string
  note: string
}

/* ── The rules that are the same everywhere ─────────────────────────────────── */

const RESPONSIBLE_CLINICIAN: MedicationRule = {
  id: 'responsible_clinician_named',
  title: 'A named registered clinician is responsible for medicines',
  enforcement: 'blocked',
  commonToAllNations: true,
  requirement:
    'Medicines may only be administered while a named registered nurse or registered pharmacist is recorded as responsible for them, and that appointment is in date. Record one before the first dose.',
}

const STAFF_COMPETENCE: MedicationRule = {
  id: 'staff_competence_current',
  title: 'Everyone who administers holds current, assessed competence',
  enforcement: 'blocked',
  commonToAllNations: true,
  requirement:
    'The person giving the medicine must hold a recorded medication competence assessment that has not expired. A single tick on a staff record is not enough, because it cannot be dated, scoped or expired.',
}

const CONTROLLED_DRUG_COMPETENCE: MedicationRule = {
  id: 'controlled_drug_competence',
  title: 'Controlled drugs need their own competence, not just medication competence',
  enforcement: 'blocked',
  commonToAllNations: true,
  requirement:
    'A controlled drug may only be given by someone assessed as competent for controlled drugs specifically. General medication competence does not cover it.',
}

const CONTROLLED_DRUG_WITNESS: MedicationRule = {
  id: 'controlled_drug_witnessed',
  title: 'A controlled drug is given with a witness recorded',
  enforcement: 'blocked',
  commonToAllNations: false,
  requirement:
    'Recording a controlled drug as given requires a second, different person to be recorded as witnessing it. The witness is stored on the dose, not on a printed sheet.',
}

const PRN_INDICATION: MedicationRule = {
  id: 'prn_indication_stated',
  title: 'A "as needed" medicine carries the reason it is needed',
  enforcement: 'blocked',
  commonToAllNations: true,
  requirement:
    'A medicine recorded as "as needed" cannot be added without stating what it is for and the maximum that may be given in 24 hours. A PRN medicine with no indication cannot be given safely by anyone.',
}

const PRN_REASON_AT_THE_TIME: MedicationRule = {
  id: 'prn_reason_recorded_when_given',
  title: 'A PRN dose records why it was given',
  enforcement: 'blocked',
  commonToAllNations: true,
  requirement:
    'When an "as needed" medicine is recorded as given, the reason has to be recorded with that dose. Without it the record cannot be reviewed by anyone but the person who gave it.',
}

const COVERT_AUTHORISATION: MedicationRule = {
  id: 'covert_administration_authorised',
  title: 'Covert administration has a recorded, current authorisation',
  enforcement: 'blocked',
  commonToAllNations: false,
  requirement:
    'A medicine marked as given covertly needs an authorisation recorded for that person and that medicine, in date. It is a last resort in every framework, and it is never the default.',
}

const MEDICATION_REVIEW: MedicationRule = {
  id: 'structured_medication_review',
  title: 'A structured medication review is recorded and in date',
  // Recorded, not blocked, and the reason is worth stating: refusing to record a
  // dose because a review is overdue would push staff towards recording on the
  // paper MAR instead, which is strictly worse for the provider than an overdue
  // review it can see on a screen. The readiness report carries it instead.
  enforcement: 'recorded',
  commonToAllNations: false,
  requirement:
    'A structured review of the person\'s medicines should be recorded, with the date of the next one. Overdue reviews appear on the readiness report rather than blocking a dose.',
}

const SELF_ADMINISTRATION_ASSESSMENT: MedicationRule = {
  id: 'self_administration_assessed',
  title: 'Self-administration is assessed and agreed, never assumed',
  enforcement: 'recorded',
  commonToAllNations: false,
  requirement:
    'Where a person is recorded as taking their own medicines, that has to be an assessed and recorded decision for them, with a review date — not a flag on the chart.',
}

const COMMON_RULES: MedicationRule[] = [
  RESPONSIBLE_CLINICIAN,
  STAFF_COMPETENCE,
  CONTROLLED_DRUG_COMPETENCE,
  PRN_INDICATION,
  PRN_REASON_AT_THE_TIME,
]

/* ── The frameworks ────────────────────────────────────────────────────────── */

export const MEDICATION_FRAMEWORKS: Record<string, MedicationFramework> = {
  mca_england: {
    id: 'mca_england',
    name: 'Medicines for Care Homes (MCA)',
    nation: 'england',
    regulator: 'cqc',
    inspectedBy: 'Care Quality Commission',
    covertAuthority: {
      instrument: 'Mental Capacity Act 2005',
      requires:
        'A best-interests determination by the decision-maker, and a Deprivation of Liberty authorisation where one is required, recorded against the person.',
    },
    medicationReviewIntervalMonths: 12,
    controlledDrugWitnessing: { required: true, witnessMustBeCompetent: true },
    requiresPrnIndication: true,
    rules: [
      ...COMMON_RULES,
      CONTROLLED_DRUG_WITNESS,
      COVERT_AUTHORISATION,
      MEDICATION_REVIEW,
      SELF_ADMINISTRATION_ASSESSMENT,
    ],
    verifiedAgainstPrimarySource: false,
    sourceNote:
      'The MCA guidance is published by the CQC and NHS England. We carry the name the sector uses, not a verified edition or date — check the current version before a customer relies on it (T2-22).',
    note: 'The framework for providers registered with the CQC. This is the default, because England is the largest market and the column default has always been CQC.',
  },

  awmch_wales: {
    id: 'awmch_wales',
    name: 'All Wales Medicines for Care Homes (AWMCH) standard',
    nation: 'wales',
    regulator: 'ciw',
    inspectedBy: 'Care Inspectorate Wales',
    covertAuthority: {
      // Wales follows England on capacity law — the Mental Capacity Act 2005
      // applies in Wales as it does in England — but the inspection and the
      // medicines standard are Welsh. Recording that difference is the point:
      // a Welsh provider is not inspected by the CQC against the MCA, and
      // telling them they are would be the same category of error as asking a
      // Scottish worker for a DBS.
      instrument: 'Mental Capacity Act 2005',
      requires:
        'A best-interests determination by the decision-maker, and a Deprivation of Liberty authorisation where one is required, recorded against the person. Wales applies the Mental Capacity Act 2005 as England does, but the medicines standard and the inspection are Welsh.',
    },
    medicationReviewIntervalMonths: 12,
    controlledDrugWitnessing: { required: true, witnessMustBeCompetent: true },
    requiresPrnIndication: true,
    rules: [
      ...COMMON_RULES,
      CONTROLLED_DRUG_WITNESS,
      COVERT_AUTHORISATION,
      MEDICATION_REVIEW,
      SELF_ADMINISTRATION_ASSESSMENT,
    ],
    verifiedAgainstPrimarySource: false,
    sourceNote:
      'The AWMCH standard is Welsh Government / NHS Wales guidance for medicines in care homes, sitting alongside the regulatory framework for social care in Wales. Edition unverified (T2-22).',
    note: 'Welsh providers are registered with CIW, not the CQC. The vetting scheme is the same DBS scheme as England, but the medicines framework, the regulator and the inspection are not the same, and the system has to know which one it is.',
  },

  scotland_medicines_in_care: {
    id: 'scotland_medicines_in_care',
    name: 'Safe and effective use of medicines in care (Scottish medicines-in-care guidance)',
    nation: 'scotland',
    regulator: 'care-inspectorate',
    inspectedBy: 'Care Inspectorate',
    covertAuthority: {
      // The one genuinely different rule in this file, and the reason a Scottish
      // provider cannot be run on the English configuration.
      instrument: 'Mental Welfare (Scotland) Act 2000',
      requires:
        'Covert administration in Scotland is not a Mental Capacity Act best-interests decision. It rests on the welfare powers in the Mental Welfare (Scotland) Act 2000, and a written protocol for covert administration is expected. An English best-interests record does not satisfy this and must not be accepted as if it did.',
    },
    medicationReviewIntervalMonths: 12,
    controlledDrugWitnessing: { required: true, witnessMustBeCompetent: true },
    requiresPrnIndication: true,
    rules: [
      ...COMMON_RULES,
      CONTROLLED_DRUG_WITNESS,
      COVERT_AUTHORISATION,
      MEDICATION_REVIEW,
      SELF_ADMINISTRATION_ASSESSMENT,
    ],
    verifiedAgainstPrimarySource: false,
    sourceNote:
      'Scottish medicines-in-care guidance is issued by the Scottish Government for services inspected by the Care Inspectorate, and the covert-administration expectation is framed through the Mental Welfare Commission. Edition unverified (T2-22).',
    note: 'Scottish providers are registered with the Care Inspectorate. Staff vetting is PVG rather than DBS — handled by the compliance module, not this one — and covert administration sits on a different statutory footing, which is modelled here rather than described.',
  },
}

/**
 * Northern Ireland has no framework registered here.
 *
 * Not an oversight, and not the same as not existing: RQIA-registered providers
 * were, before this, being administered on the English rules with no indication
 * that anything about them was unknown. They now get England's rules explicitly
 * labelled as a fallback, with `isFallback: true` on the response, so a provider
 * in Belfast is told the software is applying another nation's framework rather
 * than being quietly given rules nobody chose.
 */
export const NO_FRAMEWORK_NOTE =
  'No medicines-in-care framework is registered for this regulator. The England framework is being applied as a fallback, which is a default and not a choice made by you. Treat every rule under it as unconfirmed until someone has checked it against the framework that actually applies to you.'

/** The framework an organisation is operating under, given its service regulator. */
export function frameworkForRegulator(regulator: string | null | undefined): {
  framework: MedicationFramework
  isFallback: boolean
  note?: string
} {
  if (regulator) {
    const match = Object.values(MEDICATION_FRAMEWORKS).find((f) => f.regulator === regulator)
    if (match) return { framework: match, isFallback: false }
  }
  return { framework: MEDICATION_FRAMEWORKS.mca_england, isFallback: true, note: NO_FRAMEWORK_NOTE }
}

export function getMedicationFramework(id: string | null | undefined): MedicationFramework {
  if (id && MEDICATION_FRAMEWORKS[id]) return MEDICATION_FRAMEWORKS[id]
  return MEDICATION_FRAMEWORKS.mca_england
}

export function listMedicationFrameworks(): MedicationFramework[] {
  return Object.values(MEDICATION_FRAMEWORKS)
}

/** The rules a framework treats as nation-specific, for the "what differs" screen. */
export function differentiatingRules(framework: MedicationFramework): MedicationRule[] {
  return framework.rules.filter((r) => !r.commonToAllNations)
}

/** The rules every framework shares, which is most of them. */
export function commonRules(): MedicationRule[] {
  const all = Object.values(MEDICATION_FRAMEWORKS)[0]?.rules.filter((r) => r.commonToAllNations) ?? []
  return all
}
