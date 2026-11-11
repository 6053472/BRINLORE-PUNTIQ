'use client'

import { useEffect, type FormEvent, type ReactNode } from 'react'
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

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
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
