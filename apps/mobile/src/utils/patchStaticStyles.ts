import { useMemo } from 'react'
import { useAppColors, type AppColors, colors as staticColors } from '../theme'

/**
 * Patches all static color references in a StyleSheet at render time.
 * Usage: const patchedStyles = useDynamicStyles(styles)
 * Then use patchedStyles instead of styles in your JSX.
 *
 * This walks through every style in the static stylesheet and replaces
 * any color value matching a light-theme color with the corresponding
 * dynamic theme color.
 */
export function useDynamicStyles(staticStyles: Record<string, any>): Record<string, any> {
  const c = useAppColors()

  return useMemo(() => {
    // Build a lookup: static color value → dynamic color value
    const colorMap: Record<string, string> = {}
    for (const key of Object.keys(staticColors) as (keyof typeof staticColors)[]) {
      const staticVal = staticColors[key] as string
      const dynamicVal = (c as any)[key] as string
      if (staticVal && dynamicVal && staticVal !== dynamicVal) {
        colorMap[staticVal.toLowerCase()] = dynamicVal
      }
    }
    // Also map partial color + opacity patterns like "#1A233240"
    for (const [staticVal, dynamicVal] of Object.entries(colorMap)) {
      // Map staticVal + 'XX' opacity suffixes
      for (const key of Object.keys(staticColors) as (keyof typeof staticColors)[]) {
        const sv = staticColors[key] as string
        const dv = (c as any)[key] as string
        if (sv && dv && sv.startsWith('#') && sv.length === 7) {
          // Map hex + alpha like "#1A2332" + "20" → dynamic equivalent
          colorMap[(sv + '20').toLowerCase()] = (dv + '20')
          colorMap[(sv + '30').toLowerCase()] = (dv + '30')
          colorMap[(sv + '40').toLowerCase()] = (dv + '40')
          colorMap[(sv + '15').toLowerCase()] = (dv + '15')
          colorMap[(sv + '25').toLowerCase()] = (dv + '25')
        }
      }
    }

    const patchValue = (val: any): any => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase()
        if (colorMap[lower]) return colorMap[lower]
        return val
      }
      if (Array.isArray(val)) return val.map(patchValue)
      if (val && typeof val === 'object') {
        const result: Record<string, any> = {}
        for (const [k, v] of Object.entries(val)) {
          result[k] = patchValue(v)
        }
        return result
      }
      return val
    }

    const patched: Record<string, any> = {}
    for (const [key, value] of Object.entries(staticStyles)) {
      patched[key] = patchValue(value)
    }
    return patched
  }, [c, staticStyles])
}
