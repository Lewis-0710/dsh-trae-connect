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
}

export function getUtc8DateString(now: Date = new Date()): string {
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().slice(0, 10)
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
      const newLog: CheckInLogItem = {
        id: `${record.lastDate}-${record.lastAt}`,
        date: record.lastDate,
        timestamp: record.lastAt,
        status: record.status,
        ...record.amount === undefined ? {} : { amount: record.amount },
        ...record.message === undefined ? {} : { message: record.message },
      }
      const updatedLogs = [newLog, ...existingLogs.filter(l => l.id !== newLog.id)].slice(0, 30)
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

export class CheckInScheduler {
  private timer: NodeJS.Timeout | undefined
  private readonly store: JsonFileCheckInStore
  private readonly clients: readonly { variantId: string; client: TraeUpstreamClient }[]

  constructor(clients: readonly { variantId: string; client: TraeUpstreamClient }[], store?: JsonFileCheckInStore) {
    this.clients = clients
    this.store = store ?? new JsonFileCheckInStore()
  }

  start(): void {
    this.stop()
    // 启动 1 秒后首次检查并自愈签到状态
    setTimeout(() => { void this.runAll() }, 1_000)
    // 之后每 2 小时定时轮询检查
    this.timer = setInterval(() => { void this.runAll() }, 2 * 60 * 60 * 1000)
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  get(variantId: string): CheckInRecord | undefined {
    return this.store.read(variantId)
  }

  clearLogs(variantId: string): void {
    this.store.clear(variantId)
  }

  /**
   * 主动同步指定版本的最新服务端签到状态并纠偏本地记录。
   */
  async syncVariant(variantId: string): Promise<CheckInRecord | undefined> {
    const target = this.clients.find(c => c.variantId === variantId)
    if (!target || target.client.variant.region !== 'cn') return undefined
    const today = getUtc8DateString()
    try {
      const checkin = await target.client.usageClient.checkinStatus()
      if (checkin.checkedIn) {
        const record: CheckInRecord = {
          lastDate: today,
          lastAt: Date.now(),
          status: 'already-claimed',
          amount: checkin.credits,
        }
        this.store.write(variantId, record)
        return record
      }
    } catch {}
    return this.store.read(variantId)
  }

  async checkIn(variantId: string): Promise<{ state: string; reason?: string; amount?: number }> {
    const target = this.clients.find(c => c.variantId === variantId)
    if (!target) return { state: 'error', reason: '未知版本' }
    if (target.client.variant.region !== 'cn') {
      return { state: 'no-campaign', reason: '国际版（Trae Global）暂无每日签到活动' }
    }

    const today = getUtc8DateString()
    try {
      // 1. 查询当前签到活动与状态
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

      // 2. 如果今日已在客户端或其他渠道完成签到，直接纠正为已签到并清除旧错误
      if (checkin.checkedIn) {
        this.store.write(variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'already-claimed',
          amount: checkin.credits,
        })
        return { state: 'already-claimed', amount: checkin.credits }
      }

      // 3. 今日尚未签到，调用官方签到领取接口
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
        return { state, amount }
      }

      // 4. 签到接口返回业务错误（如限流或安全校验）
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

  async runAll(): Promise<void> {
    const today = getUtc8DateString()
    for (const { variantId, client } of this.clients) {
      if (client.variant.region !== 'cn') continue
      try {
        const checkin = await client.usageClient.checkinStatus()
        if (!checkin.enabled) {
          this.store.write(variantId, {
            lastDate: today,
            lastAt: Date.now(),
            status: 'no-campaign',
          })
          continue
        }
        if (checkin.checkedIn) {
          // 只要服务端已签到，立即纠偏为已签到，清除残留的任何错误状态
          this.store.write(variantId, {
            lastDate: today,
            lastAt: Date.now(),
            status: 'already-claimed',
            amount: checkin.credits,
          })
          continue
        }

        const last = this.store.read(variantId)
        if (last?.lastDate === today && (last.status === 'claimed' || last.status === 'already-claimed')) {
          continue
        }

        // 执行自动签到
        const claimResult = await client.usageClient.claimCheckin()
        if (claimResult.ok) {
          const status = claimResult.alreadyClaimed ? 'already-claimed' : 'claimed'
          this.store.write(variantId, {
            lastDate: today,
            lastAt: Date.now(),
            status,
            amount: claimResult.credits ?? checkin.credits,
          })
        } else {
          this.store.write(variantId, {
            lastDate: today,
            lastAt: Date.now(),
            status: 'error',
            message: claimResult.message ?? '自动签到未成功',
            amount: checkin.credits,
          })
        }
      } catch (err) {
        this.store.write(variantId, {
          lastDate: today,
          lastAt: Date.now(),
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
}
