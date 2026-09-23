declare const __DSH_TRAE_VERSION__: string | undefined

/**
 * Resolved npm package version, injected at build time by tsdown/vitest.
 * Falls back to a development marker when running unbundled from source.
 */
export const TRAE_CONNECT_VERSION: string =
  typeof __DSH_TRAE_VERSION__ === 'string' && __DSH_TRAE_VERSION__ !== ''
    ? __DSH_TRAE_VERSION__
    : '0.1.0-dev'
