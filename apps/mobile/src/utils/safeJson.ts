/**
 * Tolerant parsing for Postgres text columns that hold JSON.
 *
 * Columns such as `service_users.allergies`, `.flags` and `.tags` are declared
 * as text and are read back as a string that is *usually* JSON, but nothing at
 * the database level guarantees it. A row entered as a bare word — `Peanut`,
 * `None`, `N/A` — is ordinary human input, and `JSON.parse` throws on it.
 *
 * That is not a cosmetic failure: these calls sit in the render body of
 * ClientDetailScreen, so one such row took the whole screen down to a red
 * "Render Error" box with `JSON Parse error: Unexpected character: P`. The
 * reviewer's screenshot capture hit exactly this, which is how it was found.
 *
 * So the value is treated as untrusted: a string that parses to an array or
 * object is used, anything else falls back to the supplied default.
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback
  // Already structured (the API may hand back a parsed value) — use it as is.
  if (typeof value !== 'string') {
    return (typeof value === 'object' ? (value as T) : fallback)
  }
  const text = value.trim()
  // Cheap guard so an obviously non-JSON value never reaches JSON.parse.
  if (!text.startsWith('{') && !text.startsWith('[')) return fallback
  try {
    const parsed = JSON.parse(text)
    return parsed === null || parsed === undefined ? fallback : (parsed as T)
  } catch {
    return fallback
  }
}

/**
 * The common case: a text column that should hold an array of strings.
 *
 * Non-string members are dropped rather than kept as `unknown`, because every
 * caller maps straight over the result into a `<Text>`.
 */
export function parseJsonArrayColumn(value: unknown): string[] {
  const parsed = parseJsonColumn<unknown>(value, [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === 'string')
}