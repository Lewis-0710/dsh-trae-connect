/**
 * Trae models for DeepSeek Harness. Registers providers for CN and Global variants.
 *
 * @module dsh-trae-connect
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import {
  createTraeAdapter,
  TRAE_AI_PROVIDER,
  TRAE_PROVIDER,
  type TraeAdapter,
} from './adapter.ts'
import {
  parseTraeAuth,
  parseTraeDocument,
  TraeCredentialStore,
  type TraeAuthStatus,
  type TraeCredential,
} from './auth.ts'
import {
  FALLBACK_TRAE_MODELS,
  FALLBACK_TRAE_MODELS_AI,
  fallbackModelsFor,
  formatTraeModelDisplayName,
  mergeTraeModelSources,
  TraeCatalog,
  type TraeModelInfo,
} from './catalog.ts'
import {
  TRAE_CATALOG_FILENAME,
  TraeCatalogStore,
} from './catalog-store.ts'
import {
  CheckInScheduler,
  getUtc8DateString,
  JsonFileCheckInStore,
} from './checkin-scheduler.ts'
import {
  clearHostHeartbeat,
  isHeartbeatProcessAlive,
  readHostHeartbeat,
  traeHostHeartbeatPath,
  writeHostHeartbeat,
  type TraeHostHeartbeat,
} from './host-heartbeat.ts'
import { TraeLoginClient } from './login.ts'
import {
  createLoginKey,
  traeLoginHandler,
} from './login-route.ts'
import {
  traePluginDataDir,
  traeStateDir,
  traeStorageCandidates,
  type TraeCredentialSource,
  type TraeEdition,
  type TraeStorageCandidate,
} from './paths.ts'
import {
  PROBE_EFFORT_CANDIDATES,
  probeModel,
  type ProbeAttempt,
  type ProbeOutcome,
  type ProbeSender,
} from './probe.ts'
import {
  createProbeKey,
  traeProbeHandler,
} from './probe-route.ts'
import {
  TraeProbeService,
  type TraeProbeStatus,
} from './probe-service.ts'
import {
  fingerprintModel,
  newestFirst,
  TRAE_PROBE_FILENAME,
  TraeProbeStore,
  type TraeProbeRecord,
  type TraeProbeValidation,
} from './probe-store.ts'
import { refreshTraeCredential } from './refresh.ts'
import {
  createTraeShim,
  type TraeShim,
} from './shim.ts'
import {
  TRAE_AI_LOGIN_PATH,
  TRAE_AI_PROBE_PATH,
  TRAE_AI_STATUS_PATH,
  TRAE_LOGIN_PATH,
  TRAE_PROBE_PATH,
  TRAE_STATUS_PATH,
  type TraeProbeAction,
  type TraeWebCatalog,
  type TraeWebCreditAccount,
  type TraeWebCredits,
  type TraeWebLoginAction,
  type TraeWebLoginRequest,
  type TraeWebLoginResult,
  type TraeWebModelBadge,
  type TraeWebProbeModel,
  type TraeWebProbeSection,
  type TraeWebStatus,
} from './status-paths.ts'
import {
  classifyUpstreamError,
  TraeUpstreamClient,
  type TraeChatResult,
  type UpstreamErrorKind,
} from './upstream.ts'
import {
  AI_VARIANT,
  CN_VARIANT,
  TRAE_VARIANTS,
  variantFor,
  variantForRegion,
  type TraeRegion,
  type TraeVariant,
} from './variants.ts'
import { TRAE_CONNECT_VERSION } from './version.ts'
import {
  traeStatusHandler,
} from './web-status.ts'

export {
  createTraeAdapter,
  TRAE_AI_PROVIDER,
  TRAE_PROVIDER,
  type TraeAdapter,
} from './adapter.ts'
export {
  parseTraeAuth,
  parseTraeDocument,
  TraeCredentialStore,
  type TraeAuthStatus,
  type TraeCredential,
} from './auth.ts'
export {
  FALLBACK_TRAE_MODELS,
  FALLBACK_TRAE_MODELS_AI,
  fallbackModelsFor,
  formatTraeModelDisplayName,
  mergeTraeModelSources,
  TraeCatalog,
  type TraeModelInfo,
} from './catalog.ts'
export {
  TRAE_CATALOG_FILENAME,
  TraeCatalogStore,
} from './catalog-store.ts'
export {
  CheckInScheduler,
  getUtc8DateString,
  JsonFileCheckInStore,
} from './checkin-scheduler.ts'
export {
  clearHostHeartbeat,
  isHeartbeatProcessAlive,
  readHostHeartbeat,
  traeHostHeartbeatPath,
  writeHostHeartbeat,
  type TraeHostHeartbeat,
} from './host-heartbeat.ts'
export { TraeLoginClient } from './login.ts'
export {
  createLoginKey,
  traeLoginHandler,
} from './login-route.ts'
export {
  traePluginDataDir,
  traeStateDir,
  traeStorageCandidates,
  type TraeCredentialSource,
  type TraeEdition,
  type TraeStorageCandidate,
} from './paths.ts'
export {
  PROBE_EFFORT_CANDIDATES,
  probeModel,
  type ProbeAttempt,
  type ProbeOutcome,
  type ProbeSender,
} from './probe.ts'
export {
  createProbeKey,
  traeProbeHandler,
} from './probe-route.ts'
export {
  TraeProbeService,
  type TraeProbeStatus,
} from './probe-service.ts'
export {
  fingerprintModel,
  newestFirst,
  TRAE_PROBE_FILENAME,
  TraeProbeStore,
  type TraeProbeRecord,
  type TraeProbeValidation,
} from './probe-store.ts'
export { refreshTraeCredential } from './refresh.ts'
export {
  createTraeShim,
  type TraeShim,
} from './shim.ts'
export {
  TRAE_AI_LOGIN_PATH,
  TRAE_AI_PROBE_PATH,
  TRAE_AI_STATUS_PATH,
  TRAE_LOGIN_PATH,
  TRAE_PROBE_PATH,
  TRAE_STATUS_PATH,
  type TraeProbeAction,
  type TraeWebCatalog,
  type TraeWebCreditAccount,
  type TraeWebCredits,
  type TraeWebLoginAction,
  type TraeWebLoginRequest,
  type TraeWebLoginResult,
  type TraeWebModelBadge,
  type TraeWebProbeModel,
  type TraeWebProbeSection,
  type TraeWebStatus,
} from './status-paths.ts'
export {
  classifyUpstreamError,
  TraeUpstreamClient,
  type TraeChatResult,
  type UpstreamErrorKind,
} from './upstream.ts'
export {
  AI_VARIANT,
  CN_VARIANT,
  TRAE_VARIANTS,
  variantFor,
  variantForRegion,
  type TraeRegion,
  type TraeVariant,
} from './variants.ts'
export { TRAE_CONNECT_VERSION } from './version.ts'
export { traeStatusHandler } from './web-status.ts'

export const name = 'llm-trae'
export const inject = ['llm']

export const TRAE_SETTINGS_NS = 'trae' as SettingsNamespace
export const TRAE_AI_SETTINGS_NS = 'trae-global' as SettingsNamespace
export const TRAE_QUOTA_SETTINGS_NS = 'trae-quota' as SettingsNamespace

/** Plugin configuration. */
export interface Config {
  probeConsent?: boolean
  useMaximumContextWindow?: boolean
  sidebarQuotaCN?: boolean
  sidebarQuotaAI?: boolean
  autoCheckInCN?: boolean
  autoCheckInAI?: boolean
  quotaPollMs?: number
}

const PROBE_CONSENT_FIELD = z.boolean().default(false)
  .description('Authorize reasoning-effort probes (each probe sends real requests that may consume credit)')
const MAXIMUM_CONTEXT_WINDOW_FIELD = z.boolean().default(true)
  .description('Use the largest context window declared by Trae when alternatives are available (on by default)')
const QUOTA_TOGGLE_FIELD = z.boolean().default(false)
  .description('Show this variant\u2019s remaining-credit card in the sidebar footer (off by default)')
const CHECKIN_TOGGLE_FIELD = z.boolean().default(false)
  .description('Automatically check in daily (off by default)')
export const QUOTA_POLL_DEFAULT_MS = 300_000
export const QUOTA_POLL_MIN_MS = 60_000
const QUOTA_POLL_FIELD = z.number()
  .default(QUOTA_POLL_DEFAULT_MS)
  .min(QUOTA_POLL_MIN_MS)
  .description('Sidebar quota card refresh interval in milliseconds (default 300000, minimum 60000)')

export const Config: z<Config> = z.object({
  probeConsent: PROBE_CONSENT_FIELD,
  useMaximumContextWindow: MAXIMUM_CONTEXT_WINDOW_FIELD,
  sidebarQuotaCN: QUOTA_TOGGLE_FIELD,
  sidebarQuotaAI: QUOTA_TOGGLE_FIELD,
  autoCheckInCN: CHECKIN_TOGGLE_FIELD,
  autoCheckInAI: CHECKIN_TOGGLE_FIELD,
  quotaPollMs: QUOTA_POLL_FIELD,
})

const CN_SECTION: z<Config> = z.object({
  probeConsent: PROBE_CONSENT_FIELD,
  useMaximumContextWindow: MAXIMUM_CONTEXT_WINDOW_FIELD,
})

const AI_SECTION: z<Config> = z.object({
  useMaximumContextWindow: MAXIMUM_CONTEXT_WINDOW_FIELD,
})

const QUOTA_SECTION: z<Config> = z.object({
  sidebarQuotaCN: QUOTA_TOGGLE_FIELD,
  sidebarQuotaAI: QUOTA_TOGGLE_FIELD,
  autoCheckInCN: CHECKIN_TOGGLE_FIELD,
  autoCheckInAI: CHECKIN_TOGGLE_FIELD,
  quotaPollMs: QUOTA_POLL_FIELD,
})


interface VariantContext {
  variant: TraeVariant
  store: TraeCredentialStore
  loginClient: TraeLoginClient
  catalog: TraeCatalog
  catalogStore: TraeCatalogStore
  probeStore: TraeProbeStore
  probeService: TraeProbeService
  client: TraeUpstreamClient
  shim: TraeShim
  adapter: TraeAdapter
  key: string
}

export function apply(ctx: Context, config: Config = {}): void {
  const contexts: VariantContext[] = []

  const sources: { cn: () => Config; ai: () => Config; quota: () => Config } = {
    cn: () => config,
    ai: () => config,
    quota: () => config,
  }

  const merged = (): Config => ({
    ...sources.cn().probeConsent === undefined ? {} : { probeConsent: sources.cn().probeConsent },
    ...sources.ai().useMaximumContextWindow === undefined ? {} : { useMaximumContextWindow: sources.ai().useMaximumContextWindow },
    ...sources.quota().sidebarQuotaCN === undefined ? {} : { sidebarQuotaCN: sources.quota().sidebarQuotaCN },
    ...sources.quota().sidebarQuotaAI === undefined ? {} : { sidebarQuotaAI: sources.quota().sidebarQuotaAI },
    ...sources.quota().autoCheckInCN === undefined ? {} : { autoCheckInCN: sources.quota().autoCheckInCN },
    ...sources.quota().autoCheckInAI === undefined ? {} : { autoCheckInAI: sources.quota().autoCheckInAI },
    ...sources.quota().quotaPollMs === undefined ? {} : { quotaPollMs: sources.quota().quotaPollMs },
  })

  const maximumContextWindowByVariant: Record<string, boolean> = {
    trae: config.useMaximumContextWindow ?? true,
    'trae-global': config.useMaximumContextWindow ?? true,
  }

  for (const variant of TRAE_VARIANTS) {
    const store = new TraeCredentialStore({
      variant,
      refresh: cred => refreshTraeCredential(cred),
    })
    const loginClient = new TraeLoginClient(variant, store)
    const catalog = new TraeCatalog(variant.region)
    const catalogStore = new TraeCatalogStore({ variant })
    const probeStore = new TraeProbeStore({ variant })
    const client = new TraeUpstreamClient({
      variant,
      store,
      catalog: () => catalog.current(),
    })

    const probeService = new TraeProbeService({
      store: probeStore,
      catalog,
      client,
      consent: () => merged().probeConsent === true,
      account: () => variant.region,
    })

    const shim = createTraeShim({
      catalog,
      client,
      logger: {
        warn: (message: unknown, ...args: unknown[]) => ctx.logger.warn(String(message), ...args),
        error: (message: unknown, ...args: unknown[]) => ctx.logger.error(String(message), ...args),
      },
    })

    const adapter = createTraeAdapter({
      variant,
      shim,
      catalog,
      useMaximumContextWindow: () => maximumContextWindowByVariant[variant.id] ?? false,
    })

    void shim.ready.then(() => {
      adapter.invalidate()
    })

    const key = createLoginKey()

    contexts.push({
      variant,
      store,
      loginClient,
      catalog,
      catalogStore,
      probeStore,
      probeService,
      client,
      shim,
      adapter,
      key,
    })

    // Restore cached catalog if available
    const cached = catalogStore.get(variant.region)
    if (cached !== undefined && cached.models.length > 0) {
      catalog.setSaved([...cached.models], cached.fetchedAtMs)
    }

    // Register provider to DSH
    const llmAny = ctx.llm as unknown as {
      registerAdapter?: (providers: string[], adapter: unknown) => (() => void)
      registerConfigurableProviders?: (providers: unknown[]) => (() => void)
      registerProvider?: (provider: unknown) => { unregister: () => void }
    }
    if (typeof llmAny.registerAdapter === 'function') {
      const unregisterAdapter = llmAny.registerAdapter([variant.id], adapter.adapter)
      const unregisterConfig = llmAny.registerConfigurableProviders?.([{
        provider: variant.id,
        displayName: variant.displayName,
        settingsNs: variant.id === 'trae' ? TRAE_SETTINGS_NS : TRAE_AI_SETTINGS_NS,
        settingsPath: [],
        declared: false,
      }])
      ctx.effect(() => () => {
        unregisterAdapter?.()
        unregisterConfig?.()
      })
    } else if (typeof llmAny.registerProvider === 'function') {
      const handle = llmAny.registerProvider(adapter.adapter)
      ctx.effect(() => () => handle.unregister())
    }

    // Initial catalog fetch in background
    setTimeout(async () => {
      try {
        const live = await client.fetchCatalog()
        if (live.length > 0) {
          catalog.setLive(live)
          catalogStore.put(variant.region, 'live', live)
          adapter.invalidate()
        }
      } catch {
        catalog.setFallback()
      }
    }, 1_000)
  }

  // Checkin & Usage Scheduler
  const scheduler = new CheckInScheduler(
    contexts.map(c => ({ variantId: c.variant.id, client: c.client })),
  )
  scheduler.start()

  // Register Web Routes via Cordis webServer injection
  ctx.inject(['webServer'], (webCtx: Context) => {
    for (const vCtx of contexts) {
      webCtx.effect(() => {
        const disposeStatus = webCtx.webServer.register({
          kind: 'exact',
          path: vCtx.variant.statusPath,
          handler: (req, res) => {
            void traeStatusHandler(req, res, {
              variant: vCtx.variant,
              store: vCtx.store,
              client: vCtx.client,
              models: () => vCtx.catalog.current(),
              catalog: () => vCtx.catalog.status(),
              probe: () => ({
                consent: true,
                running: vCtx.probeService.isRunning(),
                candidates: vCtx.probeService.candidates(),
                results: Object.entries(vCtx.probeStore.all()).map(([id, r]) => ({
                  id,
                  name: id,
                  validation: r.validation,
                  efforts: r.efforts,
                  probedAt: r.probedAtMs,
                })),
              }),
              loginKey: vCtx.key,
              probeKey: vCtx.key,
              checkIn: () => {
                const rec = scheduler.get(vCtx.variant.id)
                if (!rec) return undefined
                return {
                  lastDate: rec.lastDate,
                  lastAt: rec.lastAt,
                  status: rec.status,
                  amount: rec.amount,
                  message: rec.message,
                  logs: rec.logs,
                }
              },
              disabledModels: () => vCtx.catalog.getDisabledModels(),
              useMaximumContextWindow: () => maximumContextWindowByVariant[vCtx.variant.id] ?? false,
              onForceRefresh: async () => {
                const live = await vCtx.client.fetchCatalog().catch(() => [])
                if (live.length > 0) {
                  vCtx.catalog.setLive(live)
                  vCtx.catalogStore.put(vCtx.variant.region, 'live', live)
                  vCtx.adapter.invalidate()
                }
              },
            })
          },
        })

        const disposeLogin = webCtx.webServer.register({
          kind: 'exact',
          path: vCtx.variant.loginPath,
          handler: (req, res) => {
            void traeLoginHandler(req, res, {
              variant: vCtx.variant,
              loginClient: vCtx.loginClient,
              loginKey: () => vCtx.key,
              onLoggedIn: () => {
                void vCtx.client.fetchCatalog().then((live) => {
                  if (live.length > 0) {
                    vCtx.catalog.setLive(live)
                    vCtx.catalogStore.put(vCtx.variant.region, 'live', live)
                    vCtx.adapter.invalidate()
                  }
                })
              },
            })
          },
        })

        const disposeProbe = webCtx.webServer.register({
          kind: 'exact',
          path: vCtx.variant.probePath,
          handler: (req, res) => {
            void traeProbeHandler(req, res, {
              variant: vCtx.variant,
              probeService: vCtx.probeService,
              probeKey: () => vCtx.key,
              onRefresh: async () => {
                const live = await vCtx.client.fetchCatalog()
                if (live.length > 0) {
                  vCtx.catalog.setLive(live)
                  vCtx.catalogStore.put(vCtx.variant.region, 'live', live)
                  vCtx.adapter.invalidate()
                }
                await scheduler.syncVariant(vCtx.variant.id)
              },
              onCheckin: async () => {
                return await scheduler.checkIn(vCtx.variant.id)
              },
              onClearCheckInLogs: () => {
                scheduler.clearLogs(vCtx.variant.id)
              },
              onSetMaximumContextWindow: async (enabled) => {
                maximumContextWindowByVariant[vCtx.variant.id] = enabled
                vCtx.adapter.invalidate()
                return { state: 'updated', enabled }
              },
              onSetDisabledModels: async (disabled) => {
                vCtx.catalog.setDisabledModels(disabled)
                vCtx.adapter.invalidate()
                return { state: 'updated', disabledModels: disabled }
              },
            })
          },
        })

        return () => {
          disposeStatus()
          disposeLogin()
          disposeProbe()
        }
      })
    }
  })

  // Heartbeat
  void writeHostHeartbeat()

  // Settings sections to make namespaces served and configurable
  ctx.inject(['settings'], (settingsCtx: Context) => {
    settingsCtx.settings.installSection(ctx, TRAE_SETTINGS_NS, CN_SECTION, config, {
      setSource(source) { sources.cn = source as () => Config },
      onChange: () => {},
    })
    settingsCtx.settings.installSection(ctx, TRAE_AI_SETTINGS_NS, AI_SECTION, config, {
      setSource(source) { sources.ai = source as () => Config },
      onChange: () => {},
    })
    settingsCtx.settings.installSection(ctx, TRAE_QUOTA_SETTINGS_NS, QUOTA_SECTION, config, {
      setSource(source) { sources.quota = source as () => Config },
      onChange: () => {
        void scheduler.runAll()
      },
    })
  })

  ctx.effect(() => () => {
    scheduler.stop()
    void clearHostHeartbeat()
    for (const vCtx of contexts) {
      void vCtx.shim.close().catch(() => {})
    }
  })
}
