import { createElement } from 'react'
import { Text } from 'react-native'

/**
 * Stub used by App.test.tsx to isolate the tab wiring from the screens.
 *
 * Each stub renders a marker (`screen:<name>`) so a test can assert which screen
 * a tab mounted, and records the props it was handed so a test can assert what
 * the wiring passed down (a session, or an absent `onAvailability` for managers).
 */
export const screenProps: Record<string, any> = {}

export function stub(name: string) {
  function ScreenStub(props: any) {
    screenProps[name] = props
    return createElement(Text, null, `screen:${name}`)
  }
  return ScreenStub
}

export function resetScreenProps() {
  for (const key of Object.keys(screenProps)) delete screenProps[key]
}
