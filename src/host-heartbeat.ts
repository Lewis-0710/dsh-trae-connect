/**
 * Host process heartbeat file for health reporting via CLI.
 *
 * @module dsh-trae-connect/host-heartbeat
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { traeStateDir } from './paths.ts'
import { TRAE_CONNECT_VERSION } from './version.ts'

export const TRAE_HOST_HEARTBEAT_FILENAME = '.trae-host-heartbeat.json'
const HEARTBEAT_FORMAT_VERSION = 1

export interface TraeHostHeartbeat {
  version: typeof HEARTBEAT_FORMAT_VERSION
  package: 'dsh-trae-connect'
  pluginVersion: string
  registeredAt: number
  pid: number
}

export function traeHostHeartbeatPath(): string {
  return join(traeStateDir(), TRAE_HOST_HEARTBEAT_FILENAME)
}

export async function writeHostHeartbeat(): Promise<void> {
  const document: TraeHostHeartbeat = {
    version: HEARTBEAT_FORMAT_VERSION,
    package: 'dsh-trae-connect',
    pluginVersion: TRAE_CONNECT_VERSION,
    registeredAt: Date.now(),
    pid: process.pid,
  }
  try {
    const filePath = traeHostHeartbeatPath()
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(document, null, 2), 'utf8')
  } catch {}
}

export async function clearHostHeartbeat(): Promise<void> {
  try {
    await rm(traeHostHeartbeatPath(), { force: true })
  } catch {}
}

export function isHeartbeatProcessAlive(heartbeat: TraeHostHeartbeat): boolean {
  try {
    process.kill(heartbeat.pid, 0)
    return true
  } catch {
    return false
  }
}

export async function readHostHeartbeat(): Promise<TraeHostHeartbeat | undefined> {
  try {
    const raw = await readFile(traeHostHeartbeatPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<TraeHostHeartbeat>
    if (
      parsed.version === HEARTBEAT_FORMAT_VERSION
      && parsed.package === 'dsh-trae-connect'
      && typeof parsed.registeredAt === 'number'
      && typeof parsed.pid === 'number'
    ) {
      return {
        version: HEARTBEAT_FORMAT_VERSION,
        package: 'dsh-trae-connect',
        pluginVersion: typeof parsed.pluginVersion === 'string' ? parsed.pluginVersion : 'unknown',
        registeredAt: parsed.registeredAt,
        pid: parsed.pid,
      }
    }
  } catch {}
  return undefined
}
