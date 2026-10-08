/**
 * 插件自有配置存储 — 脱离宿主内置 settingsScope 变动影响，实现独立原子化持久化。
 *
 * @module dsh-trae-connect/settings-store
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { traePluginDataDir } from './paths.ts'

const SETTINGS_FILE_NAME = 'settings.json'
const WRITE_MARK = '__writes'

export function settingsFilePath(): string {
  return join(traePluginDataDir(), SETTINGS_FILE_NAME)
}

function readFile(): Record<string, unknown> | undefined {
  const path = settingsFilePath()
  if (!existsSync(path)) return undefined
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

export function writeSettings(values: Record<string, unknown>): void {
  const path = settingsFilePath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(values, null, 2)}\n`, 'utf8')
  renameSync(tmp, path)
}

export class SettingsStore {
  readonly user: Record<string, unknown>

  constructor() {
    this.user = readFile() ?? {}
  }

  exists(): boolean {
    return existsSync(settingsFilePath())
  }

  get edited(): boolean {
    return typeof this.user[WRITE_MARK] === 'number' && this.user[WRITE_MARK] > 0
  }

  patch(patch: Record<string, unknown>, fromCard = false): Record<string, unknown> {
    const next = { ...this.user }
    for (const [field, value] of Object.entries(patch)) {
      if (value === null || value === undefined) delete next[field]
      else next[field] = value
    }
    if (fromCard) {
      next[WRITE_MARK] = (typeof next[WRITE_MARK] === 'number' ? next[WRITE_MARK] : 0) + 1
    }
    writeSettings(next)
    for (const key of Object.keys(this.user)) delete this.user[key]
    Object.assign(this.user, next)
    return this.user
  }

  values(): Record<string, unknown> {
    return this.user
  }
}
