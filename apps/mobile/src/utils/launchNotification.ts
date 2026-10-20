/**
 * Reading the notification that opened the app — once, and only once.
 *
 * Expo keeps the last notification response on the device across restarts. Read it
 * naively and an ordinary cold start two days later replays the tap the carer made
 * days ago, dropping them on a screen they did not ask for. So the response is read
 * at most once per process, and cleared from the device as soon as it has been routed.
 *
 * This lives apart from `services/notifications.ts` because that module loads
 * `expo-notifications` through a dynamic `import()` (Expo Go has no remote push on
 * Android SDK 53+, and a static import initialises it too early). `jest` cannot follow
 * a dynamic import without `--experimental-vm-modules`, so the rule would have been
 * untestable where it lives. It takes the module as a loader instead, which is the
 * same shape the service already uses and a test can supply in two lines.
 */

export type LaunchNotificationModule = {
  getLastNotificationResponseAsync(): Promise<
    { notification?: { request?: { content?: { data?: unknown } } } } | null | undefined
  >
  clearLastNotificationResponseAsync?(): Promise<void>
}

export type LaunchNotificationReader = {
  /** The data of the tap that launched this process, or null for a normal launch. */
  read(): Promise<Record<string, any> | null>
  /** Test seam: forget that the launch has been read. */
  reset(): void
}

export function createLaunchNotificationReader(
  load: () => Promise<LaunchNotificationModule | null>,
): LaunchNotificationReader {
  let consumed = false

  return {
    async read() {
      if (consumed) return null
      try {
        const module = await load()
        // A module that could not load has consumed nothing: the tap is still there
        // for a later attempt, and marking it consumed would lose the launch.
        if (!module) return null
        // A second caller that arrived while the load was in flight.
        if (consumed) return null
        consumed = true

        const response = await module.getLastNotificationResponseAsync()
        const data = response?.notification?.request?.content?.data
        // Best effort: a device that cannot clear the response should still route
        // this launch, and `consumed` already stops a second read in this process.
        if (response && typeof module.clearLastNotificationResponseAsync === 'function') {
          await module.clearLastNotificationResponseAsync().catch(() => {})
        }
        return (data as Record<string, any>) || null
      } catch {
        return null
      }
    },
    reset() {
      consumed = false
    },
  }
}
