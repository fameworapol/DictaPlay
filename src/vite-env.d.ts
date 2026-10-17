/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Shared-secret header value sent with sync requests. Obscurity, not security — see src/lib/storage/sync/client.ts. */
  readonly VITE_SYNC_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
