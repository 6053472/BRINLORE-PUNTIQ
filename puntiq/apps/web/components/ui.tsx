'use client'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from './icons'
import { slug } from '../lib/format'

export function Modal({ title, eyebrow, subtitle, onClose, onSubmit, wide, children, actions }: {
  title: string
  eyebrow?: string
  subtitle?: string
  onClose: () => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  wide?: boolean
  children: ReactNode
  actions?: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  // Alleen bij openen/sluiten (niet bij elke render, anders springt de focus tijdens het typen).
  useEffect(() => {
    // Toetsenbordfocus naar binnen bij openen en terug naar de knop die het modal opende bij sluiten.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    const dialog = dialogs[dialogs.length - 1]
    if (dialog && !dialog.contains(document.activeElement)) (dialog.querySelector<HTMLElement>('.modal-body input, .modal-body select, .modal-body textarea') ?? dialog.querySelector<HTMLElement>('.modal-actions button, .icon-button'))?.focus({ preventScroll: true })
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  const Shell = onSubmit ? 'form' : 'div'
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <Shell className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit as never}>
        <div className="modal-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Sluiten" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </Shell>
    </div>
  )
}

export function PageHead({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function PanelHeading({ title, subtitle, link, onClick }: { title: string; subtitle?: string; link?: string; onClick?: () => void }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {link && <button type="button" className="link-button" onClick={onClick}>{link} <Icon name="arrow" size={14} /></button>}
    </div>
  )
}

export function Stat({ label, value, trend, icon, tone = 'navy' }: { label: string; value: string; trend?: string; icon: string; tone?: 'navy' | 'gold' | 'sage' | 'red' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon name={icon} size={20} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {trend && <small>{trend}</small>}
      </div>
    </div>
  )
}

export function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`status s-${slug(value)}`}>{label ?? value}</span>
}

export function EmptyState({ icon = 'folder', title, text, action }: { icon?: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {action}
    </div>
  )
}

/**
 * Paginering voor lange lijsten (het systeem is ontworpen voor duizenden woningen).
 * `resetKey` verandert bij zoeken/filteren/sorteren en brengt de lijst terug naar pagina 1.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey = '') {
  const key = `${resetKey}|${pageSize}`
  const [state, setState] = useState({ page: 1, key })
  const setPage = (page: number) => setState({ page, key })
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  // Een andere zoekopdracht/filter (andere sleutel) valt automatisch terug op pagina 1.
  const current = Math.min(state.key === key ? state.page : 1, pages)
  const slice = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize])
  return { slice, page: current, pages, setPage, total: items.length, pageSize }
}

export function Pagination({ pager, noun = 'resultaten' }: { pager: { page: number; pages: number; setPage: (page: number) => void; total: number; pageSize: number }; noun?: string }) {
  if (pager.total <= pager.pageSize) return null
  const from = (pager.page - 1) * pager.pageSize + 1
  const to = Math.min(pager.total, pager.page * pager.pageSize)
  return (
    <nav className="pagination" aria-label="Paginering">
      <span className="muted">{from.toLocaleString('nl-NL')}–{to.toLocaleString('nl-NL')} van {pager.total.toLocaleString('nl-NL')} {noun}</span>
      <div>
        <button type="button" className="button ghost small" disabled={pager.page === 1} onClick={() => pager.setPage(1)} aria-label="Eerste pagina">«</button>
        <button type="button" className="button ghost small" disabled={pager.page === 1} onClick={() => pager.setPage(pager.page - 1)}>Vorige</button>
        <span className="page-indicator" aria-current="page">Pagina {pager.page} van {pager.pages}</span>
        <button type="button" className="button ghost small" disabled={pager.page === pager.pages} onClick={() => pager.setPage(pager.page + 1)}>Volgende</button>
        <button type="button" className="button ghost small" disabled={pager.page === pager.pages} onClick={() => pager.setPage(pager.pages)} aria-label="Laatste pagina">»</button>
      </div>
    </nav>
  )
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function SettingRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  )
}
