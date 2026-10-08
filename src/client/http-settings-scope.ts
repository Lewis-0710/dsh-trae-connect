/**
 * 插件自有配置作用域 — 绕过不稳定或已废弃的宿主 settingsScope，直接走插件自有的 settings 路由。
 *
 * @module dsh-trae-connect/client/http-settings-scope
 */

import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'

export type QuotaSettingsScope<T> = SettingsScope<T>

const ROUTE_BASE = '/plugins/dsh-trae-connect'

interface SettingsFaceDocument {
  key: string
  value: Record<string, unknown>
  base: Record<string, unknown>
  user: Record<string, unknown>
}

async function request(init: RequestInit): Promise<SettingsFaceDocument> {
  const response = await fetch(`${ROUTE_BASE}/settings`, {
    credentials: 'same-origin',
    ...init,
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const error = typeof value === 'object' && value !== null && 'error' in value
      ? String((value as Record<string, unknown>)['error'])
      : `HTTP ${response.status}`
    throw new Error(error)
  }
  if (typeof value !== 'object' || value === null || !('value' in value)) {
    throw new Error('trae: settings face answered an invalid document')
  }
  return value as SettingsFaceDocument
}

export class OwnQuotaSettingsScope implements SettingsScope<never> {
  private document: SettingsFaceDocument | undefined
  private readonly listeners = new Set<() => void>()
  private snapshot: SettingsScopeSnapshot<never> = {
    status: 'loading',
    value: undefined,
    base: {},
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
  }

  async load(): Promise<Record<string, unknown> | undefined> {
    try {
      this.document = await request({ headers: { accept: 'application/json' } })
    } catch {
      // 容错降级
      this.snapshot = {
        status: 'ready',
        value: {
          sidebarQuotaCN: false,
          sidebarQuotaAI: false,
          autoCheckInCN: true,
          checkInMinuteCN: 600,
          quotaPollMs: 300_000,
        } as never,
        base: {},
        user: {},
        revision: 1,
        writable: true,
        mode: 'host',
      }
      this.publish()
      return undefined
    }
    this.publish()
    return this.document.value
  }

  getSnapshot(): SettingsScopeSnapshot<never> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set(field: string, value: unknown): Promise<void> {
    await this.patch({ [field]: value })
  }

  async unset(field: string): Promise<void> {
    await this.patch({ [field]: null })
  }

  async mutate(ops: readonly SettingsPathOpView[], _expectedRevision?: number): Promise<void> {
    const patch: Record<string, unknown> = {}
    for (const op of ops) {
      const field = op.path[0]
      if (!field) continue
      if (op.op === 'set') {
        patch[field] = op.value
      } else if (op.op === 'unset') {
        patch[field] = null
      }
    }
    await this.patch(patch)
  }

  private async patch(patch: Record<string, unknown>): Promise<boolean> {
    // 乐观更新
    if (this.snapshot.value) {
      this.snapshot = {
        ...this.snapshot,
        value: {
          ...(this.snapshot.value as Record<string, unknown>),
          ...patch,
        } as never,
      }
      for (const listener of this.listeners) listener()
    }

    const key = this.document?.key
    try {
      this.document = await request({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...key !== undefined ? { 'X-Trae-Settings-Key': key } : {},
        },
        body: JSON.stringify(patch),
      })
      this.publish()
      return true
    } catch {
      return false
    }
  }

  private publish(): void {
    this.snapshot = {
      status: 'ready',
      value: (this.document?.value ?? {
        sidebarQuotaCN: false,
        sidebarQuotaAI: false,
        autoCheckInCN: true,
        checkInMinuteCN: 600,
        quotaPollMs: 300_000,
      }) as never,
      base: this.document?.base ?? {},
      user: this.document?.user ?? {},
      revision: (this.snapshot.revision ?? 0) + 1,
      writable: true,
      mode: 'host',
    }
    for (const listener of this.listeners) listener()
  }
}
