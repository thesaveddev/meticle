/**
 * Identity document types across the four UK nations.
 *
 * The upload dialogs used to offer DBS, Passport, Visa and Right to Work and
 * nothing else, which made the API's nation-specific support unusable: a
 * Scottish manager was shown the right columns to check for a PVG certificate
 * and had no way to actually upload one. Anything not in this list cannot be
 * attached to a staff record at all.
 *
 * DBS is the England and Wales check. PVG and Disclosure Scotland are the two
 * routes into the Scottish scheme, and AccessNI is Northern Ireland's. A
 * document type appearing here does not mean the provider's regulator accepts
 * it — which scheme applies is set per organisation, and per person where they
 * work across a border. The API decides that; this list is only the vocabulary.
 */
export const IDENTITY_DOCUMENT_TYPES = [
  { value: 'DBS', label: 'DBS Check' },
  { value: 'PVG', label: 'PVG Record' },
  { value: 'DISCLOSURE_SCOTLAND', label: 'Disclosure Scotland Record' },
  { value: 'ACCESSNI', label: 'AccessNI Check' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VISA', label: 'Visa' },
  { value: 'RIGHT_TO_WORK', label: 'Right to Work' },
] as const

/** Every accepted type as a plain array, for menus. */
export const IDENTITY_TYPE_VALUES: string[] = IDENTITY_DOCUMENT_TYPES.map((t) => t.value)

const LABELS: Record<string, string> = Object.fromEntries(
  IDENTITY_DOCUMENT_TYPES.map((t) => [t.value, t.label]),
)

/** A display name for a type, falling back to the raw value. */
export function identityTypeLabel(type: string): string {
  return LABELS[type] ?? type
}

const NATION_LABELS: Record<string, string> = {
  england: 'England',
  wales: 'Wales',
  scotland: 'Scotland',
  northern_ireland: 'Northern Ireland',
}

/** A display name for a nation, falling back to the raw value. */
export function nationLabel(nation: string | undefined | null): string {
  if (!nation) return ''
  return NATION_LABELS[nation] ?? nation
}
