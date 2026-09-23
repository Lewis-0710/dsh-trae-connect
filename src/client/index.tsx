/**
 * 浏览器端入口：Trae 账号状态、额度卡片与插件配置贡献。
 *
 * @module dsh-trae-connect/client
 */

import { useEffect } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { TraeProbeControl } from './TraeProbeControl.tsx'
import { CARD_VARIANTS, TraePluginCard } from './TraePluginCard.tsx'
import type { TraePluginCardInjected } from './TraePluginCard.tsx'
import type { QuotaSection } from './QuotaSettingsCard.tsx'
import { QuotaDashboard, SidebarQuotaCard } from './SidebarQuotaCard.tsx'
import type {
  QuotaDashboardInjected,
  QuotaDashboardProps,
  QuotaDashboardState,
  SidebarQuotaCardInjected,
  SidebarQuotaCardProps,
} from './SidebarQuotaCard.tsx'
import { injectQuotaCss } from './quota-styles.ts'
import './quota-slots.ts'
import {
  noteQuotaStatus,
  quotaPollMs,
  quotaSignInState,
  quotaStatusIsFresh,
  setQuotaPollMs,
  setQuotaToggles,
  variantOfStatusPath,
} from './quota-settings-store.ts'
import { isTraeWebStatus } from './status-document.ts'
import { en, zh } from './locales.ts'
import type { TraeSettingsKey } from './locales.ts'
import { TRAE_AI_STATUS_PATH, TRAE_STATUS_PATH } from '../status-paths.ts'
import type { TraeWebStatus } from '../status-paths.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Trae 插件卡片多语言命名空间 */
    'settings.trae': TraeSettingsKey
    /** 共享额度设置与侧边栏卡片多语言命名空间 */
    'panel.trae-quota': TraeSettingsKey
  }
}

/** 浏览器端插件标识名 */
export const name = 'dsh-trae-connect-client'

/** 插件配置贡献所依赖的客户端服务清单 */
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'settingsScope']

/** 各版本卡片所对应的后端状态端点路径映射 */
const VARIANT_STATUS: Record<string, string> = {
  trae: TRAE_STATUS_PATH,
  'trae-ai': TRAE_AI_STATUS_PATH,
}

/**
 * 注册卡片文案、统一 Trae 配置卡片以及侧边栏额度卡片。
 *
 * 整个函数体由 try/catch 包裹，确保即便 DSH 宿主环境的 Slot API 发生变动，
 * 也仅在控制台输出警告，而不会抛出异常破坏 DSH 的插件加载机制。
 */
export function apply(ctx: ClientContext): void {
  try {
    const namespace = 'settings.trae'
    ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-trae-connect: settings copy')
    const t = ctx.locale.bind(namespace) as TraePluginCardInjected['t']

    // 1. 共享额度设置。在应用启动时即刻绑定 trae-quota 配置作用域，
    // 同步侧边栏额度展示开关与轮询刷新间隔
    let quotaScope: SettingsScope<QuotaSection> | undefined
    try {
      const scope = (ctx as unknown as {
        settingsScope: { bind: (options: { namespace: string }) => SettingsScope<QuotaSection> }
      }).settingsScope.bind({ namespace: 'trae-quota' })
      quotaScope = scope
      const applySnapshot = (): void => {
        const value = scope.getSnapshot().value
        setQuotaToggles(value?.sidebarQuotaCN === true, value?.sidebarQuotaAI === true)
        if (typeof value?.quotaPollMs === 'number') setQuotaPollMs(value.quotaPollMs)
      }
      applySnapshot()
      scope.subscribe(applySnapshot)
    } catch (error: unknown) {
      console.error('[dsh-trae-connect] 额度设置作用域不可用（侧栏额度卡片将隐藏）:', error)
    }

    // 2. 统一的主插件卡片：顶部为额度卡片开关与签到定时配置，下方为分段版本切换及账号管理、功能 Tab。
    // priority: 10 确保渲染在恰当的排序位置
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'trae',
      priority: 10,
      inject: (): TraePluginCardInjected => ({
        t,
        scope: quotaScope,
        signedIn: () => quotaSignInState(),
        unified: true,
      }),
    }, TraePluginCard))

    // 3. 侧栏底部额度卡片与详情看板
    const QUOTA_PANEL_ID = 'trae-quota-panel'
    const CONVERSATION_PANEL_ID = 'conversation'
    interface LayoutSelectionSeam {
      selectPanel: (id: string | null) => void
    }

    const dashboardDocuments: { cn: TraeWebStatus | undefined; ai: TraeWebStatus | undefined } = { cn: undefined, ai: undefined }
    let dashboardFetchedAt: number | undefined
    let dashboardLoading = false
    let dashboardRequestedPath: string = TRAE_STATUS_PATH
    /** 记录看板当前是否在中心面板展示 */
    let quotaPanelOpen = false
    const dashboardListeners = new Set<() => void>()

    let dashboardSnap: QuotaDashboardState = {
      documents: [undefined, undefined],
      fetchedAt: undefined,
      loading: false,
      activePath: TRAE_STATUS_PATH,
    }

    const rebuildSnapshot = (): void => {
      const next: QuotaDashboardState = {
        documents: [dashboardDocuments.cn, dashboardDocuments.ai],
        fetchedAt: dashboardFetchedAt,
        loading: dashboardLoading,
        activePath: dashboardRequestedPath,
      }
      if (JSON.stringify(next) !== JSON.stringify(dashboardSnap)) {
        dashboardSnap = next
        for (const listener of dashboardListeners) listener()
      }
    }

    const dashboardSource = {
      getSnapshot: (): QuotaDashboardState => dashboardSnap,
      subscribe: (listener: () => void): (() => void) => {
        dashboardListeners.add(listener)
        return () => {
          dashboardListeners.delete(listener)
        }
      },
    }

    const notifyDashboard = (): void => {
      rebuildSnapshot()
    }

    /**
     * 刷新当前所选版本的额度状态数据
     */
    const refreshDashboard = async (options: { force?: boolean } = {}): Promise<void> => {
      if (dashboardLoading) return
      const variantId = variantOfStatusPath(dashboardRequestedPath)
      if (options.force !== true && quotaStatusIsFresh(variantId, quotaPollMs())) return
      dashboardLoading = true
      rebuildSnapshot()
      try {
        const result = await (variantId === 'trae'
          ? fetchStatusDocument(TRAE_STATUS_PATH)
          : fetchStatusDocument(TRAE_AI_STATUS_PATH))
        if (result !== undefined) {
          if (variantId === 'trae') {
            dashboardDocuments.cn = result
          } else {
            dashboardDocuments.ai = result
          }
          noteQuotaStatus(variantId, result)
        }
        dashboardFetchedAt = Date.now()
      } finally {
        dashboardLoading = false
        rebuildSnapshot()
      }
    }

    let dashboardTimer: number | undefined
    const startDashboardPoll = (): void => {
      if (dashboardTimer !== undefined) return
      void refreshDashboard()
      dashboardTimer = window.setInterval(() => {
        if (document.hidden) return
        void refreshDashboard()
      }, Math.max(60_000, quotaPollMs()))
    }

    const stopDashboardPoll = (): void => {
      if (dashboardTimer === undefined) return
      window.clearInterval(dashboardTimer)
      dashboardTimer = undefined
    }

    async function fetchStatusDocument(path: string): Promise<TraeWebStatus | undefined> {
      try {
        const response = await fetch(path, { headers: { accept: 'application/json' } })
        const body: unknown = await response.json()
        return response.ok && isTraeWebStatus(body) ? body : undefined
      } catch {
        return undefined
      }
    }

    function QuotaDashboardWithLifecycle(props: QuotaDashboardProps): React.ReactNode {
      useEffect(() => {
        quotaPanelOpen = true
        startDashboardPoll()
        return () => {
          quotaPanelOpen = false
          stopDashboardPoll()
        }
      }, [])
      return <QuotaDashboard {...props} />
    }

    const panelFace = (): QuotaDashboardInjected => ({
      hooks: {
        quotaDashboard: dashboardSource,
      },
      t,
      statusPaths: [TRAE_STATUS_PATH, TRAE_AI_STATUS_PATH],
      refresh: () => {
        void refreshDashboard({ force: true })
      },
      onVariantPicked: (path: string) => {
        dashboardRequestedPath = path
        notifyDashboard()
        void refreshDashboard()
      },
      close: () => {
        const layout = ctx.get('layout') as LayoutSelectionSeam | undefined
        if (typeof layout?.selectPanel !== 'function') return
        try {
          layout.selectPanel(null)
        } catch {
          try {
            layout.selectPanel(CONVERSATION_PANEL_ID)
          } catch (error: unknown) {
            console.error('[dsh-trae-connect] 关闭额度看板失败:', error)
          }
        }
      },
    })

    ctx.effect(() => injectQuotaCss(), 'dsh-trae-connect: quota styles')

    try {
      ctx.slots.inject('main', () => ctx.slots.register(
        { name: 'main', key: QUOTA_PANEL_ID, locale: 'panel.trae-quota', inject: panelFace as never },
        QuotaDashboardWithLifecycle as never,
      ))
    } catch (error: unknown) {
      console.error('[dsh-trae-connect] 注册额度中心看板失败:', error)
    }

    ctx.inject(['layout'], layoutCtx => {
      const layout = layoutCtx.get('layout') as LayoutSelectionSeam | undefined
      if (typeof layout?.selectPanel !== 'function') return
      try {
        for (const variant of CARD_VARIANTS) {
          const statusPath = VARIANT_STATUS[variant.id]
          if (statusPath === undefined) continue
          const injected: SidebarQuotaCardInjected = {
            t,
            statusPath,
            open: () => {
              const current = layoutCtx.get('layout') as LayoutSelectionSeam | undefined
              if (typeof current?.selectPanel !== 'function') return
              if (quotaPanelOpen && dashboardRequestedPath === statusPath) {
                current.selectPanel(null)
                return
              }
              dashboardRequestedPath = statusPath
              notifyDashboard()
              void refreshDashboard()
              current.selectPanel(QUOTA_PANEL_ID)
            },
          }
          layoutCtx.slots.inject('sidebar.footer.action', () => layoutCtx.slots.register({
            name: 'sidebar.footer.action',
            id: variant.id === 'trae' ? 'trae-quota' : 'trae-quota-ai',
            order: variant.id === 'trae' ? 20 : 21,
            locale: 'panel.trae-quota',
            inject: (): SidebarQuotaCardProps | SidebarQuotaCardInjected => injected,
          } as never, SidebarQuotaCard))
        }
      } catch (error: unknown) {
        console.error('[dsh-trae-connect] 注册侧边栏额度卡片失败:', error)
      }
    })

    ctx.inject(['modelDirectories'], scope => {
      scope.slots.inject('conversation.input.right', () => scope.slots.register({
        name: 'conversation.input.right',
        id: 'trae-probe',
        order: 10,
        inject: sessionId => ({
          directory: scope.modelDirectories.directoryFor(
            sessionId as Parameters<typeof scope.modelDirectories.directoryFor>[0],
          ).store,
          t,
        }),
      }, TraeProbeControl))
    })
  } catch (error: unknown) {
    console.error('[dsh-trae-connect] 客户端卡片加载失败（后端模型服务不受影响）:', error)
  }
}
