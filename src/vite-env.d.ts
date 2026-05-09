/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string;
  readonly VITE_GATEWAY_TOKEN: string;
  /**
   * Base URL of the local HQ sidecar that exposes the registry-API surface
   * (pairing requests + notification channels + notify broadcast).
   * Defaults to `http://openclaw-hq:8781` on the Tailscale tailnet — the
   * sidecar uses `tailscale whois` for source identity, so no bearer token
   * is required (and none should ever be shipped in the browser bundle).
   */
  readonly VITE_REGISTRY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
