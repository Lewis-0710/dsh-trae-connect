import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHECK_IN_MINUTE,
  isPastCheckInTime,
  msUntilNextCheckIn,
  normalizeCheckInMinute,
} from '../src/checkin-scheduler.ts'

describe('CheckInScheduler scheduling logic', () => {
  it('DEFAULT_CHECK_IN_MINUTE is 600 (10:00 UTC+8)', () => {
    expect(DEFAULT_CHECK_IN_MINUTE).toBe(600)
  })

  it('normalizeCheckInMinute correctly validates and clamps minutes', () => {
    expect(normalizeCheckInMinute(600)).toBe(600)
    expect(normalizeCheckInMinute(0)).toBe(0)
    expect(normalizeCheckInMinute(1439)).toBe(1439)
    expect(normalizeCheckInMinute(-1)).toBe(600)
    expect(normalizeCheckInMinute(1440)).toBe(600)
    expect(normalizeCheckInMinute('invalid')).toBe(600)
    expect(normalizeCheckInMinute(null)).toBe(600)
    expect(normalizeCheckInMinute(undefined)).toBe(600)
    expect(normalizeCheckInMinute(Number.NaN)).toBe(600)
  })

  it('msUntilNextCheckIn returns positive delay targeting 5 seconds past configured minute', () => {
    const now = Date.now()
    const delay = msUntilNextCheckIn(600, now)
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 10_000)
  })

  it('isPastCheckInTime correctly determines whether target minute has passed in UTC+8', () => {
    // 构造一个确定时间：UTC 2026-09-30 01:00:00 -> UTC+8 为 09:00:00 (540分钟)
    const utc9am = new Date('2026-09-30T01:00:00.000Z').getTime()
    // 设定的时刻是 10:00 (600分钟)，此时未过
    expect(isPastCheckInTime(600, utc9am)).toBe(false)
    // 设定的时刻是 08:00 (480分钟)，此时已过
    expect(isPastCheckInTime(480, utc9am)).toBe(true)
    // 设定的时刻恰好是 09:00 (540分钟)，此时已到或已过
    expect(isPastCheckInTime(540, utc9am)).toBe(true)
  })
})
