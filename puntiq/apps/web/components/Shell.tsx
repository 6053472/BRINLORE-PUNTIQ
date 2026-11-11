'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { Dashboard } from './Dashboard'
import { PropertiesModule, PropertyDetail, PropertyModal } from './Properties'
import { ContractsModule, DocumentsModule, MaintenanceModule, TenantsModule } from './Resources'
import { FinanceModule } from './Finance'
import { WwsModal, WwsModule } from './Wws'
import { ProfilePanel, SettingsPanel } from './Account'
import { AdminOverview, AuditAdmin, SiteAdmin, UsersAdmin } from './Admin'
import { buildNotifications } from '../lib/notifications'
import type { ModuleId, Property } from '../lib/types'

const navItems: { id: ModuleId; icon: string; label: string }[] = [
  { id: 'dashboard', icon: 'home', label: 'Overzicht' },
  { id: 'properties', icon: 'building', label: 'Vastgoed' },
  { id: 'wws', icon: 'calc', label: 'WWS / WWSO' },
  { id: 'tenants', icon: 'users', label: 'Huurders' },
  { id: 'contracts', icon: 'file', label: 'Contracten' },
  { id: 'maintenance', icon: 'wrench', label: 'Onderhoud' },
  { id: 'documents', icon: 'folder', label: 'Documenten' },
  { id: 'finance', icon: 'euro', label: 'Financieel' },
]
const adminItems: { id: ModuleId; icon: string; label: string }[] = [
  { id: 'admin', icon: 'shield', label: 'Beheeroverzicht' },
  { id: 'users', icon: 'users', label: 'Gebruikers' },
  { id: 'audit', icon: 'file', label: 'Auditlog' },
  { id: 'site', icon: 'settings', label: 'Site-instellingen' },
]
const allModules = [...navItems.map(item => item.id), 'profile', 'settings'] as ModuleId[]
const adminModules = adminItems.map(item => item.id)
const titles: Record<string, string> = { profile: 'Profiel', settings: 'Instellingen', ...Object.fromEntries(adminItems.map(item => [item.id, item.label])) }
const READ_KEY = 'puntiq-read-notifications'

function readIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function Shell() {
  const { user, properties, records, logout } = useApp()
  const [active, setActive] = useState<ModuleId>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [popover, setPopover] = useState<'profile' | 'notifications' | 'search' | null>(null)
  const [query, setQuery] = useState('')
  const [readIdsState, setReadIds] = useState<string[]>([])
  const [modal, setModal] = useState<null | { type: 'property'; property?: Property } | { type: 'detail'; id: number } | { type: 'wws' }>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const isAdmin = user.role === 'admin'
  const [site, setSite] = useState<{ announcement: string; announcementTone: 'info' | 'warning' } | null>(null)

  const go = useCallback((id: ModuleId) => {
    setActive(id)
    setMenuOpen(false)
    setPopover(null)
    setQuery('')
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`)
    window.scrollTo({ top: 0 })
  }, [])

  // Navigatie via URL-hash: verversen en de terugknop werken zoals verwacht.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1) as ModuleId
      setActive(allModules.includes(hash) || (isAdmin && adminModules.includes(hash)) ? hash : (user.settings.landingPage as ModuleId))
    }
    // Pas na de eerste render lezen (hash en localStorage bestaan niet op de server).
    Promise.resolve().then(() => {
      fromHash()
      setReadIds(readIds())
      fetch('/api/site').then(response => (response.ok ? response.json() : null)).then(setSite).catch(() => undefined)
    })
    window.addEventListener('popstate', fromHash)
    return () => window.removeEventListener('popstate', fromHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((event.target as HTMLElement).tagName)
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        searchRef.current?.focus()
        setPopover('search')
      } else if (event.key === 'Escape') setPopover(null)
    }
    const onClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-popover]')) setPopover(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  const notifications = useMemo(
    () => buildNotifications({ contracts: records.contracts, maintenance: records.maintenance, payments: records.payments, properties, settings: user.settings }),
    [records, properties, user.settings],
  )
  const unread = notifications.filter(item => !readIdsState.includes(item.id))
  const markAllRead = () => {
    const ids = Array.from(new Set([...readIdsState, ...notifications.map(item => item.id)])).slice(-300)
    setReadIds(ids)
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(ids))
    } catch {
      // Negeren: alleen de gelezen-status gaat verloren.
    }
  }

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2) return []
    const hit = (...values: (string | undefined)[]) => values.some(value => value?.toLowerCase().includes(needle))
    return [
      ...properties.filter(p => hit(p.name, p.address)).map(p => ({ key: `p${p.id}`, label: p.name, sub: p.address, group: 'Vastgoed', module: 'properties' as ModuleId, property: p })),
      ...records.tenants.filter(t => hit(t.name, t.email, t.property)).map(t => ({ key: `t${t.id}`, label: t.name, sub: t.property ?? t.email ?? '', group: 'Huurders', module: 'tenants' as ModuleId, property: undefined })),
      ...records.contracts.filter(c => hit(c.tenant, c.property)).map(c => ({ key: `c${c.id}`, label: `${c.property} — ${c.tenant}`, sub: 'Contract', group: 'Contracten', module: 'contracts' as ModuleId, property: undefined })),
      ...records.maintenance.filter(m => hit(m.title, m.property)).map(m => ({ key: `m${m.id}`, label: m.title, sub: m.property, group: 'Onderhoud', module: 'maintenance' as ModuleId, property: undefined })),
      ...records.documents.filter(d => hit(d.name, d.property)).map(d => ({ key: `d${d.id}`, label: d.name, sub: d.category, group: 'Documenten', module: 'documents' as ModuleId, property: undefined })),
    ].slice(0, 12)
  }, [query, properties, records])

  const initials = (user.profile.firstName ? `${user.profile.firstName[0]}${user.profile.lastName[0] ?? ''}` : user.username.slice(0, 2)).toUpperCase()
  const avatar = user.avatar ? <img src={user.avatar} alt="" /> : initials
  const title = titles[active] ?? navItems.find(item => item.id === active)?.label ?? 'Overzicht'
  const workspace = user.profile.company || 'Mijn portefeuille'
  const openMaintenance = records.maintenance.filter(item => item.status !== 'Afgerond').length
  const detail = modal?.type === 'detail' ? properties.find(property => property.id === modal.id) : undefined
  const select = (property: Property) => setModal({ type: 'detail', id: property.id })

  return (
    <div className="app-shell">
      <a className="skip" href="#main">Naar inhoud</a>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/brinlore-puntiq-logo.png" alt="BRINLORE PUNTIQ" />
        </div>
        <div className="workspace">
          <span className="workspace-icon">{workspace[0].toUpperCase()}</span>
          <span><small>WERKRUIMTE</small><strong>{workspace}</strong></span>
        </div>
        <nav aria-label="Hoofdmenu">
          {navItems.map(item => (
            <button key={item.id} type="button" className={`nav-item ${active === item.id ? 'active' : ''}`} aria-current={active === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
              <Icon name={item.icon} />
              {item.label}
              {item.id === 'maintenance' && openMaintenance > 0 && <span className="nav-count">{openMaintenance}</span>}
            </button>
          ))}
        </nav>
        {isAdmin && (
          <nav aria-label="Beheer" className="admin-nav">
            <p className="nav-group">BEHEER</p>
            {adminItems.map(item => (
              <button key={item.id} type="button" className={`nav-item ${active === item.id ? 'active' : ''}`} aria-current={active === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>
        )}
        <div className="sidebar-bottom">
          <button type="button" className={`nav-item ${active === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Icon name="settings" /> Instellingen</button>
          <a className="nav-item" href="mailto:support@brinlore.com"><Icon name="help" /> Helpcentrum</a>
          <p className="sidebar-tagline">Ruimte voor vandaag.<br />Waarde voor morgen.</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button type="button" className="icon-button menu-button" aria-label="Menu openen" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumbs"><span>{workspace}</span><b>/</b><strong>{title}</strong></div>
          <div className="top-search" data-popover>
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              value={query}
              placeholder="Zoeken in alles…  ( / )"
              aria-label="Globaal zoeken"
              onFocus={() => setPopover('search')}
              onChange={event => { setQuery(event.target.value); setPopover('search') }}
            />
            {popover === 'search' && query.trim().length >= 2 && (
              <div className="popover search-results">
                {results.length === 0 ? <p className="muted pad">Geen resultaten voor “{query}”.</p> : results.map(result => (
                  <button key={result.key} type="button" onClick={() => { if (result.property) { go('properties'); select(result.property) } else go(result.module) }}>
                    <span><strong>{result.label}</strong><small>{result.sub}</small></span><em>{result.group}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="top-actions">
            <div className="popover-wrap" data-popover>
              <button type="button" className="icon-button bell" aria-label={`Meldingen${unread.length ? `, ${unread.length} ongelezen` : ''}`} aria-expanded={popover === 'notifications'} onClick={() => setPopover(popover === 'notifications' ? null : 'notifications')}>
                <Icon name="bell" />{unread.length > 0 && <em>{unread.length > 9 ? '9+' : unread.length}</em>}
              </button>
              {popover === 'notifications' && (
                <div className="popover notifications">
                  <div className="popover-head"><strong>Meldingen</strong>{unread.length > 0 && <button type="button" className="link-button" onClick={markAllRead}>Alles gelezen</button>}</div>
                  {notifications.length === 0 ? <p className="muted pad">Geen meldingen. U bent helemaal bij.</p> : notifications.slice(0, 8).map(item => (
                    <button type="button" key={item.id} className={readIdsState.includes(item.id) ? 'read' : ''} onClick={() => go(item.module)}>
                      <span className={`dot ${item.tone}`} />
                      <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                      <time>{item.when}</time>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="popover-wrap" data-popover>
              <button type="button" className="avatar-button" aria-label="Profielmenu" aria-expanded={popover === 'profile'} onClick={() => setPopover(popover === 'profile' ? null : 'profile')}>{avatar}</button>
              {popover === 'profile' && (
                <div className="popover profile-menu">
                  <div className="profile-menu-head">
                    <span className="avatar-button static">{avatar}</span>
                    <div><strong>{user.username}</strong><small>{user.email}</small></div>
                  </div>
                  <button type="button" onClick={() => go('profile')}><Icon name="user" size={16} /> Profiel</button>
                  <button type="button" onClick={() => go('settings')}><Icon name="settings" size={16} /> Instellingen</button>
                  <button type="button" className="menu-logout" onClick={() => logout()}><Icon name="logout" size={16} /> Uitloggen</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {site?.announcement && <div className={`announcement ${site.announcementTone}`} role="status"><Icon name={site.announcementTone === 'warning' ? 'alert' : 'bell'} size={16} /> {site.announcement}</div>}
        <main id="main" className="page-body">
          {active === 'dashboard' && <Dashboard onNavigate={go} onAdd={() => setModal({ type: 'property' })} onWws={() => setModal({ type: 'wws' })} onSelect={select} />}
          {active === 'properties' && <PropertiesModule onSelect={select} onAdd={() => setModal({ type: 'property' })} />}
          {active === 'wws' && <WwsModule onCalculate={() => setModal({ type: 'wws' })} />}
          {active === 'tenants' && <TenantsModule />}
          {active === 'contracts' && <ContractsModule />}
          {active === 'maintenance' && <MaintenanceModule />}
          {active === 'documents' && <DocumentsModule />}
          {active === 'finance' && <FinanceModule />}
          {active === 'profile' && <ProfilePanel />}
          {active === 'settings' && <SettingsPanel />}
          {isAdmin && active === 'admin' && <AdminOverview onNavigate={go} />}
          {isAdmin && active === 'users' && <UsersAdmin />}
          {isAdmin && active === 'audit' && <AuditAdmin />}
          {isAdmin && active === 'site' && <SiteAdmin />}
          <footer className="page-footer">© {new Date().getFullYear()} BRINLORE PUNTIQ · WWS-berekeningen zijn indicatief.</footer>
        </main>
      </section>

      {modal?.type === 'property' && <PropertyModal property={modal.property} onClose={() => setModal(null)} />}
      {modal?.type === 'detail' && detail && <PropertyDetail property={detail} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'property', property: detail })} />}
      {modal?.type === 'wws' && <WwsModal onClose={() => setModal(null)} />}
    </div>
  )
}
