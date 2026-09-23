import { createHash } from 'node:crypto'
import { homedir, release } from 'node:os'
import type { TraeEdition } from './paths.ts'

export interface TraeIdentity {
  edition: TraeEdition
  machineId: string
  deviceId: string
  appVersion?: string
  buildVersion?: string
  deviceBrand?: string
  deviceCpu?: string
  osVersion?: string
  platform: NodeJS.Platform
}

export function fallbackTraeIdentity(edition: TraeEdition = 'cn'): TraeIdentity {
  const seed = `${homedir()}:${process.platform}:${edition}`
  const hash = createHash('sha256').update(seed).digest('hex')
  return {
    edition,
    machineId: hash,
    deviceId: hash.slice(0, 32),
    appVersion: '1.0.8357',
    buildVersion: '20260716',
    deviceBrand: process.platform === 'darwin' ? 'Apple' : 'PC',
    deviceCpu: process.arch,
    osVersion: release(),
    platform: process.platform,
  }
}

export function identityHeaders(identity: TraeIdentity): Record<string, string> {
  return {
    'x-machine-id': identity.machineId,
    'x-device-id': identity.deviceId,
    'x-client-platform': identity.platform === 'darwin' ? 'darwin' : identity.platform === 'win32' ? 'win32' : 'linux',
    'x-device-brand': identity.deviceBrand ?? (identity.platform === 'darwin' ? 'Apple' : 'PC'),
    'x-device-model': identity.deviceBrand ?? (identity.platform === 'darwin' ? 'Apple' : 'PC'),
    'x-os-name': identity.platform === 'darwin' ? 'darwin' : identity.platform === 'win32' ? 'win32' : 'linux',
    'x-os-version': identity.osVersion ?? release(),
  }
}
