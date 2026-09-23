/**
 * 侧栏额度合并与排序算法：合并同名资源包、计算使用百分比并根据到期时间与消耗状态排序。
 *
 * @module dsh-trae-connect/client/quota-merge
 */

import type { TraeWebCreditAccount } from '../status-paths.ts'

/** 合并后的单个侧栏额度组 */
export interface QuotaGroup {
  /** 资源包名称 */
  packageName: string
  /** 到期时间字符串（未提供则为 undefined） */
  packageEndTime: string | undefined
  /** 剩余额度 */
  remain: number
  /** 总额度 */
  size: number
  /** 是否无限额度 */
  unlimited: boolean
}

/**
 * 根据包名对资源包进行汇总合并，保留最早到期时间。
 */
export function mergeCreditAccounts(accounts: readonly TraeWebCreditAccount[]): QuotaGroup[] {
  const groups = new Map<string, QuotaGroup>()
  for (const account of accounts) {
    const key = account.packageName
    const existing = groups.get(key)
    if (existing === undefined) {
      groups.set(key, {
        packageName: account.packageName,
        packageEndTime: account.packageEndTime,
        remain: account.remain,
        size: account.size,
        unlimited: account.unlimited === true,
      })
      continue
    }
    existing.remain += account.remain
    existing.size += account.size
    existing.unlimited = existing.unlimited || account.unlimited === true
    if (existing.packageEndTime !== undefined && account.packageEndTime !== undefined) {
      const a = Date.parse(existing.packageEndTime)
      const b = Date.parse(account.packageEndTime)
      if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) existing.packageEndTime = account.packageEndTime
    } else {
      existing.packageEndTime = existing.packageEndTime ?? account.packageEndTime
    }
  }
  return [...groups.values()]
}

/**
 * 计算剩余百分比并限制在 0 - 100 之间。
 */
export function clampPercent(remain: number, size: number): number | undefined {
  if (!(size > 0)) return undefined
  const percent = (remain / size) * 100
  if (!Number.isFinite(percent)) return undefined
  return Math.min(100, Math.max(0, percent))
}

/** 解析到期时间 */
function parseExpiry(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** 是否已用尽 */
function isSpent(group: QuotaGroup): boolean {
  return !group.unlimited && group.remain <= 0
}

/** 是否已过期 */
function isExpired(group: QuotaGroup, now: number): boolean {
  if (!isSpent(group)) return false
  const expiry = parseExpiry(group.packageEndTime)
  return expiry !== undefined && expiry < now
}

/**
 * 过滤出侧边栏卡片应显示的额度组。
 */
export function visibleQuotaGroups(groups: readonly QuotaGroup[], now: number = Date.now()): QuotaGroup[] {
  const hasCredit = groups.some(group => group.unlimited || group.remain > 0)
  return groups.filter(group => {
    if (group.unlimited || group.remain > 0) return true
    return !hasCredit && !isExpired(group, now)
  })
}

/**
 * 排序资源包列表（有效包排在前面，已用尽排在后面，过期包自动剔除）。
 */
export function sortPackageRows<T extends { remain: number; unlimited?: true; packageEndTime?: string }>(rows: readonly T[], now: number = Date.now()): T[] {
  const live: T[] = []
  const spent: T[] = []
  for (const row of rows) {
    const unlimited = row.unlimited === true
    const expiry = parseExpiry(row.packageEndTime)
    const expired = !unlimited && row.remain <= 0 && expiry !== undefined && expiry < now
    if (expired) continue
    if (unlimited || row.remain > 0) live.push(row)
    else spent.push(row)
  }
  return [...live, ...spent]
}
