/**
 * The two Trae products this plugin serves (Domestic CN and International Global).
 *
 * @module dsh-trae-connect/variants
 */

import {
  TRAE_AI_LOGIN_PATH,
  TRAE_AI_PROBE_PATH,
  TRAE_AI_STATUS_PATH,
  TRAE_LOGIN_PATH,
  TRAE_PROBE_PATH,
  TRAE_STATUS_PATH,
} from './status-paths.ts'

export type TraeRegion = 'cn' | 'ai'

export interface TraeVariant {
  id: string
  displayName: string
  appName: string
  region: TraeRegion
  ownFilename: string
  probeFilename: string
  catalogFilename: string
  statusPath: string
  probePath: string
  loginPath: string
}

export const TRAE_VARIANTS: readonly TraeVariant[] = [
  {
    id: 'trae',
    displayName: 'Trae',
    appName: 'Trae',
    region: 'cn',
    ownFilename: '.trae-auth.json',
    probeFilename: '.trae-probe.json',
    catalogFilename: '.trae-catalog.json',
    statusPath: TRAE_STATUS_PATH,
    probePath: TRAE_PROBE_PATH,
    loginPath: TRAE_LOGIN_PATH,
  },
  {
    id: 'trae-global',
    displayName: 'Trae Global',
    appName: 'Trae Global',
    region: 'ai',
    ownFilename: '.trae-ai-auth.json',
    probeFilename: '.trae-ai-probe.json',
    catalogFilename: '.trae-ai-catalog.json',
    statusPath: TRAE_AI_STATUS_PATH,
    probePath: TRAE_AI_PROBE_PATH,
    loginPath: TRAE_AI_LOGIN_PATH,
  },
]

export const CN_VARIANT: TraeVariant = TRAE_VARIANTS[0]!
export const AI_VARIANT: TraeVariant = TRAE_VARIANTS[1]!

export function variantFor(id: string): TraeVariant | undefined {
  return TRAE_VARIANTS.find(v => v.id === id)
}

export function variantForRegion(region: TraeRegion): TraeVariant {
  return region === 'ai' ? AI_VARIANT : CN_VARIANT
}
