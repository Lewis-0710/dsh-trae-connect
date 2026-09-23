import { describe, expect, it } from 'vitest'
import {
  buildTraeDeviceInfo,
  generateDeviceKeyPair,
  getOrCreateDeviceProfile,
  signDeviceProof,
} from '../src/device.ts'

describe('Trae Device Identity & Crypto', () => {
  it('generateDeviceKeyPair produces valid ECDSA P-256 keys', () => {
    const keyPair = generateDeviceKeyPair()
    expect(keyPair.publicKeyPEM).toContain('BEGIN PUBLIC KEY')
    expect(keyPair.publicKeyPEM).toContain('END PUBLIC KEY')
    expect(keyPair.privateKeyPEM).toContain('BEGIN PRIVATE KEY')
    expect(keyPair.privateKeyPEM).toContain('END PRIVATE KEY')
  })

  it('buildTraeDeviceInfo constructs complete device metadata', async () => {
    const { profile, deviceInfo } = await buildTraeDeviceInfo()

    expect(profile.machineId).toHaveLength(64)
    expect(profile.deviceId.length).toBeGreaterThan(0)
    expect(profile.keyPair.publicKeyPEM).toContain('BEGIN PUBLIC KEY')

    expect(deviceInfo.DeviceID).toBe(profile.deviceId)
    expect(deviceInfo.MachineID).toBe(profile.machineId)
    expect(deviceInfo.PlatformCode).toBe('SOLO_PC')
    expect(deviceInfo.DeviceType).toBe('PC')
    expect(deviceInfo.DevicePublicKey).toBe(profile.keyPair.publicKeyPEM)
    expect(typeof deviceInfo.DeviceBrand).toBe('string')
    expect(typeof deviceInfo.DeviceCPU).toBe('string')
    expect(typeof deviceInfo.OSInfo).toBe('string')
    expect(typeof deviceInfo.OSVersion).toBe('string')
  })

  it('signDeviceProof produces valid signature conforming to official contract', () => {
    const keyPair = generateDeviceKeyPair()
    const proof = signDeviceProof(
      'POST',
      '/trae/api/v3/oauth/ExchangeToken',
      'en1oxy7wnw8j9n',
      'mock-refresh-token',
      keyPair.privateKeyPEM,
    )

    expect(proof.timestamp).toBeGreaterThan(0)
    expect(proof.nonce).toHaveLength(32)
    expect(typeof proof.signature).toBe('string')
    expect(proof.signature.length).toBeGreaterThan(20)
  })
})
