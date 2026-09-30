/**
 * 每日签到定时器与历史日志管理服务。
 *
 * @module dsh-trae-connect/checkin-scheduler
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { traeStateDir } from './paths.ts'
import type { TraeUpstreamClient } from './upstream.ts'

export interface CheckInLogItem {
  id: string
  date: string
  timestamp: number
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error'
  amount?: number
  message?: string
}

export interface CheckInRecord {
  lastDate: string
  lastAt: number
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error'
  amount?: number
  message?: string
  logs?: CheckInLogItem[]
  nextRunAt?: number
}

export function getUtc8DateString(now: Date = new Date()): string {
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().slice(0, 10)
}

/** 默认自动签到时刻：600 = 10:00 (UTC+8) */
export const DEFAULT_CHECK_IN_MINUTE = 600

/** 校验并规整签到分钟数（0 ~ 1439） */
export function normalizeCheckInMinute(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CHECK_IN_MINUTE
  const whole = Math.trunc(value)
  if (whole < 0 || whole > 1439) return DEFAULT_CHECK_IN_MINUTE
  return whole
}

/**
 * 计算距离下一次签到时刻的毫秒差（基于 UTC+8）。
 * 延后 5 秒执行以避免跨天边界抖动。
 */
export function msUntilNextCheckIn(minuteOfDay: number, nowMs: number = Date.now()): number {
  const minute = normalizeCheckInMinute(minuteOfDay)
  const d = new Date(nowMs)
  const utc8Time = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60_000)
  const targetUtc8 = new Date(utc8Time.getTime())
  targetUtc8.setHours(Math.floor(minute / 60), minute % 60, 5, 0)

  let diff = targetUtc8.getTime() - utc8Time.getTime()
  if (diff <= 0) {
    targetUtc8.setDate(targetUtc8.getDate() + 1)
    diff = targetUtc8.getTime() - utc8Time.getTime()
  }
  return diff
}

/**
 * 判断今天设定的签到时刻（UTC+8）是否已经过去。
 */
export function isPastCheckInTime(minuteOfDay: number, nowMs: number = Date.now()): boolean {
  const minute = normalizeCheckInMinute(minuteOfDay)
  const d = new Date(nowMs)
  const utc8 = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60_000)
  return utc8.getHours() * 60 + utc8.getMinutes() >= minute
}

export class JsonFileCheckInStore {
  private readonly filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(traeStateDir(), 'checkin-status.json')
  }

  private readAll(): Record<string, CheckInRecord> {
    try {
      if (!existsSync(this.filePath)) return {}
      const raw = readFileSync(this.filePath, 'utf-8')
      return JSON.parse(raw) as Record<string, CheckInRecord>
    } catch {
      return {}
    }
  }

  read(variantId: string): CheckInRecord | undefined {
    return this.readAll()[variantId]
  }

  write(variantId: string, record: CheckInRecord): void {
    try {
      const all = this.readAll()
      const existing = all[variantId]
      const existingLogs = existing?.logs ?? []

      // 单日去重：如果今天已有 claimed 或 already-claimed 记录，且当前写入也是 already-claimed，不重复追加日志
      const hasSettledToday = existingLogs.some(
        l => l.date === record.lastDate && (l.status === 'claimed' || l.status === 'already-claimed'),
      )
      const isRedundantAlreadyClaimed = record.status === 'already-claimed' && hasSettledToday

      let updatedLogs = existingLogs
      if (!isRedundantAlreadyClaimed) {
        const newLog: CheckInLogItem = {
          id: `${record.lastDate}-${record.lastAt}`,
          date: record.lastDate,
          timestamp: record.lastAt,
          status: record.status,
          ...record.amount === undefined ? {} : { amount: record.amount },
          ...record.message === undefined ? {} : { message: record.message },
        }
        updatedLogs = [newLog, ...existingLogs.filter(l => l.id !== newLog.id)].slice(0, 30)
      }

      all[variantId] = {
        ...record,
        logs: updatedLogs,
      }
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf-8')
    } catch {}
  }

  clear(variantId: string): void {
    try {
      const all = this.readAll()
      const today = getUtc8DateString()
      all[variantId] = {
        lastDate: all[variantId]?.lastDate ?? today,
        lastAt: Date.now(),
        status: all[variantId]?.status ?? 'no-campaign',
        ...all[variantId]?.amount !== undefined ? { amount: all[variantId].amount } : {},
        logs: [],
      }
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf-8')
    } catch {}
  }
}

export interface VariantCheckInTarget {
  variantId: string
  client: TraeUpstreamClient
  minuteOfDay: () => number
  isEnabled: () => boolean
  onClaimed?: () => void
}

export class CheckInScheduler {
  private readonly store: JsonFileCheckInStore
  private readonly targets: readonly VariantCheckInTarget[]
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private readonly nextRuns = new Map<string, number>()
  private readonly inFlight = new Set<string>()
  private disposed = false

  constructor(targets: readonly VariantCheckInTarget[], store?: JsonFileCheckInStore) {
    this.targets = targets
    this.store = store ?? new JsonFileCheckInStore()
  }

  start(): void {
    if (this.disposed) return
    this.rearm()
    // 启动 1 秒后执行一次 catch-up 补偿检查（只有今天已过设定时刻且未签到才补签）
    setTimeout(() => { void this.catchUp() }, 1_000)
  }

  stop(): void {
    this.disposed = true
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.nextRuns.clear()
  }

  rearm(): void {
    if (this.disposed) return
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.nextRuns.clear()

    const nowMs = Date.now()
    for (const target of this.targets) {
      if (target.client.variant.region !== 'cn') continue
      if (!target.isEnabled()) continue

      const delay = msUntilNextCheckIn(target.minuteOfDay(), nowMs)
      this.nextRuns.set(target.variantId, nowMs + delay)

      const timer = setTimeout(() => {
        this.timers.delete(target.variantId)
        void this.scheduledSweep(target.variantId).finally(() => {
          this.rearm()
        })
      }, delay)
      timer.unref?.()
      this.timers.set(target.variantId, timer)
    }
  }

  nextRunAt(variantId: string): number | undefined {
    return this.nextRuns.get(variantId)
  }

  get(variantId: string): CheckInRecord | undefined {
    const rec = this.store.read(variantId)
    if (!rec) return undefined
    const next = this.nextRunAt(variantId)
    return {
      ...rec,
      ...next !== undefined ? { nextRunAt: next } : {},
    }
  }

  clearLogs(variantId: string): void {
    this.store.clear(variantId)
  }

  /**
   * 启动或配置变更时的补偿检查：
   * 只有在【今天设定的签到时刻已过】且【今日尚未签到】时才执行补签，绝不在设定时刻前抢跑。
   */
  async catchUp(): Promise<void> {
    if (this.disposed) return
    const nowMs = Date.now()
    const today = getUtc8DateString(new Date(nowMs))

    for (const target of this.targets) {
      if (target.client.variant.region !== 'cn') continue
      if (!target.isEnabled()) continue
      if (this.inFlight.has(target.variantId)) continue

      // 关键：若今天还没到设定的签到时刻，绝对不提前签到
      if (!isPastCheckInTime(target.minuteOfDay(), nowMs)) continue

      const record = this.store.read(target.variantId)
      const settledToday = record?.lastDate === today
        && (record.status === 'claimed' || record.status === 'already-claimed')
      if (settledToday) continue

      this.inFlight.add(target.variantId)
      try {
        await this.executeCheckIn(target, today)
      } finally {
        this.inFlight.delete(target.variantId)
      }
    }
  }

  /**
   * 到达设定时刻时的定时执行
   */
  private async scheduledSweep(variantId: string): Promise<void> {
    if (this.disposed) return
    const target = this.targets.find(t => t.variantId === variantId)
    if (!target || !target.isEnabled() || target.client.variant.region !== 'cn') return
    if (this.inFlight.has(variantId)) return

    this.inFlight.add(variantId)
    try {
      const today = getUtc8DateString()
      await this.executeCheckIn(target, today)
    } finally {
      this.inFlight.delete(variantId)
    }
  }

  private async executeCheckIn(target: VariantCheckInTarget, today: string): Promise<void> {
    try {
      const checkin = await target.client.usageClient.checkinStatus()
      if (!checkin.enabled) {
        this.store.write(target.variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'no-campaign',
          message: '今日无签到活动',
        })
        return
      }

      if (checkin.checkedIn) {
        this.store.write(target.variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'already-claimed',
          amount: checkin.credits,
        })
        return
      }

      const claimResult = await target.client.usageClient.claimCheckin()
      if (claimResult.ok) {
        const status = claimResult.alreadyClaimed ? 'already-claimed' : 'claimed'
        const amount = claimResult.credits ?? checkin.credits ?? 150
        this.store.write(target.variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status,
          amount,
        })
        target.onClaimed?.()
      } else {
        this.store.write(target.variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'error',
          message: claimResult.message ?? '自动签到未成功',
          amount: checkin.credits,
        })
      }
    } catch (err) {
      this.store.write(target.variantId, {
        lastDate: today,
        lastAt: Date.now(),
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * 主动同步指定版本的最新服务端签到状态并纠偏本地记录（供前端刷新调用）。
   */
  async syncVariant(variantId: string): Promise<CheckInRecord | undefined> {
    const target = this.targets.find(c => c.variantId === variantId)
    if (!target || target.client.variant.region !== 'cn') return undefined
    const today = getUtc8DateString()
    try {
      const checkin = await target.client.usageClient.checkinStatus()
      if (checkin.checkedIn) {
        const existing = this.store.read(variantId)
        const record: CheckInRecord = {
          lastDate: today,
          lastAt: existing?.lastDate === today ? existing.lastAt : Date.now(),
          status: 'already-claimed',
          amount: checkin.credits,
        }
        this.store.write(variantId, record)
        return this.get(variantId)
      }
    } catch {}
    return this.get(variantId)
  }

  /**
   * 手动立即签到接口（供前端点击按钮调用）
   */
  async checkIn(variantId: string): Promise<{ state: string; reason?: string; amount?: number }> {
    const target = this.targets.find(c => c.variantId === variantId)
    if (!target) return { state: 'error', reason: '未知版本' }
    if (target.client.variant.region !== 'cn') {
      return { state: 'no-campaign', reason: '国际版（Trae Global）暂无每日签到活动' }
    }

    const today = getUtc8DateString()
    try {
      const checkin = await target.client.usageClient.checkinStatus()
      if (!checkin.enabled) {
        this.store.write(variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'no-campaign',
          message: '今日无签到活动',
        })
        return { state: 'no-campaign', reason: '今日无签到活动' }
      }

      if (checkin.checkedIn) {
        this.store.write(variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'already-claimed',
          amount: checkin.credits,
        })
        return { state: 'already-claimed', amount: checkin.credits }
      }

      const claimResult = await target.client.usageClient.claimCheckin()
      if (claimResult.ok) {
        const state = claimResult.alreadyClaimed ? 'already-claimed' : 'claimed'
        const amount = claimResult.credits ?? checkin.credits ?? 150
        this.store.write(variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: state,
          amount,
        })
        target.onClaimed?.()
        return { state, amount }
      }

      const failReason = claimResult.message ?? '签到失败，请稍后在 Trae 桌面端重试'
      this.store.write(variantId, {
        lastDate: today,
        lastAt: Date.now(),
        status: 'error',
        message: failReason,
        amount: checkin.credits,
      })
      return { state: 'error', reason: failReason }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.store.write(variantId, {
        lastDate: today,
        lastAt: Date.now(),
        status: 'error',
        message,
      })
      return { state: 'error', reason: message }
    }
  }
}
