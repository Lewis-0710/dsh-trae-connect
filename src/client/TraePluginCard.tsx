/**
 * Trae 插件主配置卡片组件，支持像素级对齐 dsh-workbuddy-connect 的全功能与布局。
 *
 * @module dsh-trae-connect/client/trae-plugin-card
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  TRAE_AI_LOGIN_PATH,
  TRAE_AI_PROBE_PATH,
  TRAE_AI_STATUS_PATH,
  TRAE_LOGIN_PATH,
  TRAE_PROBE_PATH,
  TRAE_STATUS_PATH,
} from '../status-paths.ts'
import type { TraeWebModelBadge, TraeWebProbeSection, TraeWebStatus } from '../status-paths.ts'
import { isTraeWebStatus } from './status-document.ts'
import type { TraeSettingsKey } from './locales.ts'
import { QuotaSettingsContent } from './QuotaSettingsCard.tsx'
import type { QuotaSection } from './QuotaSettingsCard.tsx'
import {
  noteQuotaSignIn,
  noteQuotaStatus,
  onQuotaSettingsChange,
  quotaSignInState,
} from './quota-settings-store.ts'

export type TraeVariantId = 'trae' | 'trae-ai'

export interface TraePluginCardInjected {
  t: (key: TraeSettingsKey, params?: Record<string, unknown>) => string
  variant?: TraeCardVariant
  scope?: SettingsScope<QuotaSection> | undefined
  signedIn?: (() => { cn: boolean; ai: boolean }) | undefined
  unified?: boolean
}

export interface TraeCardVariant {
  id: string
  titleKey: TraeSettingsKey
  introKey: TraeSettingsKey
  signedOutKey: TraeSettingsKey
  statusPath: string
  probePath: string
  loginPath: string
}

export const CN_CARD_VARIANT: TraeCardVariant = {
  id: 'trae',
  titleKey: 'title',
  introKey: 'intro',
  signedOutKey: 'signedOutHint',
  statusPath: TRAE_STATUS_PATH,
  probePath: TRAE_PROBE_PATH,
  loginPath: TRAE_LOGIN_PATH,
}

export const AI_CARD_VARIANT: TraeCardVariant = {
  id: 'trae-ai',
  titleKey: 'titleAI',
  introKey: 'introAI',
  signedOutKey: 'signedOutHintAI',
  statusPath: TRAE_AI_STATUS_PATH,
  probePath: TRAE_AI_PROBE_PATH,
  loginPath: TRAE_AI_LOGIN_PATH,
}

export const CARD_VARIANTS: readonly TraeCardVariant[] = [CN_CARD_VARIANT, AI_CARD_VARIANT]

export type TraePluginCardProps =
  PropsRuntime<'settings.plugin.item'>
  & Partial<TraePluginCardInjected>

const POLL_INTERVAL_MS = 60_000

const cardStyle: CSSProperties = {
  listStyle: 'none',
  borderWidth: '0.5px',
  borderStyle: 'solid',
  borderColor: 'var(--dsw-alias-border-l4)',
  borderRadius: 16,
  background: 'var(--dsw-alias-bg-layer-3)',
  transition: 'border-color .16s, background .16s',
}

const cardHoverStyle: CSSProperties = { borderColor: 'var(--dsw-alias-label-dimmed)' }
const cardOpenStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2)',
  borderColor: 'var(--dsw-alias-label-dimmed)',
}

const headerStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  borderWidth: 0,
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: 12,
  padding: '14px 16px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  appearance: 'none',
}

const headerFocusStyle: CSSProperties = {
  outline: '2px solid var(--dsw-alias-brand-primary)',
  outlineOffset: -2,
}

const headTextStyle: CSSProperties = { display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', gap: 4 }
const nameStyle: CSSProperties = { fontSize: 15, lineHeight: 1.4, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const descriptionStyle: CSSProperties = { fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' }

function ChevronDownIcon(): ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

const chevronStyle: CSSProperties = {
  flex: 'none',
  display: 'flex',
  color: 'var(--dsw-alias-label-tertiary)',
  transition: 'transform .16s',
}

const cardBodyStyle: CSSProperties = {
  borderTop: '.5px solid var(--dsw-alias-border-l2)',
  margin: '0 16px',
  padding: '12px 0 8px',
}

const bodyStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }
const statusStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)' }

const buttonStyle: CSSProperties = {
  boxSizing: 'border-box',
  padding: '5px 14px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  cursor: 'pointer',
}

const errorStyle: CSSProperties = { ...bodyStyle, color: 'var(--dsw-alias-state-error-primary)' }
const quotaListStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 2 }
const quotaGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 }
const quotaTitleStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const quotaLabelStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' }
const modelBadgeStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }
const modelOfferStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }
const modelRateStyle: CSSProperties = { fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' }

const contextPreferenceStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 9,
  padding: '10px 12px',
  border: '.5px solid var(--dsw-alias-border-l4)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-3)',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 13,
  lineHeight: 1.5,
}

const contextPreferenceCopyStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }
const contextPickerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
}

const modelBadgeChipStyle: CSSProperties = {
  padding: '1px 8px', borderRadius: 999, fontSize: 11, lineHeight: '18px',
  background: 'var(--dsw-alias-state-success-tertiary)',
  color: 'var(--dsw-alias-state-success-primary)',
}

function modelBadgeLabel(badge: string, t: TraePluginCardInjected['t']): string {
  if (badge === '限时免费') return t('badgeLimitedFree')
  if (badge === '夜间折扣') return t('badgeNightDiscount')
  if (badge === 'Free now') return t('badgeFreeNow')
  return badge
}

const progressTrackStyle: CSSProperties = { height: 8, overflow: 'hidden', borderRadius: 999, background: 'var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.08))' }

const confirmBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '10px 12px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1)',
}
const confirmRowStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8 }

const probeRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
const probeRowEndStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 4,
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const tabStyle: CSSProperties = {
  padding: '6px 12px',
  border: 0,
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '20px',
  cursor: 'pointer',
}
const tabActiveStyle: CSSProperties = {
  borderBottom: '2px solid var(--dsw-alias-brand-primary)',
  color: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
}
const tabPanelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 16 }

const segmentedContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'var(--dsw-alias-bg-layer-1, rgba(20, 20, 20, 0.6))',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.08))',
  borderRadius: 8,
  padding: 3,
  gap: 4,
  marginTop: 14,
  marginBottom: 16,
}

function segmentedTabItemStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 6,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: active ? 'var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.18))' : 'transparent',
    background: active ? 'var(--dsw-alias-bg-layer-3, rgba(255, 255, 255, 0.08))' : 'transparent',
    color: active ? 'var(--dsw-alias-label-primary, #fff)' : 'var(--dsw-alias-label-tertiary, #8c8c8c)',
    fontWeight: active ? 500 : 400,
    fontSize: 13,
    lineHeight: '18px',
    cursor: 'pointer',
    appearance: 'none',
    outline: 'none',
    transition: 'all .16s ease',
  }
}

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--dsw-alias-button-primary-fill)',
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}

function progressFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: '100%',
    borderRadius: 'inherit',
    background: 'var(--dsw-alias-brand-primary, #1677ff)',
  }
}

function dotStyle(status: 'loading' | TraeWebStatus['status']): CSSProperties {
  const color = status === 'signed-in'
    ? 'var(--dsw-alias-state-success-primary, #22a06b)'
    : status === 'error'
      ? 'var(--dsw-alias-state-error-primary, #d92d20)'
      : 'var(--dsw-alias-label-dimmed, #9aa0a6)'
  return { width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto', background: color }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(value)
}

function formatTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
}

function formatCycleReset(time: string): string {
  const parsed = Date.parse(time)
  if (!Number.isNaN(parsed)) return formatTime(parsed)
  return time
}

function CreditBar({ label, remain, size, unlimited, t }: {
  label: string
  remain: number
  size: number
  unlimited?: boolean | undefined
  t: TraePluginCardInjected['t']
}): React.ReactNode {
  if (unlimited === true) {
    const quotaText = t('unlimitedQuota')
    return (
      <div style={quotaGroupStyle}>
        <div style={quotaLabelStyle}>
          <span>{label}</span>
          <span>{quotaText}</span>
        </div>
        <div
          style={progressTrackStyle}
          role="progressbar"
          aria-label={label}
          aria-valuetext={quotaText}
        />
        <p style={bodyStyle}>{quotaText}</p>
      </div>
    )
  }
  const sizeKnown = size > 0
  const detail = sizeKnown
    ? t('exactRemaining', { remain: formatNumber(remain), size: formatNumber(size) })
    : t('creditPackageUnknownSize', { remain: formatNumber(remain) })
  const percent = sizeKnown ? (remain / size) * 100 : undefined
  const display = percent === undefined
    ? t('percentUnknown')
    : t('percentRemaining', {
      percent: new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(percent),
    })
  return (
    <div style={quotaGroupStyle}>
      <div style={quotaLabelStyle}>
        <span>{label}</span>
        <span>{display}</span>
      </div>
      <div
        style={progressTrackStyle}
        role="progressbar"
        aria-label={label}
        {...percent === undefined
          ? { 'aria-valuetext': detail }
          : { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent }}
      >
        {percent === undefined ? null : <div style={progressFillStyle(percent)} />}
      </div>
      <p style={bodyStyle}>{detail}</p>
    </div>
  )
}

function ModelOfferRow({ model, t }: {
  model: TraeWebModelBadge
  t: TraePluginCardInjected['t']
}): React.ReactNode {
  return (
    <div style={modelOfferStyle}>
      <div style={quotaLabelStyle}>
        <span>{model.name}</span>
        <span style={modelBadgeStyle}>
          {model.badges?.map(badge => (
            <span key={badge} style={modelBadgeChipStyle}>{modelBadgeLabel(badge, t)}</span>
          ))}
          {model.free === true ? <span style={modelBadgeChipStyle}>{t('freeModel')}</span> : null}
        </span>
      </div>
      {model.credits === undefined
        ? model.rateUnknown === true ? <span style={modelRateStyle}>{t('rateUnknown')}</span> : null
        : <span style={modelRateStyle}>{t('rate', { rate: model.credits })}</span>}
    </div>
  )
}

function ContextTable({ models, t, useMaximumContextWindow, disabled, onUseMaximumContextWindow }: {
  models: readonly TraeWebModelBadge[] | undefined
  t: TraePluginCardInjected['t']
  useMaximumContextWindow?: boolean
  disabled?: boolean
  onUseMaximumContextWindow?: (enabled: boolean) => void
}): React.ReactNode {
  const known = (models ?? [])
    .filter(model => model.contextWindow !== undefined)
    .sort((a, b) => (b.contextWindow as number) - (a.contextWindow as number))
  const showPreference = onUseMaximumContextWindow !== undefined
  if (known.length === 0 && !showPreference) return null
  return (
    <div style={quotaListStyle}>
      <h3 style={quotaTitleStyle}>{t('contextHeading')}</h3>
      {showPreference && onUseMaximumContextWindow !== undefined ? (
        <label style={contextPreferenceStyle}>
          <input
            type="checkbox"
            checked={useMaximumContextWindow === true}
            disabled={disabled}
            onChange={event => { onUseMaximumContextWindow(event.currentTarget.checked) }}
          />
          <span style={contextPreferenceCopyStyle}>
            <span>{t('useMaximumContextWindow')}</span>
            <span style={modelRateStyle}>{t('useMaximumContextWindowHint')}</span>
          </span>
        </label>
      ) : null}
      {known.map(model => {
        const capacity = model.contextWindow as number
        const alternative = model.maxContextWindow !== undefined && model.maxContextWindow > capacity
          ? model.maxContextWindow
          : undefined
        return (
          <div key={model.id} style={quotaLabelStyle}>
            <span>{model.name}</span>
            <span style={contextPickerRowStyle}>
              <span>{formatTokens(capacity)}</span>
              {alternative !== undefined
                ? <span style={modelRateStyle}>{t('contextUpTo', { size: formatTokens(alternative) })}</span>
                : model.defaultContextWindow !== undefined && model.defaultContextWindow < capacity
                  ? <span style={modelRateStyle}>{t('contextDefault', { size: formatTokens(model.defaultContextWindow) })}</span>
                  : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 1_000_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  return String(tokens)
}

function ModelTogglesSection({ models, disabledModels = [], t, disabled, onToggleModel, onSetDisabledModels }: {
  models: readonly TraeWebModelBadge[] | undefined
  disabledModels?: readonly string[] | undefined
  t: TraePluginCardInjected['t']
  disabled?: boolean
  onToggleModel: (modelId: string, enabled: boolean) => void
  onSetDisabledModels: (disabledIds: readonly string[]) => void
}): React.ReactNode {
  const [search, setSearch] = useState('')
  const disabledSet = new Set(disabledModels)
  const allModels = models ?? []
  const query = search.trim().toLowerCase()
  const filtered = query === ''
    ? allModels
    : allModels.filter(m => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))

  const enabledCount = allModels.filter(m => !disabledSet.has(m.id)).length
  const totalCount = allModels.length
  const filteredEnabledCount = filtered.filter(m => !disabledSet.has(m.id)).length
  const allFilteredEnabled = filtered.length > 0 && filteredEnabledCount === filtered.length
  const someFilteredEnabled = filteredEnabledCount > 0 && filteredEnabledCount < filtered.length

  const handleSelectAllCheckbox = (checked: boolean) => {
    if (checked) {
      const filteredIds = new Set(filtered.map(m => m.id))
      const nextDisabled = disabledModels.filter(id => !filteredIds.has(id))
      onSetDisabledModels(nextDisabled)
    } else {
      const nextDisabled = Array.from(new Set([...disabledModels, ...filtered.map(m => m.id)]))
      onSetDisabledModels(nextDisabled)
    }
  }

  const handleEnableAll = () => {
    const filteredIds = new Set(filtered.map(m => m.id))
    const nextDisabled = disabledModels.filter(id => !filteredIds.has(id))
    onSetDisabledModels(nextDisabled)
  }

  const handleDisableAll = () => {
    const nextDisabled = Array.from(new Set([...disabledModels, ...filtered.map(m => m.id)]))
    onSetDisabledModels(nextDisabled)
  }

  return (
    <div style={quotaListStyle}>
      <div style={rowStyle}>
        <span style={bodyStyle}>
          {t('modelsEnabledCount', { enabled: enabledCount, total: totalCount })}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            style={buttonStyle}
            disabled={disabled || filtered.length === 0}
            onClick={handleEnableAll}
          >
            {t('modelsEnableAll')}
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={disabled || filtered.length === 0}
            onClick={handleDisableAll}
          >
            {t('modelsDisableAll')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value) }}
          placeholder={t('modelsSearchPlaceholder')}
          style={{
            flex: 1,
            boxSizing: 'border-box',
            padding: '6px 12px',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 8,
            background: 'var(--dsw-alias-bg-layer-2)',
            color: 'var(--dsw-alias-label-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled || filtered.length === 0 ? 'default' : 'pointer', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' }}>
          <input
            type="checkbox"
            disabled={disabled || filtered.length === 0}
            checked={allFilteredEnabled}
            ref={el => {
              if (el) el.indeterminate = someFilteredEnabled
            }}
            onChange={e => { handleSelectAllCheckbox(e.currentTarget?.checked ?? e.target.checked) }}
          />
          <span>{t('modelsSelectAll')}</span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p style={bodyStyle}>{t('modelsNoMatch')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(model => {
            const isEnabled = !disabledSet.has(model.id)
            return (
              <div
                key={model.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l2)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }}>{model.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>({model.id})</span>
                    <span style={modelBadgeStyle}>
                      {model.badges?.map(badge => (
                        <span key={badge} style={modelBadgeChipStyle}>{modelBadgeLabel(badge, t)}</span>
                      ))}
                      {model.free === true ? <span style={modelBadgeChipStyle}>{t('freeModel')}</span> : null}
                    </span>
                  </div>
                  {model.credits !== undefined ? (
                    <span style={modelRateStyle}>{t('rate', { rate: model.credits })}</span>
                  ) : model.rateUnknown === true ? (
                    <span style={modelRateStyle}>{t('rateUnknown')}</span>
                  ) : null}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={disabled}
                    onChange={e => { onToggleModel(model.id, e.currentTarget?.checked ?? e.target.checked) }}
                  />
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProbeSection({ probe, t, onDetect, onClear, busy }: {
  probe: TraeWebProbeSection
  t: TraePluginCardInjected['t']
  onDetect: (modelId: string) => void
  onClear: () => void
  busy: boolean
}): React.ReactNode {
  const [pending, setPending] = useState<string>()
  const [runningModel, setRunningModel] = useState<string>()

  useEffect(() => {
    if (pending !== undefined && !probe.candidates.includes(pending)) setPending(undefined)
  }, [pending, probe.candidates])

  const runningArmed = useRef(false)
  useEffect(() => {
    if (runningModel === undefined) return
    if (busy || probe.running) {
      runningArmed.current = true
      return
    }
    if (!runningArmed.current) return
    runningArmed.current = false
    setRunningModel(undefined)
  }, [runningModel, busy, probe.running])

  return (
    <div style={quotaListStyle}>
      <h3 style={quotaTitleStyle}>{t('probeHeading')}</h3>
      <p style={bodyStyle}>{t('probeIntro')}</p>
      <p style={bodyStyle}>{t('probeConsentHint')}</p>
      {probe.running ? <p style={bodyStyle}>{t('probeRunningGeneric')}</p> : null}

      {probe.candidates.length === 0
        ? <p style={bodyStyle}>{t('probeResultEmpty')}</p>
        : (
          <div style={quotaGroupStyle}>
            {probe.candidates.map(id => {
              const result = probe.results.find(entry => entry.id === id)
              const name = result?.name ?? id
              return (
                <div key={id} style={modelOfferStyle}>
                  <div style={probeRowStyle}>
                    <span>{name}</span>
                    <span style={probeRowEndStyle}>
                      {result === undefined ? null : (
                        <span style={modelBadgeChipStyle}>
                          {result.validation === 'validating' && result.efforts.length > 0
                            ? result.efforts.join(' / ')
                            : t(result.validation === 'non-validating' ? 'probeResultNotValidating' : 'probeResultUnknown')}
                        </span>
                      )}
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={probe.running || busy}
                        onClick={() => { setPending(id) }}
                      >
                        {runningModel === id
                          ? t('probeRunning', { model: id })
                          : t(result === undefined ? 'probeStart' : 'probeRedetect')}
                      </button>
                    </span>
                  </div>
                  {result === undefined ? null
                    : <span style={modelRateStyle}>{t('probeResultAt', { time: formatTime(result.probedAt) })}</span>}

                  {pending === id ? (
                    <div style={confirmBoxStyle}>
                      <p style={bodyStyle}>{t('probeConfirmBody', { model: name })}</p>
                      <div style={confirmRowStyle}>
                        <button type="button" style={buttonStyle} onClick={() => { setPending(undefined) }}>
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          style={primaryButtonStyle}
                          disabled={probe.running || busy}
                          onClick={() => {
                            setRunningModel(id)
                            setPending(undefined)
                            onDetect(id)
                          }}
                        >
                          {t('probeConfirmAction')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

      {probe.results.length === 0 ? null : (
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => { onClear() }}>
          {t('probeClear')}
        </button>
      )}
    </div>
  )
}

function CheckInLogTable({
  logs = [],
  t,
  onCheckIn,
  onRefresh,
  onClear,
  busy,
  checkingIn,
  clearing,
  disabled,
  notice,
  nextRun,
}: {
  logs?: readonly {
    id: string
    date: string
    timestamp: number
    status: string
    amount?: number | undefined
    message?: string | undefined
  }[] | undefined
  t: TraePluginCardInjected['t']
  onCheckIn?: () => void
  onRefresh?: () => void
  onClear?: () => void
  busy?: boolean
  checkingIn?: boolean
  clearing?: boolean
  disabled?: boolean
  notice?: string | undefined
  nextRun?: number | undefined
}): React.ReactNode {
  return (
    <div style={quotaListStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={quotaTitleStyle}>{t('tabCheckIn')}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            style={buttonStyle}
            disabled={disabled || busy || checkingIn}
            onClick={onCheckIn}
          >
            {checkingIn ? t('checkInChecking') : t('checkInNow')}
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={busy || checkingIn}
            onClick={onRefresh}
          >
            {busy ? t('checkInRefreshing') : t('checkInRefresh')}
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={busy || clearing || !logs || logs.length === 0}
            onClick={onClear}
          >
            {clearing ? t('checkInClearing') : t('checkInClear')}
          </button>
        </div>
      </div>
      {notice === undefined ? null : (
        <div style={{
          marginTop: 8,
          marginBottom: 8,
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: '18px',
          background: notice.includes('成功') || notice.includes('已完成') || notice.includes('已自动签到')
            ? 'rgba(82, 196, 26, 0.12)'
            : notice.includes('无') || notice.includes('暂无')
              ? 'rgba(127, 127, 127, 0.12)'
              : 'rgba(255, 77, 79, 0.12)',
          border: '1px solid ' + (
            notice.includes('成功') || notice.includes('已完成') || notice.includes('已自动签到')
              ? 'rgba(82, 196, 26, 0.35)'
              : notice.includes('无') || notice.includes('暂无')
                ? 'rgba(127, 127, 127, 0.35)'
                : 'rgba(255, 77, 79, 0.35)'
          ),
          color: notice.includes('成功') || notice.includes('已完成') || notice.includes('已自动签到')
            ? 'var(--dsw-alias-status-success, #52c41a)'
            : notice.includes('无') || notice.includes('暂无')
              ? 'var(--dsw-alias-label-secondary, #888)'
              : 'var(--dsw-alias-status-error, #f5222d)',
        }}>
          {notice}
        </div>
      )}
      {nextRun === undefined ? null : (
        <p style={descriptionStyle}>{t('checkInNextRun', { time: formatTime(nextRun) })}</p>
      )}
      {!logs || logs.length === 0 ? (
        <p style={descriptionStyle}>{t('checkInLogEmpty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.15))', paddingBottom: 6, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>
            <span style={{ flex: 2 }}>{t('checkInLogTime')}</span>
            <span style={{ flex: 3 }}>{t('checkInLogResult')}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{t('checkInLogAmount')}</span>
          </div>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.08))' }}>
              <span style={{ flex: 2, color: 'var(--dsw-alias-label-secondary)' }}>{formatTime(log.timestamp)}</span>
              <span style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: log.status === 'claimed'
                    ? 'var(--dsw-alias-status-success, #52c41a)'
                    : log.status === 'already-claimed'
                      ? 'var(--dsw-alias-status-info, #1890ff)'
                      : log.status === 'no-campaign'
                        ? 'var(--dsw-alias-label-tertiary, #999)'
                        : 'var(--dsw-alias-status-error, #f5222d)',
                }} />
                <span>
                  {log.status === 'claimed'
                    ? t('autoCheckInStatusClaimed', { amount: log.amount ?? 100 })
                    : log.status === 'already-claimed'
                      ? t('autoCheckInStatusAlready')
                      : log.status === 'no-campaign'
                        ? t('autoCheckInStatusNoCampaign')
                        : t('autoCheckInStatusError', { message: log.message ?? '' })}
                </span>
              </span>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: log.amount ? 'var(--dsw-alias-brand-primary)' : 'inherit' }}>
                {log.amount ? `+${log.amount}` : '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TraePluginCard(props: TraePluginCardProps) {
  const { t, scope, signedIn, variant, unified } = props
  if (t === undefined) throw new Error('Trae plugin card requires its translation function')

  const isUnified = unified === true
  const liveSignIn = useSyncExternalStore(onQuotaSettingsChange, quotaSignInState)
  const [activeVariantId, setActiveVariantId] = useState<TraeVariantId>('trae')
  const currentVariant = isUnified
    ? (activeVariantId === 'trae' ? CN_CARD_VARIANT : AI_CARD_VARIANT)
    : (variant ?? CN_CARD_VARIANT)

  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [headerFocused, setHeaderFocused] = useState(false)
  const [status, setStatus] = useState<TraeWebStatus>()
  const [signedInState, setSignedInState] = useState<boolean>()
  const [readFailure, setReadFailure] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [signIn, setSignIn] = useState<{ state: string; url: string }>()
  const [signInError, setSignInError] = useState<string>()
  const [importNotice, setImportNotice] = useState<{ kind: 'done' | 'failed'; text: string }>()
  const importInput = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'status' | 'context' | 'models' | 'details' | 'checkin'>('status')
  const [checkingIn, setCheckingIn] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)
  const [checkInNotice, setCheckInNotice] = useState<string>()
  const mounted = useRef(true)
  const readSeq = useRef(0)
  const manualControllers = useRef(new Set<AbortController>())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const controller of manualControllers.current) controller.abort()
      manualControllers.current.clear()
    }
  }, [])

  const trackController = useCallback((): AbortController => {
    const controller = new AbortController()
    manualControllers.current.add(controller)
    return controller
  }, [])

  const actionKey = status === undefined || status.status === 'error' ? undefined : status.loginKey

  const refresh = useCallback(async (signal?: AbortSignal, force?: boolean): Promise<boolean> => {
    const seq = ++readSeq.current
    const current = (): boolean => mounted.current && signal?.aborted !== true && seq === readSeq.current
    try {
      const url = force ? `${currentVariant.statusPath}?refresh=1` : currentVariant.statusPath
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        ...signal === undefined ? {} : { signal },
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!isTraeWebStatus(value)) throw new Error(t('statusResponseInvalid'))
      if (!current()) return false
      setStatus(value)
      if (value.status === 'signed-in') {
        setSignedInState(true)
        noteQuotaStatus(currentVariant.id as TraeVariantId, value)
      } else if (value.status === 'signed-out') {
        setSignedInState(false)
        noteQuotaStatus(currentVariant.id as TraeVariantId, value)
      }
      setReadFailure(undefined)
      return true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('requestFailed')
      if (current()) {
        setReadFailure(message)
        setStatus(previous => previous === undefined ? { status: 'error', message } : previous)
      }
      return false
    }
  }, [currentVariant.statusPath, currentVariant.id, t])

  useEffect(() => {
    if (!open) return
    setStatus(undefined)
    setSignedInState(undefined)
    setReadFailure(undefined)
    setSignIn(undefined)
    setSignInError(undefined)
    setImportNotice(undefined)
    setCheckInNotice(undefined)
    setClearingLogs(false)
    const controller = new AbortController()
    void refresh(controller.signal, true)
    return () => { controller.abort() }
  }, [open, currentVariant.statusPath, refresh])

  useEffect(() => {
    if (!open || signedInState === false) return
    const controller = new AbortController()
    const timer = window.setInterval(() => { void refresh(controller.signal) }, POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [open, refresh, signedInState])

  const manualRefresh = async (): Promise<void> => {
    setBusy(true)
    const controller = trackController()
    try {
      await refresh(controller.signal, true)
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }

  const refreshModels = useCallback(async (): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setBusy(true)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'refresh' }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
      manualControllers.current.delete(controller)
      return
    } finally {
      if (mounted.current) setBusy(false)
    }
    try {
      await refresh(controller.signal)
    } finally {
      manualControllers.current.delete(controller)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  const control = useCallback(async (action: { action: 'probe'; model: string } | { action: 'clear' } | { action: 'set-maximum-context-window'; enabled: boolean } | { action: 'set-disabled-models'; disabledModels: readonly string[] }): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setBusy(true)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify(action),
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const message = typeof value === 'object' && value !== null && 'error' in value
          ? String((value as Record<string, unknown>)['error'])
          : `HTTP ${response.status}`
        throw new Error(message)
      }
      if (action.action === 'set-maximum-context-window') {
        const state = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['state'] : undefined
        if (state !== 'updated' && state !== 'saved') {
          const reason = typeof value === 'object' && value !== null && 'reason' in value
            ? String((value as Record<string, unknown>)['reason'])
            : (typeof value === 'object' && value !== null && 'error' in value ? String((value as Record<string, unknown>)['error']) : t('requestFailed'))
          throw new Error(reason)
        }
      }
      if (action.action === 'set-disabled-models') {
        const state = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['state'] : undefined
        if (state !== 'updated' && state !== 'saved') {
          const reason = typeof value === 'object' && value !== null && 'reason' in value
            ? String((value as Record<string, unknown>)['reason'])
            : (typeof value === 'object' && value !== null && 'error' in value ? String((value as Record<string, unknown>)['error']) : t('requestFailed'))
          throw new Error(reason)
        }
      }
      await refresh(controller.signal, true)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  const manualCheckIn = useCallback(async (): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setCheckingIn(true)
    setCheckInNotice(undefined)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'checkin' }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json() as { state?: string; amount?: number; reason?: string }
      if (result.state === 'claimed') {
        setCheckInNotice(t('autoCheckInStatusClaimed', { amount: result.amount ?? 150 }))
      } else if (result.state === 'already-claimed') {
        setCheckInNotice(t('autoCheckInStatusAlready'))
      } else if (result.state === 'no-campaign') {
        setCheckInNotice(result.reason ?? t('autoCheckInStatusNoCampaign'))
      } else if (result.reason) {
        setCheckInNotice(t('autoCheckInStatusError', { message: result.reason }))
      } else {
        setCheckInNotice(t('autoCheckInStatusError', { message: '签到未成功' }))
      }
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setCheckInNotice(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setCheckingIn(false)
    }
    try {
      await refresh(controller.signal)
    } finally {
      manualControllers.current.delete(controller)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  const clearCheckInLogs = useCallback(async (): Promise<void> => {
    const key = status?.status === 'signed-in' ? status.probeKey : undefined
    if (key === undefined) return
    setClearingLogs(true)
    setCheckInNotice(undefined)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.probePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Probe-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'clear-checkin-logs' }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setCheckInNotice(t('checkInClearSuccess'))
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setCheckInNotice(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setClearingLogs(false)
    }
    try {
      await refresh(controller.signal, true)
    } finally {
      manualControllers.current.delete(controller)
    }
  }, [currentVariant.probePath, refresh, status, t, trackController])

  const confirmDetect = useCallback((modelId: string): void => {
    void control({ action: 'probe', model: modelId })
  }, [control])

  const startAttempt = useCallback(async (key: string): Promise<void> => {
    setSignInError(undefined)
    setBusy(true)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Login-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'begin' }),
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
      const state = typeof record['state'] === 'string' ? record['state'] : ''
      const url = typeof record['url'] === 'string' ? record['url'] : ''
      if (state === '' || url === '') throw new Error(t('requestFailed'))
      setSignIn({ state, url })
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setSignInError(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }, [currentVariant.loginPath, t, trackController])

  const beginSignIn = useCallback(async (): Promise<void> => {
    const key = actionKey
    if (key === undefined) return
    await startAttempt(key)
  }, [actionKey, startAttempt])

  const signOut = useCallback(async (): Promise<void> => {
    if (status?.status !== 'signed-in' || status.loginKey === undefined) return
    const key = status.loginKey
    setBusy(true)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Login-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'logout' }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSignIn(undefined)
      const signedOutDoc: TraeWebStatus = { status: 'signed-out', loginKey: key }
      setStatus(signedOutDoc)
      setSignedInState(false)
      noteQuotaStatus(currentVariant.id as TraeVariantId, signedOutDoc)
      noteQuotaSignIn(currentVariant.id, false)
      await refresh(controller.signal)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }, [currentVariant.id, currentVariant.loginPath, refresh, status, t, trackController])

  const switchAccount = useCallback(async (): Promise<void> => {
    const key = actionKey
    if (key === undefined) return
    setBusy(true)
    setImportNotice(undefined)
    setSignInError(undefined)
    const controller = trackController()
    try {
      const response = await fetch(currentVariant.loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Login-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'logout' }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSignIn(undefined)
      const signedOutDoc: TraeWebStatus = { status: 'signed-out', loginKey: key }
      setStatus(signedOutDoc)
      setSignedInState(false)
      noteQuotaStatus(currentVariant.id as TraeVariantId, signedOutDoc)
      noteQuotaSignIn(currentVariant.id, false)
      await refresh(controller.signal)
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setReadFailure(error instanceof Error ? error.message : t('requestFailed'))
      }
      return
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
    await startAttempt(key)
  }, [actionKey, currentVariant.id, currentVariant.loginPath, refresh, startAttempt, t, trackController])

  useEffect(() => {
    if (signIn === undefined) return
    let cancelled = false
    const timer = setInterval(() => {
      void (async () => {
        const key = actionKey
        if (key === undefined) return
        try {
          const response = await fetch(currentVariant.loginPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Trae-Login-Key': key },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'poll', state: signIn.state }),
          })
          const value: unknown = await response.json().catch(() => undefined)
          if (cancelled || !mounted.current) return
          const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
          const outcome = record['status']
          if (outcome === 'complete') {
            setSignIn(undefined)
            setSignInError(undefined)
            noteQuotaSignIn(currentVariant.id, true)
            await refresh()
            return
          }
          if (outcome === 'failed') {
            setSignIn(undefined)
            setSignInError(typeof record['message'] === 'string' ? record['message'] : t('requestFailed'))
          }
        } catch {}
      })()
    }, 2_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [actionKey, currentVariant.id, currentVariant.loginPath, signIn, refresh, t])

  const importCredential = useCallback(async (file: File): Promise<void> => {
    if (status?.status !== 'signed-out' || status.loginKey === undefined) return
    const key = status.loginKey
    setImportNotice(undefined)
    setBusy(true)
    const controller = trackController()
    try {
      const document = await file.text()
      const response = await fetch(currentVariant.loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Login-Key': key },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action: 'import', document }),
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
      if (record['status'] === 'imported') {
        const account = typeof record['nickname'] === 'string' && record['nickname'] !== ''
          ? record['nickname']
          : typeof record['accountName'] === 'string' && record['accountName'] !== ''
            ? record['accountName']
            : typeof record['uid'] === 'string' && record['uid'] !== '' ? record['uid'] : ''
        setImportNotice({ kind: 'done', text: t('importDone', { account: account === '' ? '—' : account }) })
        noteQuotaSignIn(currentVariant.id, true)
        await refresh(controller.signal)
        return
      }
      setImportNotice({
        kind: 'failed',
        text: t('importFailed', {
          message: typeof record['message'] === 'string' ? record['message'] : t('requestFailed'),
        }),
      })
    } catch (error: unknown) {
      if (mounted.current && controller.signal.aborted !== true) {
        setImportNotice({
          kind: 'failed',
          text: t('importFailed', { message: error instanceof Error ? error.message : t('requestFailed') }),
        })
      }
    } finally {
      manualControllers.current.delete(controller)
      if (mounted.current) setBusy(false)
    }
  }, [currentVariant.id, currentVariant.loginPath, refresh, status, t, trackController])

  const cardTitle = isUnified ? t('unifiedTitle') : t(currentVariant.titleKey)
  const cardIntro = isUnified ? t('unifiedIntro') : t(currentVariant.introKey)

  const displayName = status?.status === 'signed-in' ? (status.nickname ?? status.accountName) : undefined
  const label = status === undefined
    ? t('loading')
    : status.status === 'signed-in'
      ? displayName === undefined ? t('signedInAs', { nickname: '' }).trimEnd().replace(/[:：]$/, '') : t('signedInAs', { nickname: displayName })
      : status.status === 'error'
        ? t('requestFailed')
        : t('signedOut')

  const reported = signedIn?.()
  const cnSignedIn = reported !== undefined ? reported.cn : liveSignIn.cn
  const aiSignedIn = reported !== undefined ? reported.ai : liveSignIn.ai
  const cnDotStatus: 'loading' | TraeWebStatus['status'] = isUnified && activeVariantId === 'trae'
    ? (status === undefined ? 'loading' : status.status)
    : (cnSignedIn ? 'signed-in' : 'signed-out')
  const aiDotStatus: 'loading' | TraeWebStatus['status'] = isUnified && activeVariantId === 'trae-ai'
    ? (status === undefined ? 'loading' : status.status)
    : (aiSignedIn ? 'signed-in' : 'signed-out')

  return (
    <li
      style={{ ...cardStyle, ...hovered ? cardHoverStyle : {}, ...open ? cardOpenStyle : {} }}
      onMouseEnter={() => { setHovered(true) }}
      onMouseLeave={() => { setHovered(false) }}
    >
      <button
        type="button"
        style={{ ...headerStyle, ...headerFocused ? headerFocusStyle : {} }}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${cardTitle}`}
        onClick={() => { setOpen(!open) }}
        onFocus={event => {
          let keyboard = true
          try {
            keyboard = event.currentTarget.matches(':focus-visible')
          } catch {
            keyboard = true
          }
          if (keyboard) setHeaderFocused(true)
        }}
        onBlur={() => { setHeaderFocused(false) }}
      >
        <span style={headTextStyle}>
          <span style={nameStyle}>{cardTitle}</span>
          <span style={descriptionStyle}>{cardIntro}</span>
        </span>
        <span style={{ ...chevronStyle, transform: open ? 'rotate(180deg)' : 'none' }}>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <div style={cardBodyStyle}>
          {isUnified ? (
            <>
              <QuotaSettingsContent t={t} scope={scope} signedIn={signedIn} />
              <div style={segmentedContainerStyle} role="tablist" aria-label="Trae Version Selection">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeVariantId === 'trae'}
                  style={segmentedTabItemStyle(activeVariantId === 'trae')}
                  onClick={() => setActiveVariantId('trae')}
                >
                  <span style={dotStyle(cnDotStatus)} aria-hidden="true" />
                  <span>{t('variantTabCN')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeVariantId === 'trae-ai'}
                  style={segmentedTabItemStyle(activeVariantId === 'trae-ai')}
                  onClick={() => setActiveVariantId('trae-ai')}
                >
                  <span style={dotStyle(aiDotStatus)} aria-hidden="true" />
                  <span>{t('variantTabAI')}</span>
                </button>
              </div>
            </>
          ) : null}
          <h3 style={quotaTitleStyle}>{t('accountHeading')}</h3>
          <div style={rowStyle}>
            <div style={statusStyle} role="status" aria-busy={status === undefined}>
              <span aria-hidden="true" style={dotStyle(status === undefined ? 'loading' : status.status)} />
              <span>{label}</span>
            </div>
            <button type="button" style={buttonStyle} disabled={busy} onClick={() => { void manualRefresh() }}>
              {busy ? t('refreshing') : t('refresh')}
            </button>
            {status?.status !== 'signed-in' || status.loginKey === undefined ? null : (
              <>
                <button type="button" style={buttonStyle} disabled={busy} onClick={() => { void switchAccount() }}>
                  {busy ? t('switchingAccount') : t('switchAccount')}
                </button>
                <button type="button" style={buttonStyle} disabled={busy} onClick={() => { void signOut() }}>
                  {busy ? t('signingOut') : t('signOut')}
                </button>
              </>
            )}
          </div>
          {readFailure === undefined || signedInState === undefined ? null : (
            <p style={errorStyle}>{t('statusRefreshFailed', { message: readFailure })}</p>
          )}
          {status?.status === 'signed-in' ? (
            <>
              {status.expiresAt === undefined ? null : (
                <p style={bodyStyle}>{t('accessTokenExpires', { time: formatTime(status.expiresAt) })}</p>
              )}
              {status.catalog === undefined ? null : (
                <div style={rowStyle}>
                  <span style={bodyStyle}>
                    {status.catalog.source === 'live' && status.catalog.fetchedAt !== undefined
                      ? t('catalogLive', { time: formatTime(status.catalog.fetchedAt) })
                      : status.catalog.source === 'saved' && status.catalog.fetchedAt !== undefined
                        ? t('catalogSaved', { time: formatTime(status.catalog.fetchedAt) })
                        : t('catalogFallback')}
                    {status.catalog.appVersion === undefined
                      ? ''
                      : ` · ${t('catalogAppVersion', { version: status.catalog.appVersion })}`}
                  </span>
                  <button type="button" style={buttonStyle} disabled={busy} onClick={() => { void refreshModels() }}>
                    {busy ? t('refreshingModels') : t('refreshModels')}
                  </button>
                </div>
              )}
              {status.catalog?.error === undefined ? null : (
                <p style={errorStyle}>{t('catalogError', { message: status.catalog.error })}</p>
              )}

              <div role="tablist" style={tabBarStyle}>
                {(['status', 'context', 'models', 'details', 'checkin'] as const).map(id => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => { setTab(id) }}
                    style={{ ...tabStyle, ...(tab === id ? tabActiveStyle : {}) }}
                  >
                    {t(id === 'status' ? 'tabStatus' : id === 'context' ? 'tabContext' : id === 'models' ? 'tabModels' : id === 'details' ? 'tabDetails' : 'tabCheckIn')}
                  </button>
                ))}
              </div>

              {tab === 'status' ? (
                <div style={tabPanelStyle}>
                  {status.credits === undefined ? null : (
                    <div style={quotaListStyle}>
                      <div style={rowStyle}>
                        <h3 style={quotaTitleStyle}>{t('creditsHeading')}</h3>
                        <span style={bodyStyle}>{status.credits.unlimited === true
                          ? t('creditsTotalUnlimited')
                          : t('creditsTotal', { total: formatNumber(status.credits.total) })}</span>
                      </div>
                      {status.credits.cycleResetTime === undefined ? null : (
                        <p style={descriptionStyle}>
                          {t('cycleResetAt', { time: formatCycleReset(status.credits.cycleResetTime) })}
                        </p>
                      )}
                    </div>
                  )}
                  {status.creditsError === undefined ? null : (
                    <p style={errorStyle}>{t('creditsError', { message: status.creditsError })}</p>
                  )}
                  {status.probe === undefined ? null : (
                    <ProbeSection
                      probe={status.probe}
                      t={t}
                      busy={busy}
                      onDetect={confirmDetect}
                      onClear={() => { void control({ action: 'clear' }) }}
                    />
                  )}
                </div>
              ) : tab === 'context' ? (
                <div style={tabPanelStyle}>
                  <ContextTable
                    models={status.models}
                    t={t}
                    disabled={busy}
                    {...status.useMaximumContextWindow === undefined ? {} : { useMaximumContextWindow: status.useMaximumContextWindow }}
                    onUseMaximumContextWindow={(enabled: boolean) => { void control({ action: 'set-maximum-context-window', enabled }) }}
                  />
                </div>
              ) : tab === 'models' ? (
                <div style={tabPanelStyle}>
                  <ModelTogglesSection
                    models={status.models}
                    disabledModels={status.disabledModels}
                    t={t}
                    disabled={busy}
                    onToggleModel={(modelId, enabled) => {
                      const currentDisabled = status.disabledModels ?? []
                      const nextDisabled = enabled
                        ? currentDisabled.filter(id => id !== modelId)
                        : [...currentDisabled.filter(id => id !== modelId), modelId]
                      void control({ action: 'set-disabled-models', disabledModels: nextDisabled })
                    }}
                    onSetDisabledModels={disabledIds => {
                      void control({ action: 'set-disabled-models', disabledModels: disabledIds })
                    }}
                  />
                </div>
              ) : tab === 'details' ? (
                <div style={tabPanelStyle}>
                  {status.credits === undefined ? null : (
                    <div style={quotaListStyle}>
                      <h3 style={quotaTitleStyle}>{t('creditsDetailHeading')}</h3>
                      {status.credits.accounts
                        .filter(account => account.packageName === 'enterprise' || account.remain > 0 || account.unlimited === true)
                        .map((account, index) => (
                        <CreditBar
                          key={`${account.packageName}-${String(index)}`}
                          label={account.packageName === 'enterprise' ? t('packageEnterprise') : account.packageName}
                          remain={account.remain}
                          size={account.size}
                          unlimited={account.unlimited}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                  {status.models === undefined || status.models.length === 0 ? null : (
                    <div style={quotaListStyle}>
                      <h3 style={quotaTitleStyle}>{t('modelsHeading')}</h3>
                      {status.models
                        .filter(model => model.free === true || (model.badges?.length ?? 0) > 0)
                        .map(model => <ModelOfferRow key={model.id} model={model} t={t} />)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={tabPanelStyle}>
                  <CheckInLogTable
                    logs={status.checkIn?.logs}
                    t={t}
                    disabled={busy}
                    busy={busy}
                    checkingIn={checkingIn}
                    clearing={clearingLogs}
                    {...checkInNotice === undefined ? {} : { notice: checkInNotice }}
                    {...status.checkIn?.nextRunAt === undefined ? {} : { nextRun: status.checkIn.nextRunAt }}
                    onCheckIn={() => { void manualCheckIn() }}
                    onRefresh={() => { void refresh() }}
                    onClear={() => { void clearCheckInLogs() }}
                  />
                </div>
              )}
            </>
          ) : null}

          {status?.status === 'signed-out' ? (
            <>
              <p style={status.reason === undefined ? bodyStyle : errorStyle}>
                {status.reason ?? t(currentVariant.signedOutKey)}
              </p>
              {status.loginKey === undefined ? null : (
                <div style={rowStyle}>
                  <button
                    type="button"
                    style={buttonStyle}
                    disabled={busy || signIn !== undefined}
                    onClick={() => { void beginSignIn() }}
                  >
                    {signIn === undefined ? t('signIn') : t('signingIn')}
                  </button>
                  {signIn === undefined ? null : (
                    <a href={signIn.url} target="_blank" rel="noopener noreferrer" style={bodyStyle}>
                      {t('signInOpenAgain')}
                    </a>
                  )}
                </div>
              )}
              {signIn === undefined ? null : <p style={bodyStyle}>{t('signInWaiting')}</p>}
              {signInError === undefined ? null : <p style={errorStyle}>{t('signInFailed', { message: signInError })}</p>}
              {status.loginKey === undefined ? null : (
                <div style={rowStyle}>
                  <span style={bodyStyle}>{t('importHeading')}</span>
                  <button
                    type="button"
                    style={buttonStyle}
                    disabled={busy || signIn !== undefined}
                    onClick={() => { importInput.current?.click() }}
                  >
                    {busy ? t('importing') : t('importAction')}
                  </button>
                  <input
                    ref={importInput}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                    onChange={event => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file !== undefined) void importCredential(file)
                    }}
                  />
                </div>
              )}
              {status.loginKey === undefined ? null : <p style={bodyStyle}>{t('importHint')}</p>}
              {importNotice === undefined ? null : (
                <p style={importNotice.kind === 'failed' ? errorStyle : bodyStyle}>{importNotice.text}</p>
              )}
            </>
          ) : null}
          {status?.status === 'error' ? <p style={errorStyle}>{status.message}</p> : null}
        </div>
      ) : null}
    </li>
  )
}
