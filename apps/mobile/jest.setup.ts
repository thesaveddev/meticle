/**
 * Global test setup. jest-expo mocks most of the Expo surface, but the modules
 * below reach for native code that does not exist under jest, so they are
 * replaced with the library's own mock or with inert stubs. Individual test
 * files mock the app's own services (haptics, notifications, api) as needed.
 */
// @testing-library/react-native v13 installs its matchers on import, so the
// jest-expo preset needs nothing else here.

// Ships an official in-memory mock; without it every storage call resolves to null
// through a missing native module and tests hang or throw.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// @expo/vector-icons loads its font set asynchronously on first render, which in jest
// resolves after the test has finished and reports an act() warning that says nothing
// about the code under test. Every icon family becomes an inert component. The app's own
// icons (src/components/Icons.tsx) are drawn from Views and are deliberately left real.
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const families = new Map<string, unknown>()
  return new Proxy(
    {},
    {
      get: (_target, family: string) => {
        if (!families.has(family)) {
          families.set(family, (props: Record<string, unknown>) => React.createElement('Icon', props))
        }
        return families.get(family)
      },
    }
  )
})

// Reanimated drives the launch splash waves, and its worklet runtime has no jest
// equivalent. The library's own `react-native-reanimated/mock` is no longer usable
// here: on v4 it loads the real worklets initialisers, which reach for a native
// module that does not exist under jest and throw before any test runs. So stand
// in a mock for exactly the surface this app uses — Animated.View, the shared
// value and animation helpers, and Easing.
//
// The animation itself is not asserted, deliberately: these tests cover the
// splash's composition and visibility, not its frames. Anything that needs to
// verify motion belongs in a real-device or snapshot test, not here.
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native')

  // Easing is called as Easing.inOut(Easing.ease), so the inner function is the
  // value the outer one receives and must hand straight back.
  const identity = <T,>(fn: T): T => fn

  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      Image: RN.Image,
      ScrollView: RN.ScrollView,
      createAnimatedComponent: (component: unknown) => component,
    },
    Easing: {
      ease: identity,
      linear: identity,
      inOut: identity,
      out: identity,
      in: identity,
      bezier: () => identity,
    },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: <T,>(factory: () => T) => factory(),
    useDerivedValue: <T,>(factory: () => T) => ({ value: factory() }),
    useAnimatedRef: () => null,
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    interpolate: (value: number) => value,
    runOnJS: (fn: unknown) => fn,
  }
})

// Haptics are cosmetic: the app-level behaviour is tested through the app's own
// haptics service, and the native module simply has no implementation in jest.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))
