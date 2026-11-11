'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, PanelHeading, SettingRow, Stat, Status, Toggle } from './ui'
import { downloadCsv, formatBytes, formatDateTime } from '../lib/format'

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: (T & { error?: string }) | null; error?: string }> {
  try {
    const response = await fetch(url, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined })
    const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
    return { ok: response.ok, data, error: response.ok ? undefined : (data?.error ?? 'Er ging iets mis.') }
  } catch {
    return { ok: false, data: null, error: 'Geen verbinding met de server.' }
  }
}

function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const result = await api<T>(url)
    if (result.ok && result.data) {
      setData(result.data)
      setError('')
    } else setError(result.error ?? 'Laden mislukt.')
    setLoading(false)
  }, [url])
  useEffect(() => {
    Promise.resolve().then(reload)
  }, [reload])
  return { data, error, loading, reload }
}

// ---------- Overzicht ----------

type Stats = {
  users: number; admins: number; blocked: number; newThisWeek: number; activeThisWeek: number
  properties: number; records: number; databaseBytes: number; failedLogins24h: number
  recentUsers: { id: number; username: string; email: string; createdAt: string }[]
}

export function AdminOverview({ onNavigate }: { onNavigate: (id: 'users' | 'audit' | 'site') => void }) {
  const { data, error, loading } = useAdminData<Stats>('/api/admin/stats')
  return (
    <>
      <PageHead eyebrow="BEHEER" title="Beheeroverzicht" description="De gezondheid en het gebruik van het platform in één oogopslag." />
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="muted">Laden…</p>}
      {data && (
        <>
          <div className="stats-grid">
            <Stat label="Gebruikers" value={String(data.users)} trend={`${data.admins} beheerder${data.admins === 1 ? '' : 's'} · ${data.blocked} geblokkeerd`} icon="users" />
            <Stat label="Actief (7 dagen)" value={String(data.activeThisWeek)} trend={`${data.newThisWeek} nieuw deze week`} icon="check" tone="sage" />
            <Stat label="Woningen" value={String(data.properties)} trend={`${data.records} overige records`} icon="building" tone="gold" />
            <Stat label="Mislukte logins (24 u)" value={String(data.failedLogins24h)} trend={data.failedLogins24h > 10 ? 'Verhoogd, controleer het logboek' : 'Normaal'} icon="shield" tone={data.failedLogins24h > 10 ? 'red' : 'sage'} />
          </div>
          <div className="grid-main">
            <div className="panel">
              <PanelHeading title="Nieuwste gebruikers" subtitle="Recent geregistreerde accounts" link="Alle gebruikers" onClick={() => onNavigate('users')} />
              <div className="actions-list">
                {data.recentUsers.map(user => (
                  <div className="action static" key={user.id}>
                    <span className="action-icon info"><Icon name="user" size={17} /></span>
                    <div><strong>{user.username}</strong><p>{user.email}</p></div>
                    <time>{formatDateTime(user.createdAt).split(',')[0]}</time>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <PanelHeading title="Systeem" subtitle="Opslag en snelkoppelingen" />
              <div className="card">
                <SettingRow title="Databasegrootte" hint="SQLite-bestand met woningen en records.">{formatBytes(data.databaseBytes)}</SettingRow>
                <div className="button-row">
                  <button type="button" className="button ghost small" onClick={() => onNavigate('users')}>Gebruikers beheren</button>
                  <button type="button" className="button ghost small" onClick={() => onNavigate('audit')}>Auditlog</button>
                  <button type="button" className="button ghost small" onClick={() => onNavigate('site')}>Site-instellingen</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ---------- Gebruikers ----------

type AdminUser = { id: number; username: string; email: string; role: string; disabled: boolean; createdAt: string; lastLoginAt?: string; company?: string; properties: number; records: number }

function UserModal({ user, self, onClose, onChanged }: { user: AdminUser; self: boolean; onClose: () => void; onChanged: () => void }) {
  const { notify, confirm } = useApp()
  const [tempPassword, setTempPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (body: Record<string, unknown>, success: string) => {
    setBusy(true)
    const result = await api<{ password?: string }>(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    setBusy(false)
    if (!result.ok) return notify(result.error ?? 'Actie mislukt.', 'error')
    notify(success)
    if (result.data?.password) setTempPassword(result.data.password)
    onChanged()
  }

  const reset = async () => {
    if (await confirm(`Het wachtwoord van ${user.username} wordt vervangen door een tijdelijk wachtwoord en alle sessies worden beëindigd.`, 'Wachtwoord resetten')) await act({ resetPassword: true }, 'Wachtwoord gereset')
  }
  const remove = async () => {
    if (!(await confirm(`${user.username} en alle bijbehorende woningen, huurders, contracten en documenten worden definitief verwijderd.`, 'Gebruiker verwijderen'))) return
    const result = await api(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (!result.ok) return notify(result.error ?? 'Verwijderen mislukt.', 'error')
    notify('Gebruiker verwijderd')
    onChanged()
    onClose()
  }

  return (
    <Modal eyebrow="GEBRUIKERSBEHEER" title={user.username} subtitle={user.email} onClose={onClose} actions={<button type="button" className="button" onClick={onClose}>Sluiten</button>}>
      <dl className="facts">
        <div><dt>Rol</dt><dd>{user.role === 'admin' ? 'Beheerder' : 'Gebruiker'}</dd></div>
        <div><dt>Status</dt><dd>{user.disabled ? 'Geblokkeerd' : 'Actief'}</dd></div>
        <div><dt>Bedrijf</dt><dd>{user.company || '—'}</dd></div>
        <div><dt>Woningen</dt><dd>{user.properties}</dd></div>
        <div><dt>Overige records</dt><dd>{user.records}</dd></div>
        <div><dt>Laatst ingelogd</dt><dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nooit'}</dd></div>
      </dl>
      {self && <p className="muted">Dit is uw eigen account: rol wijzigen, blokkeren en verwijderen is uitgeschakeld.</p>}
      <SettingRow title="Beheerdersrechten" hint="Beheerders hebben toegang tot alle beheerpagina's.">
        <Toggle label="Beheerder" on={user.role === 'admin'} onChange={value => !self && !busy && act({ role: value ? 'admin' : 'user' }, value ? 'Gebruiker is nu beheerder' : 'Beheerdersrechten ingetrokken')} />
      </SettingRow>
      <SettingRow title="Account geblokkeerd" hint="Geblokkeerde gebruikers kunnen niet meer inloggen en worden direct uitgelogd.">
        <Toggle label="Geblokkeerd" on={user.disabled} onChange={value => !self && !busy && act({ disabled: value }, value ? 'Account geblokkeerd' : 'Account gedeblokkeerd')} />
      </SettingRow>
      {tempPassword && (
        <div className="temp-password" role="status">
          <small>Tijdelijk wachtwoord, deel dit veilig en toon het maar één keer:</small>
          <code>{tempPassword}</code>
          <button type="button" className="button ghost small" onClick={() => navigator.clipboard?.writeText(tempPassword).then(() => notify('Gekopieerd'))}>Kopiëren</button>
        </div>
      )}
      <div className="button-row">
        <button type="button" className="button ghost" disabled={busy} onClick={reset}><Icon name="lock" size={16} /> Wachtwoord resetten</button>
        <button type="button" className="button ghost" disabled={busy} onClick={() => act({ revokeSessions: true }, 'Gebruiker overal uitgelogd')}><Icon name="logout" size={16} /> Overal uitloggen</button>
        {!self && <button type="button" className="button danger ghost" disabled={busy} onClick={remove}><Icon name="trash" size={16} /> Verwijderen</button>}
      </div>
    </Modal>
  )
}

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { notify } = useApp()
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const generate = () => {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(14))
    setForm(current => ({ ...current, password: `${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}7` }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const result = await api('/api/admin/users', { method: 'POST', body: JSON.stringify(form) })
    setBusy(false)
    if (!result.ok) return setError(result.error ?? 'Aanmaken mislukt.')
    notify('Gebruiker aangemaakt')
    onCreated()
    onClose()
  }

  return (
    <Modal eyebrow="GEBRUIKERSBEHEER" title="Nieuwe gebruiker" onClose={onClose} onSubmit={submit}
      actions={<><button type="button" className="button ghost" onClick={onClose}>Annuleren</button><button className="button" disabled={busy}>Aanmaken</button></>}>
      <div className="form-grid">
        <label>Gebruikersnaam *<input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} required minLength={3} autoComplete="off" /></label>
        <label>E-mailadres *<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required autoComplete="off" /></label>
        <label>Wachtwoord *
          <input value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required minLength={8} autoComplete="off" />
        </label>
        <label>Rol
          <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="user">Gebruiker</option><option value="admin">Beheerder</option></select>
        </label>
        <div className="wide-field"><button type="button" className="button ghost small" onClick={generate}>Sterk wachtwoord genereren</button></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  )
}

export function UsersAdmin() {
  const { user: me } = useApp()
  const { data, error, loading, reload } = useAdminData<{ users: AdminUser[] }>('/api/admin/users')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const users = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.users ?? []).filter(user => (!role || (role === 'Geblokkeerd' ? user.disabled : user.role === role)) && (!needle || `${user.username} ${user.email} ${user.company ?? ''}`.toLowerCase().includes(needle)))
  }, [data, query, role])
  const selected = data?.users.find(user => user.id === selectedId)

  return (
    <>
      <PageHead eyebrow="BEHEER" title="Gebruikers" description="Beheer accounts, rollen en toegang.">
        <button type="button" className="button" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Nieuwe gebruiker</button>
      </PageHead>
      <div className="panel">
        <div className="table-tools">
          <div className="search"><Icon name="search" size={16} /><input aria-label="Zoek gebruikers" placeholder="Zoek op naam, e-mail of bedrijf…" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <select className="filter-select" aria-label="Filter" value={role} onChange={event => setRole(event.target.value)}>
            <option value="">Alle gebruikers</option><option value="admin">Beheerders</option><option value="user">Gebruikers</option><option>Geblokkeerd</option>
          </select>
          <button type="button" className="button ghost small" disabled={!users.length} onClick={() => downloadCsv('gebruikers.csv', [['Gebruikersnaam', 'E-mail', 'Rol', 'Geblokkeerd', 'Woningen', 'Aangemaakt', 'Laatst ingelogd'], ...users.map(user => [user.username, user.email, user.role, user.disabled ? 'Ja' : 'Nee', user.properties, user.createdAt, user.lastLoginAt])])}><Icon name="download" size={15} /> Exporteren</button>
        </div>
        {error && <p className="form-error pad" role="alert">{error}</p>}
        {loading ? <p className="muted pad">Laden…</p> : users.length === 0 ? <EmptyState icon="users" title="Geen gebruikers gevonden" text="Pas uw zoekopdracht of filter aan." /> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Gebruiker</th><th>Rol</th><th>Status</th><th>Woningen</th><th>Aangemaakt</th><th>Laatst ingelogd</th></tr></thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="clickable" tabIndex={0} onClick={() => setSelectedId(user.id)} onKeyDown={event => event.key === 'Enter' && setSelectedId(user.id)}>
                    <td><strong>{user.username}{user.id === me.id && ' (u)'}</strong><span className="sub">{user.email}</span></td>
                    <td><Status value={user.role === 'admin' ? 'Beheerder' : 'Gebruiker'} /></td>
                    <td><Status value={user.disabled ? 'Geblokkeerd' : 'Actief'} /></td>
                    <td>{user.properties}</td>
                    <td>{formatDateTime(user.createdAt).split(',')[0]}</td>
                    <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nooit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <UserModal key={selected.id} user={selected} self={selected.id === me.id} onClose={() => setSelectedId(null)} onChanged={reload} />}
      {creating && <NewUserModal onClose={() => setCreating(false)} onCreated={reload} />}
    </>
  )
}

// ---------- Auditlog ----------

type AuditEntry = { id: number; at: string; actor: string; action: string; target: string; detail: string }

const actionLabels: Record<string, string> = {
  login: 'Ingelogd', 'login.admin': 'Ingelogd als beheerder', 'login.failed': 'Mislukte login', 'login.blocked': 'Login geblokkeerd', 'login.denied': 'Beheerderslogin geweigerd',
  'user.register': 'Geregistreerd', 'user.password': 'Wachtwoord gewijzigd', 'user.self-delete': 'Account verwijderd',
  'admin.user.create': 'Gebruiker aangemaakt', 'admin.user.role': 'Rol gewijzigd', 'admin.user.block': 'Gebruiker geblokkeerd', 'admin.user.unblock': 'Gebruiker gedeblokkeerd',
  'admin.user.reset-password': 'Wachtwoord gereset', 'admin.user.logout': 'Gebruiker uitgelogd', 'admin.user.delete': 'Gebruiker verwijderd', 'admin.site': 'Site-instellingen gewijzigd',
}
const tone = (action: string) => (/failed|denied|blocked|block$|delete/.test(action) ? 'bad' : action.startsWith('admin.') ? 'warn' : 'neutral')

export function AuditAdmin() {
  const { data, error, loading, reload } = useAdminData<{ entries: AuditEntry[] }>('/api/admin/audit')
  const [query, setQuery] = useState('')
  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.entries ?? []).filter(entry => !needle || `${entry.actor} ${entry.target} ${entry.detail} ${actionLabels[entry.action] ?? entry.action}`.toLowerCase().includes(needle))
  }, [data, query])

  return (
    <>
      <PageHead eyebrow="BEHEER" title="Auditlog" description="Wie deed wat en wanneer: logins, beheeracties en accountwijzigingen (laatste 300 regels).">
        <button type="button" className="button ghost" onClick={reload}>Vernieuwen</button>
        <button type="button" className="button ghost" disabled={!entries.length} onClick={() => downloadCsv('auditlog.csv', [['Tijd', 'Gebruiker', 'Actie', 'Doel', 'Details'], ...entries.map(entry => [entry.at, entry.actor, actionLabels[entry.action] ?? entry.action, entry.target, entry.detail])])}><Icon name="download" size={15} /> Exporteren</button>
      </PageHead>
      <div className="panel">
        <div className="table-tools"><div className="search"><Icon name="search" size={16} /><input aria-label="Zoek in logboek" placeholder="Zoek op gebruiker, actie of doel…" value={query} onChange={event => setQuery(event.target.value)} /></div></div>
        {error && <p className="form-error pad" role="alert">{error}</p>}
        {loading ? <p className="muted pad">Laden…</p> : entries.length === 0 ? <EmptyState icon="shield" title="Geen logregels" text="Er zijn nog geen gebeurtenissen vastgelegd." /> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Tijd</th><th>Gebruiker</th><th>Actie</th><th>Doel</th><th>Details</th></tr></thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id}>
                    <td className="nowrap">{formatDateTime(entry.at)}</td>
                    <td><strong>{entry.actor}</strong></td>
                    <td><span className={`status tone-${tone(entry.action)}`}>{actionLabels[entry.action] ?? entry.action}</span></td>
                    <td>{entry.target || '—'}</td>
                    <td className="muted">{entry.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ---------- Site-instellingen ----------

type Site = { registrationOpen: boolean; maintenance: boolean; maintenanceMessage: string; announcement: string; announcementTone: 'info' | 'warning' }

export function SiteAdmin() {
  const { notify, confirm } = useApp()
  const { data, error, loading } = useAdminData<{ site: Site }>('/api/admin/site')
  const [site, setSite] = useState<Site | null>(null)
  const current = site ?? data?.site ?? null

  const save = async (patch: Partial<Site>, message = 'Instellingen opgeslagen') => {
    const result = await api<{ site: Site }>('/api/admin/site', { method: 'PUT', body: JSON.stringify(patch) })
    if (!result.ok || !result.data) return notify(result.error ?? 'Opslaan mislukt.', 'error')
    setSite(result.data.site)
    notify(message)
  }

  const toggleMaintenance = async (value: boolean) => {
    if (value && !(await confirm('Alle gebruikers zonder beheerdersrechten worden direct buitengesloten tot u de onderhoudsmodus uitzet.', 'Onderhoudsmodus aanzetten'))) return
    await save({ maintenance: value }, value ? 'Onderhoudsmodus staat aan' : 'Onderhoudsmodus uitgezet')
  }

  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)

  return (
    <>
      <PageHead eyebrow="BEHEER" title="Site-instellingen" description="Bepaal wie zich kan registreren en communiceer met uw gebruikers." />
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="muted">Laden…</p>}
      {current && (
        <div className="stack">
          <section className="panel card">
            <div className="card-head"><span className="card-icon"><Icon name="users" size={19} /></span><div><h2>Toegang</h2><p className="muted">Registratie en onderhoud.</p></div></div>
            <SettingRow title="Nieuwe registraties toestaan" hint="Uitzetten sluit de registratiepagina; beheerders kunnen nog steeds gebruikers aanmaken.">
              <Toggle label="Registratie open" on={current.registrationOpen} onChange={value => save({ registrationOpen: value })} />
            </SettingRow>
            <SettingRow title="Onderhoudsmodus" hint="Alleen beheerders kunnen inloggen of verder werken.">
              <Toggle label="Onderhoudsmodus" on={current.maintenance} onChange={toggleMaintenance} />
            </SettingRow>
            <label>Bericht tijdens onderhoud
              <input value={maintenanceMessage ?? current.maintenanceMessage} onChange={event => setMaintenanceMessage(event.target.value)} maxLength={300} placeholder="bijv. We zijn om 14:00 weer beschikbaar." />
            </label>
            <div className="form-actions"><button type="button" className="button small" disabled={maintenanceMessage === null} onClick={() => save({ maintenanceMessage: maintenanceMessage ?? '' }).then(() => setMaintenanceMessage(null))}>Bericht opslaan</button></div>
          </section>
          <section className="panel card">
            <div className="card-head"><span className="card-icon"><Icon name="bell" size={19} /></span><div><h2>Aankondiging</h2><p className="muted">Wordt als balk bovenaan getoond aan alle ingelogde gebruikers.</p></div></div>
            <label>Tekst (leeg = geen aankondiging)
              <textarea rows={2} maxLength={300} value={announcement ?? current.announcement} onChange={event => setAnnouncement(event.target.value)} placeholder="bijv. Op zondag 22:00–23:00 plannen we onderhoud." />
            </label>
            <SettingRow title="Type" hint="Waarschuwingen vallen meer op.">
              <select value={current.announcementTone} onChange={event => save({ announcementTone: event.target.value as Site['announcementTone'] })}><option value="info">Informatie</option><option value="warning">Waarschuwing</option></select>
            </SettingRow>
            <div className="form-actions">
              {current.announcement && <button type="button" className="button ghost small" onClick={() => save({ announcement: '' }, 'Aankondiging verwijderd').then(() => setAnnouncement(null))}>Verwijderen</button>}
              <button type="button" className="button small" disabled={announcement === null} onClick={() => save({ announcement: announcement ?? '' }, 'Aankondiging gepubliceerd').then(() => setAnnouncement(null))}>Publiceren</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
