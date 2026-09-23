/**
 * 模型选择器旁的推理档位探测交互控件。
 *
 * @module dsh-trae-connect/client/probe-control
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { CARD_VARIANTS, type TraeCardVariant, type TraePluginCardInjected } from './TraePluginCard.tsx'
import { isTraeWebStatus } from './status-document.ts'
import type { TraeWebProbeModel, TraeWebStatus } from '../status-paths.ts'

export interface TraeProbeControlProps extends TraePluginCardInjected {
  directory: ModelDirectory['store']
}

export function cardVariantFor(provider: string): TraeCardVariant | undefined {
  return CARD_VARIANTS.find(card => card.id === provider)
}

const RECONCILE_MS = 60_000

const wrapperStyle: CSSProperties = {
  display: 'inline-flex',
  position: 'relative',
  alignItems: 'center',
  transform: 'translateY(2px)',
  marginRight: -8,
}
const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  height: 30,
  padding: '0 6px',
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  font: 'inherit',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-tertiary)',
}

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 'calc(100% + 8px)',
  zIndex: 1000,
  transform: 'translateX(-50%)',
  padding: '4px 8px',
  borderRadius: 6,
  background: 'var(--dsw-specific-tip, #1f2329)',
  boxShadow: 'var(--dsw-shadow-lv2)',
  color: 'var(--dsw-alias-label-primary, #fff)',
  fontSize: 12,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}

const confirmStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 'calc(100% + 8px)',
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 260,
  padding: '10px 12px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  boxShadow: 'var(--dsw-shadow-lv2)',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 12,
  lineHeight: '18px',
}
const confirmRowStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8 }
const confirmButtonStyle: CSSProperties = {
  padding: '3px 10px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 6,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
}

const primaryButtonStyle: CSSProperties = {
  ...confirmButtonStyle,
  border: '1px solid var(--dsw-alias-button-primary-fill)',
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}

const noteStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 'calc(100% + 8px)',
  zIndex: 1001,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '6px 10px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1)',
  boxShadow: 'var(--dsw-shadow-lv2)',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 12,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
}

const noteDismissStyle: CSSProperties = {
  padding: '2px 8px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  font: 'inherit',
  fontSize: 12,
  lineHeight: '18px',
  cursor: 'pointer',
}

function useLabel(t: TraePluginCardInjected['t']): string {
  return t('probeLabel')
}

function resultFor(status: TraeWebStatus, model: string): TraeWebProbeModel | undefined {
  if (status.status !== 'signed-in') return undefined
  return status.probe?.results.find(result => result.id === model)
}

function tooltipText(
  t: TraePluginCardInjected['t'],
  model: string,
  state: { busy: boolean; failed: boolean; result?: TraeWebProbeModel | undefined },
): string {
  if (state.busy) return t('probeRunning', { model })
  const result = state.result
  if (result !== undefined) {
    if (result.validation === 'validating' && result.efforts.length > 0) {
      return t('probeTooltipVerified', { levels: result.efforts.join(' / ') })
    }
    if (result.validation === 'non-validating') return t('probeTooltipNotValidating')
    return t('probeTooltipRetry')
  }
  if (state.failed) return t('probeTooltipRetry')
  return t('probeTooltipIdle', { model })
}

export function TraeProbeControl({ directory, t }: TraeProbeControlProps) {
  const subscribe = useCallback((listener: () => void) => directory.subscribe(listener), [directory])
  const snapshot = useCallback(() => directory.getSnapshot(), [directory])
  const selection = useSyncExternalStore(subscribe, snapshot, snapshot).current
  const card = selection == null ? undefined : cardVariantFor(selection.provider)
  const key = card === undefined || selection == null ? undefined : `${card.id}:${selection.model}`

  return card === undefined || selection == null || key === undefined
    ? null
    : <ModelProbe key={key} model={selection.model} card={card} label={useLabel(t)} t={t} />
}

function ModelProbe({ model, card, label, t }: {
  model: string
  card: TraeCardVariant
  label: string
} & TraePluginCardInjected) {
  const [status, setStatus] = useState<TraeWebStatus>()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<TraeWebProbeModel>()
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const readSeq = useRef(0)
  const tooltipId = useId()

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const seq = ++readSeq.current
    const response = await fetch(card.statusPath, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      ...(signal === undefined ? {} : { signal }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const value: unknown = await response.json().catch(() => undefined)
    if (!isTraeWebStatus(value)) throw new Error(t('statusResponseInvalid'))
    if (mounted.current && !signal?.aborted && seq === readSeq.current) setStatus(value)
  }, [card.statusPath, t])

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    const load = (): void => {
      void refresh(controller.signal).catch(() => {})
    }
    load()
    const timer = window.setInterval(load, RECONCILE_MS)
    window.addEventListener('focus', load)
    return () => {
      mounted.current = false
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [refresh])

  const probe = status?.status === 'signed-in' ? status.probe : undefined
  const key = status?.status === 'signed-in' ? status.probeKey : undefined
  const result = status === undefined ? undefined : resultFor(status, model)
  const eligible = probe?.candidates.includes(model) === true
  const visible = eligible || result !== undefined

  useEffect(() => {
    if (result !== undefined) setFailed(false)
  }, [result])

  useEffect(() => {
    setConfirming(false)
    setNote(undefined)
  }, [model])

  const detect = async (): Promise<void> => {
    if (key === undefined || inFlight.current || probe?.running === true) return
    inFlight.current = true
    setNote(undefined)
    setConfirming(false)
    setBusy(true)
    setFailed(false)
    try {
      const response = await fetch(card.probePath, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Trae-Probe-Key': key },
        body: JSON.stringify({ action: 'probe', model }),
      })
      const body = await response.json() as {
        state?: string; validation?: string; efforts?: unknown
      }
      if (!response.ok || body.state !== 'ok'
        || (body.validation !== 'validating' && body.validation !== 'non-validating')
        || !Array.isArray(body.efforts) || !body.efforts.every(effort => typeof effort === 'string')) {
        throw new Error('probe failed')
      }
      if (mounted.current) {
        const completed: TraeWebProbeModel = {
          id: model, name: model, validation: body.validation,
          efforts: body.efforts, probedAt: Date.now(),
        }
        setNote(completed)
      }
      void refresh().catch(() => {})
    } catch {
      if (mounted.current) setFailed(true)
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  if (!visible) return null

  const text = tooltipText(t, model, { busy, result, failed })
  const disabled = busy || probe?.running === true || key === undefined
  const showTooltip = tooltipVisible && !confirming && note === undefined

  return (
    <span
      style={wrapperStyle}
      onMouseEnter={() => { setTooltipVisible(true) }}
      onMouseLeave={() => { setTooltipVisible(false) }}
    >
      <button
        type="button"
        aria-label={text}
        aria-describedby={showTooltip ? tooltipId : undefined}
        aria-busy={busy}
        aria-expanded={confirming}
        disabled={disabled}
        onClick={() => { setConfirming(true) }}
        onFocus={() => { setTooltipVisible(true) }}
        onBlur={() => { setTooltipVisible(false) }}
        style={{ ...buttonStyle, opacity: disabled && !confirming ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 12 20 4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
        <span style={labelStyle}>{label}</span>
      </button>

      {showTooltip && (
        <span id={tooltipId} role="tooltip" style={tooltipStyle}>{text}</span>
      )}

      {confirming && (
        <span style={confirmStyle}>
          <span>{t('probeBubbleBody')}</span>
          <span style={confirmRowStyle}>
            <button type="button" style={confirmButtonStyle} onClick={() => { setConfirming(false) }}>
              {t('cancel')}
            </button>
            <button type="button" style={primaryButtonStyle} onClick={() => { void detect() }}>
              {t('probeConfirmAction')}
            </button>
          </span>
        </span>
      )}

      {note === undefined ? null : (
        <span role="status" aria-live="polite" style={noteStyle}>
          <span>{noteText(t, note)}</span>
          <button
            type="button"
            style={noteDismissStyle}
            onClick={() => {
              setNote(undefined)
            }}
          >
            {t('probeNoteDismiss')}
          </button>
        </span>
      )}
    </span>
  )
}

function noteText(t: TraePluginCardInjected['t'], result: TraeWebProbeModel): string {
  if (result.validation === 'validating' && result.efforts.length > 0) {
    return t('probeNoteVerified', { levels: result.efforts.join(' / ') })
  }
  if (result.validation === 'non-validating') return t('probeNoteNotValidating')
  return t('probeNoteUnknown')
}
