/**
 * 侧栏底部额度卡片与中心面板详细额度看板组件。
 *
 * @module dsh-trae-connect/client/sidebar-quota
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { isTraeWebStatus } from './status-document.ts'
import type { TraeWebStatus } from '../status-paths.ts'
import type { TraeSettingsKey } from './locales.ts'
import { clampPercent, mergeCreditAccounts, sortPackageRows, visibleQuotaGroups } from './quota-merge.ts'
import { onQuotaSettingsChange, noteQuotaStatus, quotaPollMs, quotaSettingsRevision, quotaStatus, quotaStatusFetchedAt, quotaToggles, variantOfStatusPath } from './quota-settings-store.ts'

export interface SidebarQuotaCardInjected {
  t: (key: QuotaCopyKey, params?: Record<string, unknown>) => string
  statusPath: string
  open: () => void
}

export type QuotaCopyKey =
  | 'quotaCardCN'
  | 'quotaCardAI'
  | 'quotaUnknownTotal'
  | 'quotaUnlimited'
  | 'quotaExpires'
  | 'quotaNoExpiry'
  | 'quotaError'
  | 'quotaNotSignedIn'
  | 'quotaUpdated'
  | 'quotaDashboardTitle'
  | 'quotaDashboardSubtitle'
  | 'quotaRefresh'
  | 'quotaRefreshing'
  | 'quotaClose'
  | 'quotaByPackage'
  | 'quotaTotal'
  | 'quotaTotalRemain'
  | 'quotaTotalShare'
  | 'quotaColPackage'
  | 'quotaColRemain'
  | 'quotaColExpiry'

export type SidebarQuotaCardProps =
  PropsRuntime<'sidebar.footer.action'>
  & Partial<SidebarQuotaCardInjected>

const fallbackT = (key: QuotaCopyKey): string => key

interface QuotaBarView {
  label: string
  detail: string
  percent: string | undefined
  barPercent: number
  warn: boolean
  packageEndTime: string | undefined
}

function buildBars(accounts: readonly { packageName: string; remain: number; size: number; unlimited?: true; packageEndTime?: string }[]): QuotaBarView[] {
  const groups = visibleQuotaGroups(mergeCreditAccounts(accounts))
  const bars: QuotaBarView[] = []
  for (const group of groups) {
    const percent = group.unlimited ? undefined : clampPercent(group.remain, group.size)
    const detail = group.unlimited
      ? '∞'
      : percent === undefined
        ? `${group.remain.toLocaleString()} · ?`
        : `${group.remain.toLocaleString()} / ${group.size.toLocaleString()}`
    bars.push({
      label: group.packageName,
      detail,
      percent: percent === undefined ? undefined : `${Math.round(percent)}%`,
      barPercent: percent === undefined ? 0 : Math.max(2, percent),
      warn: !group.unlimited && percent !== undefined && percent < 20,
      packageEndTime: group.packageEndTime,
    })
  }
  return bars
}

function Ring({ percent, warn, size }: { percent: number; warn: boolean; size: number }): React.ReactNode {
  const clamped = Math.min(100, Math.max(0, percent))
  const circumference = 45.55
  const dashoffset = Math.round(circumference * (1 - clamped / 100) * 1000) / 1000
  return (
    <span className="trp-glyph" aria-hidden="true">
      <svg viewBox="0 0 20 20" width={size} height={size} focusable="false">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <circle
          cx="10"
          cy="10"
          r="7.25"
          fill="none"
          stroke={warn ? 'var(--dsw-alias-state-error-primary)' : 'currentColor'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={String(circumference)}
          strokeDashoffset={String(dashoffset)}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  )
}

interface PackageRow {
  name: string
  remain: number
  size: number
  percent: number | undefined
  warn: boolean
  packageEndTime: string | undefined
}

function buildPackageRows(accounts: readonly { packageName: string; remain: number; size: number; unlimited?: true; packageEndTime?: string }[]): PackageRow[] {
  const ordered = sortPackageRows(accounts)
  return ordered.map(account => {
    const percent = account.unlimited === true ? undefined : clampPercent(account.remain, account.size)
    return {
      name: account.packageName,
      remain: account.remain,
      size: account.size,
      percent,
      warn: account.unlimited !== true && percent !== undefined && percent < 20,
      packageEndTime: account.packageEndTime,
    }
  })
}

function timeText(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function SidebarQuotaCard(props: SidebarQuotaCardProps): React.ReactNode {
  const { t = fallbackT, statusPath, open } = props
  const variantId = statusPath !== undefined ? variantOfStatusPath(statusPath) : 'trae'
  const nameKey: QuotaCopyKey = variantId === 'trae-ai' ? 'quotaCardAI' : 'quotaCardCN'
  const wide = props.wide !== false
  const [failed, setFailed] = useState(false)
  useSyncExternalStore(onQuotaSettingsChange, quotaSettingsRevision)
  const enabled = variantId === 'trae' ? quotaToggles().cn : quotaToggles().ai
  const status = quotaStatus(variantId)
  const signedIn = status?.status === 'signed-in'

  useEffect(() => {
    if (statusPath === undefined || !enabled) return undefined
    let disposed = false
    let timer: number | undefined
    const controller = new AbortController()
    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(statusPath, { signal: controller.signal, headers: { accept: 'application/json' } })
        const body: unknown = await response.json()
        if (disposed) return
        if (!response.ok || !isTraeWebStatus(body)) {
          setFailed(true)
          return
        }
        setFailed(false)
        noteQuotaStatus(variantId, body)
      } catch {
        if (!disposed) setFailed(true)
      }
    }
    const isHidden = (): boolean => typeof document !== 'undefined' && document.hidden
    const loop = (): void => {
      if (isHidden()) return
      void refresh()
    }
    timer = window.setInterval(loop, Math.max(60_000, quotaPollMs()))
    void refresh()
    const onVisible = (): void => {
      if (!isHidden()) loop()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    return () => {
      disposed = true
      controller.abort()
      if (timer !== undefined) window.clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [statusPath, enabled, variantId])

  if (enabled === false) return null

  const credits = status !== undefined && 'credits' in status ? status.credits : undefined
  const bars = credits === undefined ? [] : buildBars(credits.accounts ?? [])
  const lowest = bars.reduce<number | undefined>((acc, bar) => {
    if (bar.percent === undefined) return acc
    const value = Number.parseFloat(bar.percent)
    if (!Number.isFinite(value)) return acc
    return acc === undefined ? value : Math.min(acc, value)
  }, undefined)
  const ringPercent = failed || status === undefined ? 0 : credits?.unlimited === true ? 100 : lowest ?? 0
  const ringWarn = failed || (lowest !== undefined && lowest < 20)
  const fetchedAt = quotaStatusFetchedAt(variantId)
  const title = [
    t(nameKey),
    ...bars.map(bar => `${bar.label} ${bar.detail}${bar.percent === undefined ? '' : ` (${bar.percent})`}`),
    fetchedAt !== undefined ? `${t('quotaUpdated')} ${timeText(fetchedAt)}` : '',
  ].filter(part => part !== '').join(' · ')

  if (!wide) {
    return (
      <button
        type="button"
        className="trp-railButton"
        aria-label={title}
        title={title}
        disabled={!signedIn}
        onClick={() => {
          if (!signedIn) return
          open?.()
        }}
      >
        <Ring percent={ringPercent} warn={ringWarn} size={18} />
      </button>
    )
  }

  return (
    <button
      type="button"
      className="trp-foot"
      aria-label={title}
      title={title}
      disabled={!signedIn}
      onClick={() => {
        if (!signedIn) return
        open?.()
      }}
    >
      <span className="trp-footTop">
        <Ring percent={ringPercent} warn={ringWarn} size={16} />
        <span className="trp-footName">{t(nameKey)}</span>
        <span style={{ flex: 1 }} />
        {fetchedAt !== undefined ? <span className="trp-updated">{t('quotaUpdated')} {timeText(fetchedAt)}</span> : null}
      </span>

      {failed ? (
        <span className="trp-footRow">
          <span className="trp-footLabel">{t('quotaError')}</span>
        </span>
      ) : bars.length === 0 ? (
        <span className="trp-footRow">
          <span className="trp-footLabel">
            {status === undefined
              ? '…'
              : !('credits' in status)
                ? t('quotaNotSignedIn')
                : (status.creditsError ?? t('quotaError'))}
          </span>
        </span>
      ) : (
        bars.map((bar, index) => (
          <span className="trp-footRow" key={`${index}\u0000${bar.label}\u0000${bar.packageEndTime ?? ''}`}>
            <span className="trp-footHead">
              <span className="trp-footLabel" title={bar.packageEndTime !== undefined ? `${t('quotaExpires')} ${bar.packageEndTime}` : t('quotaNoExpiry')}>
                {bar.label}
              </span>
              <span className="trp-footAmount">{bar.detail}</span>
              <span className="trp-footPct">{bar.percent ?? ''}</span>
            </span>
            <span className="trp-footBar">
              <span
                className={bar.warn ? 'trp-footFill trp-footFillWarn' : 'trp-footFill'}
                style={{ width: `${bar.barPercent}%` }}
              />
            </span>
          </span>
        ))
      )}
    </button>
  )
}

export interface QuotaDashboardInjected {
  hooks: {
    quotaDashboard: { getSnapshot: () => QuotaDashboardState; subscribe: (listener: () => void) => () => void }
  }
  t: (key: QuotaCopyKey, params?: Record<string, unknown>) => string
  statusPaths: readonly string[]
  refresh: () => void
  close: () => void
  onVariantPicked: (path: string) => void
}

export interface QuotaDashboardState {
  documents: readonly (TraeWebStatus | undefined)[]
  fetchedAt: number | undefined
  loading: boolean
  activePath: string
}

export interface QuotaDashboardProps {
  t: (key: QuotaCopyKey, params?: Record<string, unknown>) => string
  statusPaths: readonly string[]
  refresh: () => void
  close: () => void
  onVariantPicked: (path: string) => void
  useQuotaDashboard: <T>(selector: (state: QuotaDashboardState) => T) => T
}

export function QuotaDashboard(props: QuotaDashboardProps): React.ReactNode {
  const { t = fallbackT, statusPaths, refresh, close, useQuotaDashboard, onVariantPicked } = props
  useSyncExternalStore(onQuotaSettingsChange, quotaSettingsRevision)
  const state = useQuotaDashboard(s => s)
  const followedPath = state.activePath
  const [userPicked, setUserPicked] = useState<string | undefined>(undefined)
  const activePathResolved = userPicked ?? followedPath
  const activeVariant = variantOfStatusPath(activePathResolved)
  const status = quotaStatus(activeVariant)
  const loading = state.loading
  const fetchedAt = state.fetchedAt
  const credits = status !== undefined && 'credits' in status ? status.credits : undefined
  const rows = credits === undefined ? [] : buildPackageRows(credits.accounts ?? [])
  const nameKey: QuotaCopyKey = activeVariant === 'trae-ai' ? 'quotaCardAI' : 'quotaCardCN'
  const signedIn = status?.status === 'signed-in'
  const totalRemain = credits?.total ?? 0
  const totalSize = credits?.totalSize ?? credits?.accounts.reduce((sum, account) => sum + account.size, 0) ?? 0
  const totalPercent = clampPercent(totalRemain, totalSize)

  return (
    <div className="trp-main" role="region" aria-label={t('quotaDashboardTitle')}>
      <div className="trp-mainInner">
        <header className="trp-header">
          <div className="trp-headerText">
            <h2 className="trp-title">{t('quotaDashboardTitle')}</h2>
            <p className="trp-subtitle">{t('quotaDashboardSubtitle')}</p>
          </div>
          <span className="trp-spacer" />
          {fetchedAt !== undefined ? <span className="trp-meta">{t('quotaUpdated')} {timeText(fetchedAt)}</span> : null}
          <button type="button" className="trp-refresh" disabled={loading} onClick={() => refresh()}>
            {loading ? t('quotaRefreshing') : t('quotaRefresh')}
          </button>
          <button type="button" className="trp-close" aria-label={t('quotaClose')} title={t('quotaClose')} onClick={() => close()}>
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {statusPaths.length > 1 ? (
          <div className="trp-tabs" role="tablist" aria-label={t('quotaDashboardTitle')}>
            {statusPaths.map(path => {
              const variant = variantOfStatusPath(path)
              const key: QuotaCopyKey = variant === 'trae-ai' ? 'quotaCardAI' : 'quotaCardCN'
              return (
                <button
                  key={path}
                  type="button"
                  role="tab"
                  aria-selected={path === activePathResolved}
                  className={path === activePathResolved ? 'trp-tab trp-tabActive' : 'trp-tab'}
                  onClick={() => {
                    setUserPicked(path)
                    onVariantPicked(path)
                  }}
                >
                  {t(key)}
                </button>
              )
            })}
          </div>
        ) : null}

        <section className="trp-card">
          <div className="trp-cardHead">
            <span className="trp-avatar">{activeVariant === 'trae-ai' ? 'AI' : 'CN'}</span>
            <span className="trp-cardIdentity">
              <span className="trp-cardTitle">{t(nameKey)}</span>
              <span className="trp-cardOwner">{signedIn ? (status.nickname ?? '') : t('quotaNotSignedIn')}</span>
            </span>
            {credits?.unlimited === true ? <span className="trp-badge">{t('quotaUnlimited')}</span> : null}
          </div>
          {!signedIn ? (
            <div className="trp-notice">
              <p className="trp-noticeTitle">{t('quotaNotSignedIn')}</p>
            </div>
          ) : credits === undefined ? (
            <div className="trp-notice trp-noticeError">
              <p className="trp-noticeTitle">{t('quotaError')}</p>
            </div>
          ) : (
            <>
              <p className="trp-totalLine">
                {t('quotaTotalRemain')} <strong className="trp-totalValue">{totalRemain.toLocaleString()}</strong>
              </p>
              <p className="trp-totalSub">
                {t('quotaTotalShare', {
                  percent: totalPercent === undefined ? t('quotaUnknownTotal') : `${totalPercent.toFixed(2)}%`,
                  remain: totalRemain.toLocaleString(),
                  size: totalSize.toLocaleString(),
                })}
              </p>
              <div
                className="trp-bar"
                role="progressbar"
                aria-label={t('quotaTotal')}
                {...totalPercent === undefined
                  ? { 'aria-valuetext': t('quotaUnknownTotal') }
                  : { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(totalPercent) }}
              >
                <div
                  className={totalPercent !== undefined && totalPercent < 20 ? 'trp-barFill trp-barFillWarn' : 'trp-barFill'}
                  style={{ width: totalPercent === undefined ? '100%' : `${Math.max(2, totalPercent)}%`, opacity: totalPercent === undefined ? 0.25 : 1 }}
                />
              </div>

              <h3 className="trp-blockTitle">{t('quotaByPackage')}</h3>
              <table className="trp-table">
                <thead>
                  <tr>
                    <th>{t('quotaColPackage')}</th>
                    <th>{t('quotaColRemain')}</th>
                    <th>{t('quotaColExpiry')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${index}\u0000${row.name}\u0000${row.packageEndTime ?? ''}`}>
                      <td>{row.name}</td>
                      <td className="trp-num">
                        <span className="trp-numText">{row.remain.toLocaleString()} / {row.size.toLocaleString()}</span>
                        <span className="trp-miniBar">
                          <span
                            className={row.warn ? 'trp-footFill trp-footFillWarn' : 'trp-footFill'}
                            style={{
                              display: 'block',
                              height: '100%',
                              borderRadius: 999,
                              width: row.percent === undefined ? '100%' : `${Math.max(2, row.percent)}%`,
                              opacity: row.percent === undefined ? 0.25 : 1,
                            }}
                          />
                        </span>
                      </td>
                      <td className="trp-expiry">{row.packageEndTime ?? t('quotaNoExpiry')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {credits.cycleResetTime !== undefined ? (
                <p className="trp-windowReset">{t('quotaExpires')} {credits.cycleResetTime}</p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
