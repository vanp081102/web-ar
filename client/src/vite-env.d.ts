/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Express API base ending in `/api`, or leave unset to use static catalog. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
