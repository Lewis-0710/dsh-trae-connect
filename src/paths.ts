/**
 * Path resolution for plugin-owned files and local Trae installation discovery.
 *
 * @module dsh-trae-connect/paths
 */

import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { TraeRegion } from './variants.ts'

export const TRAE_DATA_DIR_NAME = '.dsh-trae-connect'
export const TRAE_STATE_DIR_NAME = 'state'
export const TRAE_DATA_DIR_ENV = 'DSH_TRAE_DATA_DIR'

const PROFILES_DIR_NAME = 'profiles'
const PLUGIN_PACKAGE_NAME = 'dsh-trae-connect'

function pluginPackageRoot(): string | undefined {
  try {
    return dirname(dirname(fileURLToPath(import.meta.url)))
  } catch {
    return undefined
  }
}

function profileDeclaresPlugin(profileDir: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, unknown>
      devDependencies?: Record<string, unknown>
    }
    return typeof manifest.dependencies?.[PLUGIN_PACKAGE_NAME] === 'string'
      || typeof manifest.devDependencies?.[PLUGIN_PACKAGE_NAME] === 'string'
  } catch {
    return false
  }
}

function profileLinksToThisPackage(profileDir: string): boolean {
  const own = pluginPackageRoot()
  if (own === undefined) return false
  try {
    return realpathSync(join(profileDir, 'node_modules', PLUGIN_PACKAGE_NAME)) === realpathSync(own)
  } catch {
    return false
  }
}

function discoverProfileDir(): string | undefined {
  const dshHome = resolveDshHome()
  const profilesDir = join(dshHome, PROFILES_DIR_NAME)
  let entries: string[]
  try {
    entries = readdirSync(profilesDir)
  } catch {
    return undefined
  }

  const declared: string[] = []
  for (const entry of entries) {
    const candidate = join(profilesDir, entry)
    if (profileDeclaresPlugin(candidate)) {
      declared.push(candidate)
    }
  }

  if (declared.length === 1) return declared[0]
  if (declared.length > 1) {
    const linked = declared.find(dir => profileLinksToThisPackage(dir))
    if (linked !== undefined) return linked
    return declared[0]
  }

  return undefined
}

export function traePluginDataDir(): string {
  const env = process.env[TRAE_DATA_DIR_ENV]
  if (typeof env === 'string' && env.trim() !== '') return env.trim()

  const profileDir = discoverProfileDir()
  if (profileDir !== undefined) {
    return join(profileDir, TRAE_DATA_DIR_NAME)
  }

  return join(resolveDshHome(), TRAE_DATA_DIR_NAME)
}

export function traeStateDir(): string {
  return join(traePluginDataDir(), TRAE_STATE_DIR_NAME)
}

// ---------------------------------------------------------------------------
// Local Trae Installation Discovery (from dsh-connect-trae)
// ---------------------------------------------------------------------------

export type TraeEdition = 'cn' | 'sg' | 'solo' | 'solo-sg'
export type TraeCredentialSource = 'desktop' | 'cli'

export interface TraeStorageCandidate {
  edition: TraeEdition
  path: string
  source: TraeCredentialSource
  region: TraeRegion
}

const APP_NAMES: Readonly<Record<TraeEdition, string>> = {
  cn: 'Trae CN',
  sg: 'Trae',
  solo: 'TRAE SOLO CN',
  'solo-sg': 'TRAE SOLO',
}

const LINUX_APP_NAMES: Readonly<Record<TraeEdition, readonly string[]>> = {
  cn: ['trae-cn', 'Trae CN', 'trae', 'Trae'],
  sg: ['trae', 'Trae'],
  solo: ['trae-solo-cn', 'TRAE SOLO CN'],
  'solo-sg': ['trae-solo', 'TRAE SOLO'],
}

const CLI_HOME_NAMES: readonly string[] = ['.trae-cn', '.trae']
export const TRAE_CLI_TOKEN_FILENAME = 'trae-jwt-token'

export function traeStorageCandidates(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
  env: NodeJS.ProcessEnv = process.env,
): TraeStorageCandidate[] {
  const result: TraeStorageCandidate[] = []
  for (const edition of ['cn', 'sg', 'solo', 'solo-sg'] as const) {
    const app = APP_NAMES[edition]
    const region: TraeRegion = edition === 'sg' || edition === 'solo-sg' ? 'ai' : 'cn'
    let roots: string[]
    let appNames: readonly string[]
    if (platform === 'darwin') {
      roots = [join(home, 'Library', 'Application Support')]
      appNames = [app]
    } else if (platform === 'win32') {
      roots = [env.APPDATA, join(home, 'AppData', 'Roaming')].filter((value, index, all): value is string =>
        typeof value === 'string' && value !== '' && all.indexOf(value) === index)
      appNames = [app]
    } else if (platform === 'linux') {
      roots = [env.XDG_CONFIG_HOME || join(home, '.config')]
      appNames = LINUX_APP_NAMES[edition]
    } else {
      roots = []
      appNames = [app]
    }
    for (const root of roots) {
      for (const appName of appNames) {
        result.push({
          edition,
          path: join(root, appName, 'User', 'globalStorage', 'storage.json'),
          source: 'desktop',
          region,
        })
      }
    }
  }

  return [...result, ...traeCliCandidates(platform, home, env)]
}

export function traeCliCandidates(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
  env: NodeJS.ProcessEnv = process.env,
): TraeStorageCandidate[] {
  const roots: string[] = []
  if (platform === 'win32') {
    for (const value of [env.USERPROFILE, home]) {
      if (typeof value === 'string' && value !== '' && !roots.includes(value)) roots.push(value)
    }
  } else {
    roots.push(home)
  }
  const result: TraeStorageCandidate[] = []
  for (const root of roots) {
    for (const name of CLI_HOME_NAMES) {
      const edition: TraeEdition = name === '.trae-cn' ? 'cn' : 'sg'
      const region: TraeRegion = edition === 'sg' ? 'ai' : 'cn'
      result.push({
        edition,
        path: join(root, name, TRAE_CLI_TOKEN_FILENAME),
        source: 'cli',
        region,
      })
    }
  }
  return result
}
