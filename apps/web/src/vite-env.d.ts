/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
