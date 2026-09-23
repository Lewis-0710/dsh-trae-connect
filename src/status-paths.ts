/**
 * 前后端契约路径与状态类型定义。
 *
 * @module dsh-trae-connect/status-paths
 */

/** 插件国内版状态接口路径 */
export const TRAE_STATUS_PATH = '/plugins/dsh-trae-connect/status'

/** 插件国际版（Trae Global）状态接口路径 */
export const TRAE_AI_STATUS_PATH = '/plugins/dsh-trae-connect/ai/status'

/** 插件国内版探测与操作接口路径 */
export const TRAE_PROBE_PATH = '/plugins/dsh-trae-connect/probe'

/** 插件国际版（Trae Global）探测与操作接口路径 */
export const TRAE_AI_PROBE_PATH = '/plugins/dsh-trae-connect/ai/probe'

/** 插件国内版登录授权接口路径 */
export const TRAE_LOGIN_PATH = '/plugins/dsh-trae-connect/login'

/** 插件国际版登录授权接口路径 */
export const TRAE_AI_LOGIN_PATH = '/plugins/dsh-trae-connect/ai/login'

/** 登录接口支持的操作类型 */
export type TraeWebLoginAction = 'begin' | 'poll' | 'logout' | 'import' | 'detect'

/** 登录接口请求体结构 */
export interface TraeWebLoginRequest {
  action: TraeWebLoginAction
  state?: string
  document?: string
}

/** 登录接口响应结果 */
export type TraeWebLoginResult =
  | { status: 'pending'; state?: string; url?: string }
  | { status: 'complete'; userId?: string; nickname?: string; accountName?: string }
  | { status: 'imported'; userId?: string; uid?: string; nickname?: string; accountName?: string }
  | { status: 'signed-out' }
  | { status: 'failed'; message: string }

/** 单个模型的探测记录 */
export interface TraeWebProbeModel {
  id: string
  name: string
  validation: 'validating' | 'non-validating' | 'unknown'
  efforts: readonly string[]
  probedAt: number
}

/** 状态文档中的探测区域信息 */
export interface TraeWebProbeSection {
  consent: boolean
  running: boolean
  candidates: readonly string[]
  results: readonly TraeWebProbeModel[]
}

/** 探测与管理接口接受的操作动作 */
export interface TraeProbeAction {
  action:
    | 'probe'
    | 'clear'
    | 'refresh'
    | 'set-maximum-context-window'
    | 'set-disabled-models'
    | 'clear-checkin-logs'
    | 'checkin'
  model?: string
  enabled?: boolean
  disabledModels?: readonly string[]
}

/** 模型目录状态 */
export interface TraeWebCatalog {
  source: 'live' | 'saved' | 'fallback'
  fetchedAt?: number
  appVersion?: string
  error?: string
}

/** 单个积分或资源包明细 */
export interface TraeWebCreditAccount {
  packageName: string
  remain: number
  size: number
  unlimited?: true
  packageEndTime?: string
}

/** 聚合额度与积分信息 */
export interface TraeWebCredits {
  total: number
  totalSize?: number
  accounts: readonly TraeWebCreditAccount[]
  unlimited?: true
  cycleResetTime?: string
  isSubscription?: boolean
  inTrial?: boolean
  trialEndTime?: string
}

/** 签到单条日志 */
export interface TraeCheckInLog {
  id: string
  date: string
  timestamp: number
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error'
  amount?: number | undefined
  message?: string | undefined
}

/** 签到整体信息 */
export interface TraeWebCheckInInfo {
  lastDate: string
  lastAt: number
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error'
  amount?: number | undefined
  message?: string | undefined
  nextRunAt?: number | undefined
  logs?: readonly TraeCheckInLog[] | undefined
}

/** 模型计费与上下文信息徽章 */
export interface TraeWebModelBadge {
  id: string
  name: string
  free?: boolean
  badges?: readonly string[]
  credits?: string
  rateUnknown?: true
  contextWindow?: number
  defaultContextWindow?: number
  maxContextWindow?: number
  maxInputTokens?: number
  requiresMembership?: boolean
}

/** 前端渲染读取的完整 Trae 状态文档 */
export type TraeWebStatus =
  | {
    status: 'signed-in'
    userId?: string
    nickname?: string
    accountName?: string
    domain?: string
    region?: 'cn' | 'ai' | 'global'
    source?: string
    expiresAt?: number
    credits?: TraeWebCredits
    creditsError?: string
    models?: readonly TraeWebModelBadge[]
    catalog?: TraeWebCatalog
    probe?: TraeWebProbeSection
    useMaximumContextWindow?: boolean
    disabledModels?: readonly string[]
    probeKey?: string
    loginKey?: string
    checkIn?: TraeWebCheckInInfo
  }
  | {
    status: 'signed-out'
    region?: 'cn' | 'ai' | 'global'
    reason?: string
    loginKey?: string
    probeKey?: string
    models?: readonly TraeWebModelBadge[]
    catalog?: TraeWebCatalog
    probe?: TraeWebProbeSection
    useMaximumContextWindow?: boolean
    disabledModels?: readonly string[]
    checkIn?: TraeWebCheckInInfo
  }
  | { status: 'error'; message: string }
