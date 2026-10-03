import { parseJsonColumn, parseJsonArrayColumn } from '../safeJson'

describe('parseJsonColumn', () => {
  it('parses a JSON string into its value', () => {
    expect(parseJsonColumn('{"a":1}', null)).toEqual({ a: 1 })
    expect(parseJsonColumn('["x","y"]', null)).toEqual(['x', 'y'])
  })

  it('returns the fallback for a bare word instead of throwing', () => {
    // The exact case that crashed ClientDetailScreen: a human typed a plain
    // word into a text column, so JSON.parse threw "Unexpected character: P".
    expect(() => parseJsonColumn('Peanut', [])).not.toThrow()
    expect(parseJsonColumn('Peanut', [])).toEqual([])
    expect(parseJsonColumn('None', null)).toBeNull()
    expect(parseJsonColumn('N/A', 'default')).toBe('default')
  })

  it('returns the fallback for empty and nullish values', () => {
    expect(parseJsonColumn(null, [])).toEqual([])
    expect(parseJsonColumn(undefined, [])).toEqual([])
    expect(parseJsonColumn('', [])).toEqual([])
    expect(parseJsonColumn('   ', [])).toEqual([])
  })

  it('returns the fallback for malformed JSON rather than throwing', () => {
    expect(parseJsonColumn('{"a":', [])).toEqual([])
    expect(parseJsonColumn('[1,2', [])).toEqual([])
  })

  it('passes through an already-structured value', () => {
    expect(parseJsonColumn(['x'], [])).toEqual(['x'])
    expect(parseJsonColumn({ a: 1 }, null)).toEqual({ a: 1 })
  })

  it('returns the fallback for a number or boolean', () => {
    expect(parseJsonColumn(42, 'fallback')).toBe('fallback')
    expect(parseJsonColumn(true, 'fallback')).toBe('fallback')
  })
})

describe('parseJsonArrayColumn', () => {
  it('parses a JSON array', () => {
    expect(parseJsonArrayColumn('["a","b"]')).toEqual(['a', 'b'])
  })

  it('never returns a non-array, whatever the column holds', () => {
    // Flags and tags are then read with .length and .map, so anything that is
    // not an array would throw on the next line instead.
    expect(parseJsonArrayColumn('Peanut')).toEqual([])
    expect(parseJsonArrayColumn(null)).toEqual([])
    expect(parseJsonArrayColumn(undefined)).toEqual([])
    expect(parseJsonArrayColumn('')).toEqual([])
    expect(parseJsonArrayColumn('{"a":1}')).toEqual([])
    expect(parseJsonArrayColumn(7)).toEqual([])
  })
})