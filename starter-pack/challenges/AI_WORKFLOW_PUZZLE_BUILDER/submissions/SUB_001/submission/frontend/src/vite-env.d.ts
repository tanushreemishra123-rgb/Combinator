/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set (to any truthy string) to serve the app from in-browser fixtures. */
  readonly VITE_MOCK_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
