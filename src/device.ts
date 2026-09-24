/**
 * Device identity, hardware metadata, and ECDSA key pair management for Trae OAuth.
 *
 * Implements official Trae device binding requirements:
 * - ECDSA P-256 (prime256v1) key pair generation & persistent storage.
 * - Hardware and OS metadata collection (CPU, model, brand, OS version).
 * - DeviceProof signature generation for token refresh (_Te contract).
 *
 * @module dsh-trae-connect/device
 */

import { execSync } from 'node:child_process'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { hostname, release, userInfo } from 'node:os'
import { join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { traePluginDataDir } from './paths.ts'

export interface TraeDeviceKeyPair {
  publicKeyPEM: string
  privateKeyPEM: string
}

export interface TraeDeviceInfo {
  DeviceID: string
  MachineID: string
  PlatformCode: string
  DeviceType: string
  DeviceName: string
  DeviceModel: string
  ClientVersion: string
  DevicePublicKey: string
  DeviceBrand: string
  DeviceCPU: string
  OSInfo: string
  OSVersion: string
}

export interface TraeDeviceProfile {
  machineId: string
  deviceId: string
  keyPair: TraeDeviceKeyPair
}

const DEVICE_PROFILE_FILE = 'device-profile.json'

/**
 * Generate a new ECDSA P-256 (prime256v1) key pair as SPKI / PKCS8 PEM strings.
 */
export function generateDeviceKeyPair(): TraeDeviceKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return {
    publicKeyPEM: publicKey,
    privateKeyPEM: privateKey,
  }
}

/**
 * Generate stable machineId and deviceId if none stored.
 */
function createDefaultIdentifiers(): { machineId: string; deviceId: string } {
  try {
    const raw = `${hostname()}-${userInfo().username}-${process.platform}`
    const machineId = createHash('sha256').update(raw).digest('hex')
    let num = ''
    for (let i = 0; i < 16; i++) {
      num += (machineId.charCodeAt(i) % 10).toString()
    }
    return { machineId, deviceId: num }
  } catch {
    const rand = randomBytes(16).toString('hex')
    return {
      machineId: createHash('sha256').update(rand).digest('hex'),
      deviceId: '3493610113527706',
    }
  }
}

/**
 * Collect device hardware and operating system metadata.
 */
function collectHardwareInfo(): {
  deviceModel: string
  deviceCPU: string
  deviceBrand: string
  osInfo: string
  osVersion: string
  deviceName: string
} {
  const platform = process.platform
  let deviceModel = 'PC'
  let deviceCPU = 'Unknown CPU'
  let deviceBrand = 'Generic'
  const osInfo = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : 'linux'
  let osVersion = `${osInfo} ${release()}`
  let deviceName = hostname()

  try {
    const user = userInfo().username
    if (user.trim() !== '') {
      deviceName = `${user}的电脑`
    }
  } catch {}

  if (platform === 'darwin') {
    deviceBrand = 'Apple Inc.'
    try {
      deviceModel = execSync('sysctl -n hw.model', { encoding: 'utf8', timeout: 2000 }).trim()
    } catch {
      deviceModel = 'Mac'
    }
    try {
      deviceCPU = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf8', timeout: 2000 }).trim()
    } catch {
      deviceCPU = 'Apple'
    }
    try {
      const sw = execSync('sw_vers -productVersion', { encoding: 'utf8', timeout: 2000 }).trim()
      osVersion = `macOS ${sw}`
    } catch {
      osVersion = `macOS ${release()}`
    }
  } else if (platform === 'win32') {
    deviceBrand = 'PC'
    deviceModel = 'Windows PC'
    osVersion = `Windows ${release()}`
  } else {
    deviceBrand = 'Linux'
    deviceModel = 'Linux PC'
  }

  return { deviceModel, deviceCPU, deviceBrand, osInfo, osVersion, deviceName }
}

/**
 * Load or initialize the persistent device profile containing machine identity and ECDSA key pair.
 */
export async function getOrCreateDeviceProfile(): Promise<TraeDeviceProfile> {
  const filePath = join(traePluginDataDir(), DEVICE_PROFILE_FILE)

  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf8')
      const data = JSON.parse(raw) as Partial<TraeDeviceProfile> & {
        publicKeyPEM?: string
        privateKeyPEM?: string
      }
      if (
        typeof data.machineId === 'string'
        && typeof data.deviceId === 'string'
        && typeof data.keyPair?.publicKeyPEM === 'string'
        && typeof data.keyPair?.privateKeyPEM === 'string'
      ) {
        return {
          machineId: data.machineId,
          deviceId: data.deviceId,
          keyPair: data.keyPair,
        }
      }
      // Support legacy flat format if any
      if (
        typeof data.machineId === 'string'
        && typeof data.deviceId === 'string'
        && typeof data.publicKeyPEM === 'string'
        && typeof data.privateKeyPEM === 'string'
      ) {
        return {
          machineId: data.machineId,
          deviceId: data.deviceId,
          keyPair: {
            publicKeyPEM: data.publicKeyPEM,
            privateKeyPEM: data.privateKeyPEM,
          },
        }
      }
    } catch {}
  }

  const { machineId, deviceId } = createDefaultIdentifiers()
  const keyPair = generateDeviceKeyPair()
  const profile: TraeDeviceProfile = { machineId, deviceId, keyPair }

  try {
    await withFileLock(filePath, async () => {
      await writeFileAtomic(filePath, JSON.stringify(profile, null, 2), {
        mode: 0o600,
        dirMode: 0o700,
      })
    })
  } catch (err) {
    // If saving fails due to permissions, return profile in-memory
    console.error('Failed to save Trae device profile:', err)
  }

  return profile
}

/**
 * Construct the official Trae DeviceInfo payload strictly conforming to official contract.
 */
export async function buildTraeDeviceInfo(profile?: TraeDeviceProfile): Promise<{
  profile: TraeDeviceProfile
  deviceInfo: TraeDeviceInfo
}> {
  const activeProfile = profile ?? (await getOrCreateDeviceProfile())
  const hardware = collectHardwareInfo()

  const deviceInfo: TraeDeviceInfo = {
    DeviceID: activeProfile.deviceId,
    MachineID: activeProfile.machineId,
    PlatformCode: 'SOLO_PC',
    DeviceType: 'PC',
    DeviceName: hardware.deviceName,
    DeviceModel: hardware.deviceModel,
    ClientVersion: '0.1.66',
    DevicePublicKey: activeProfile.keyPair.publicKeyPEM,
    DeviceBrand: hardware.deviceBrand,
    DeviceCPU: hardware.deviceCPU,
    OSInfo: hardware.osInfo,
    OSVersion: hardware.osVersion,
  }

  return {
    profile: activeProfile,
    deviceInfo,
  }
}

/**
 * Official DeviceProof signature for refresh token verification (_Te contract).
 */
export function signDeviceProof(
  method: string,
  path: string,
  clientId: string,
  refreshToken: string,
  privateKeyPEM: string,
): { timestamp: number; nonce: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = randomBytes(16).toString('hex')
  const message = [method, path, clientId, refreshToken, String(timestamp), nonce].join('\n')
  const signature = sign('sha256', Buffer.from(message), privateKeyPEM).toString('base64')
  return { timestamp, nonce, signature }
}

/**
 * 读取本地安装的 Trae 桌面端真实设备 ID。
 */
export function getTraeLocalDeviceId(): string {
  const home = process.env['HOME'] || ''
  const candidates = [
    join(home, 'Library/Application Support/TRAE SOLO CN/ModularData/ckg_server/local_env.json'),
    join(home, 'Library/Application Support/Trae/ModularData/ckg_server/local_env.json'),
    join(home, 'Library/Application Support/TRAE CN/ModularData/ckg_server/local_env.json'),
    join(process.env['APPDATA'] || '', 'TRAE SOLO CN/ModularData/ckg_server/local_env.json'),
    join(process.env['APPDATA'] || '', 'Trae/ModularData/ckg_server/local_env.json'),
    join(home, '.config/TRAE SOLO CN/ModularData/ckg_server/local_env.json'),
    join(home, '.config/Trae/ModularData/ckg_server/local_env.json'),
  ]
  for (const localEnvPath of candidates) {
    try {
      if (existsSync(localEnvPath)) {
        const raw = JSON.parse(readFileSync(localEnvPath, 'utf8')) as { device_id?: string }
        if (typeof raw.device_id === 'string' && raw.device_id.trim() !== '') {
          return raw.device_id.trim()
        }
      }
    } catch {}
  }
  return createDefaultIdentifiers().deviceId || '3493610113527706'
}

/**
 * 读取本地安装的 Trae 桌面端真实版本号。
 */
export function getTraeClientAppVersion(): string {
  const home = process.env['HOME'] || ''
  const candidates = [
    '/Applications/TRAE SOLO CN.app/Contents/Resources/app/product.json',
    '/Applications/Trae.app/Contents/Resources/app/product.json',
    '/Applications/Trae CN.app/Contents/Resources/app/product.json',
    join(home, 'Applications/TRAE SOLO CN.app/Contents/Resources/app/product.json'),
    join(home, 'Applications/Trae.app/Contents/Resources/app/product.json'),
    join(process.env['LOCALAPPDATA'] || '', 'Programs/TRAE SOLO CN/resources/app/product.json'),
    join(process.env['LOCALAPPDATA'] || '', 'Programs/Trae/resources/app/product.json'),
    '/opt/trae-solo-cn/resources/app/product.json',
    '/opt/trae/resources/app/product.json',
  ]
  for (const productPath of candidates) {
    try {
      if (existsSync(productPath)) {
        const raw = JSON.parse(readFileSync(productPath, 'utf8')) as { appVersion?: string }
        if (typeof raw.appVersion === 'string' && raw.appVersion.trim() !== '') {
          return raw.appVersion.trim()
        }
      }
    } catch {}
  }
  return '0.1.69'
}

/**
 * 构造完全符合官方 Trae 桌面端底层的原生请求头（严格对齐官方 clientParams）。
 */
export function buildTraeClientHeaders(accessToken: string): Record<string, string> {
  const deviceId = getTraeLocalDeviceId()
  const appVersion = getTraeClientAppVersion()
  const platform = process.platform
  const osType = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'windows' : 'linux'
  let osVersion = '15.3.1'
  if (platform === 'darwin') {
    try {
      osVersion = execSync('sw_vers -productVersion', { encoding: 'utf8', timeout: 1000 }).trim()
    } catch {
      osVersion = release()
    }
  } else if (platform === 'win32') {
    osVersion = release()
  } else {
    osVersion = release()
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Cloud-IDE-JWT ${accessToken}`,
    'x-device-id': deviceId,
    'x-device-brand': platform === 'darwin' ? 'Mac' : 'PC',
    'x-device-type': osType,
    'x-os-version': osVersion,
    'x-app-version': appVersion,
    'User-Agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TRAE/${appVersion} Chrome/130.0.6723.137 Electron/33.2.1 Safari/537.36`,
  }
}
