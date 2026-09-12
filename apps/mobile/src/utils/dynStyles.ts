import { StyleSheet } from 'react-native'
import { useMemo } from 'react'
import { useAppColors, type AppColors } from '../theme'

type StyleFn<T> = (colors: AppColors) => T

/**
 * Create a memoized StyleSheet from a function that takes the current theme colors.
 * Usage:
 *   const s = useDynStyles(c => ({
 *     title: { color: c.ink, fontSize: 20 },
 *     card: { backgroundColor: c.surface },
 *   }))
 *   <Text style={s.title}>...</Text>
 *
 * The styles re-compute only when the theme changes, not on every render.
 */
export function useDynStyles<T extends Record<string, any>>(styleFn: StyleFn<T>): T {
  const c = useAppColors()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(styleFn(c) as any), [c])
}
