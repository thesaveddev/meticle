import { useColorScheme } from 'react-native'

export type ColorScheme = 'light' | 'dark'

export function useAppColorScheme(): ColorScheme {
  const scheme = useColorScheme()
  return scheme === 'dark' ? 'dark' : 'light'
}
