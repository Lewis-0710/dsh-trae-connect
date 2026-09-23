/**
 * Trae 侧边栏卡片与额度状态全局响应式存储，供 React 组件通过 useSyncExternalStore 订阅。
 *
 * @module dsh-trae-connect/client/quota-settings-store
 */

import type { TraeWebStatus } from '../status-paths.ts'

/** 各版本登录状态缓存 */
export interface QuotaSignInState {
  cn: boolean
  ai: boolean
}

let pollIntervalMs = 300_000
const toggles = { cn: false, ai: false }
let togglesSnapshot: QuotaSignInState = { cn: false, ai: false }
const signIn: QuotaSignInState = { cn: false, ai: false }
let signInSnapshot: QuotaSignInState = { cn: false, ai: false }
let revision = 0
const listeners = new Set<() => void>()

function bump(): void {
  revision += 1
  for (const listener of listeners) listener()
}

/** 更新共享刷新轮询周期 */
export function setQuotaPollMs(ms: number): void {
  if (Number.isFinite(ms) && ms >= 60_000 && pollIntervalMs !== ms) {
    pollIntervalMs = ms
    bump()
  }
}

/** 读取当前配置的刷新间隔 */
export function quotaPollMs(): number {
  return pollIntervalMs
}

/** 更新侧栏展示开关状态 */
export function setQuotaToggles(cn: boolean, ai: boolean): void {
  if (toggles.cn !== cn || toggles.ai !== ai) {
    toggles.cn = cn
    toggles.ai = ai
    togglesSnapshot = { ...toggles }
    bump()
  }
}

/** 读取当前侧栏展示开关状态 */
export function quotaToggles(): QuotaSignInState {
  return togglesSnapshot
}

/** 记录指定版本的登录状态 */
export function noteQuotaSignIn(variantId: string, signedIn: boolean): void {
  if (variantId === 'trae' && signIn.cn !== signedIn) {
    signIn.cn = signedIn
    signInSnapshot = { ...signIn }
    bump()
  } else if (variantId === 'trae-ai' && signIn.ai !== signedIn) {
    signIn.ai = signedIn
    signInSnapshot = { ...signIn }
    bump()
  }
}

/** 读取当前登录状态 */
export function quotaSignInState(): QuotaSignInState {
  return signInSnapshot
}

/** 订阅配置变更 */
export function onQuotaSettingsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 获取当前版本号 */
export function quotaSettingsRevision(): number {
  return revision
}

/** 根据状态路由判断属于哪个产品版本 */
export function variantOfStatusPath(statusPath: string): 'trae' | 'trae-ai' {
  return statusPath.includes('/ai/') ? 'trae-ai' : 'trae'
}

/* ---- 共享状态文档缓存 ---- */
const statusDocuments: { cn: TraeWebStatus | undefined; ai: TraeWebStatus | undefined } = { cn: undefined, ai: undefined }
const statusFetchedAt: { cn: number | undefined; ai: number | undefined } = { cn: undefined, ai: undefined }

/** 记录最新拉取到的状态文档并触发订阅通知 */
export function noteQuotaStatus(variantId: string, status: TraeWebStatus): void {
  if (variantId === 'trae' && statusDocuments.cn !== status) {
    statusDocuments.cn = status
    statusFetchedAt.cn = Date.now()
    bump()
  } else if (variantId === 'trae-ai' && statusDocuments.ai !== status) {
    statusDocuments.ai = status
    statusFetchedAt.ai = Date.now()
    bump()
  }
  noteQuotaSignIn(variantId, status.status === 'signed-in')
}

/** 读取指定版本最新状态文档 */
export function quotaStatus(variantId: 'trae' | 'trae-ai'): TraeWebStatus | undefined {
  return variantId === 'trae' ? statusDocuments.cn : statusDocuments.ai
}

/** 读取指定版本状态拉取时间戳 */
export function quotaStatusFetchedAt(variantId: 'trae' | 'trae-ai'): number | undefined {
  return variantId === 'trae' ? statusFetchedAt.cn : statusFetchedAt.ai
}

/** 检查缓存是否在有效期内 */
export function quotaStatusIsFresh(variantId: 'trae' | 'trae-ai', maxAgeMs: number): boolean {
  const fetchedAt = variantId === 'trae' ? statusFetchedAt.cn : statusFetchedAt.ai
  const document = variantId === 'trae' ? statusDocuments.cn : statusDocuments.ai
  if (fetchedAt === undefined || document === undefined) return false
  return Date.now() - fetchedAt < maxAgeMs
}
