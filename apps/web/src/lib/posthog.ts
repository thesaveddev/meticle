import posthog from 'posthog-js'

const apiKey = import.meta.env.VITE_POSTHOG_KEY
const apiHost = import.meta.env.VITE_POSTHOG_HOST

if (!apiKey && import.meta.env.DEV) {
  throw new Error(
    'VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured',
  )
}

if (!apiHost && import.meta.env.DEV) {
  throw new Error(
    'VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured',
  )
}

if (apiKey && apiHost) {
  posthog.init(apiKey, {
    api_host: apiHost,
    capture_exceptions: true,
  })
}

export default posthog
