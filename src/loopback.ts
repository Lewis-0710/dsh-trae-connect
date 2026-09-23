/**
 * 共享本地环回接口安全验证工具函数。
 * 用于保护本地 shim 与同源状态路由，防止 DNS 重绑定攻击。
 *
 * @module dsh-trae-connect/loopback
 */

/** 允许的本地环回主机名白名单 */
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** 从 Host 请求头中剥离可选的端口号（支持 IPv6 方括号格式） */
export function hostnameOfHost(host: string): string {
  let hostname = host.trim().toLowerCase()
  if (hostname.startsWith('[')) {
    const end = hostname.indexOf(']')
    return end === -1 ? hostname : hostname.slice(0, end + 1)
  }
  const colon = hostname.lastIndexOf(':')
  if (colon !== -1 && !hostname.slice(0, colon).includes(':') && /^\d+$/.test(hostname.slice(colon + 1))) {
    hostname = hostname.slice(0, colon)
  }
  return hostname
}

/** 校验请求 Host 是否属于本地环回地址 */
export function hostIsLoopback(host: string | undefined): boolean {
  if (host === undefined || host.trim() === '') return false
  return LOOPBACK_HOSTS.has(hostnameOfHost(host))
}

/** 校验请求 Origin 是否属于本地环回地址（非浏览器发起无 Origin 默认放行） */
export function originIsLoopback(origin: string | undefined): boolean {
  if (origin === undefined || origin.trim() === '') return true
  try {
    const { hostname } = new URL(origin)
    return LOOPBACK_HOSTS.has(hostname) || hostname === '::1'
  } catch {
    return false
  }
}
