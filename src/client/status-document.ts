/**
 * 状态文档类型守卫，供插件卡片与侧栏组件校验数据。
 *
 * @module dsh-trae-connect/client/status-document
 */

import type { TraeWebStatus } from '../status-paths.ts'

/**
 * 判断解析后的响应数据是否为合法的 TraeWebStatus 文档。
 */
export function isTraeWebStatus(value: unknown): value is TraeWebStatus {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const wrapped = value as Record<string, unknown>
  const status = wrapped['status']
  if (status === 'signed-out' || status === 'signed-in') return true
  return status === 'error' && typeof wrapped['message'] === 'string'
}
