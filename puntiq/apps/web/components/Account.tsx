'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { PageHead, SettingRow, Toggle } from './ui'
import { formatDateTime, resizeImage } from '../lib/format'
import type { UserProfile, UserSettings } from '../lib/types'

function Card({ icon, title, text, children }: { icon: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="panel card">
      <div className="card-head">
        <span className="card-icon"><Icon name={icon} size={19} /></span>
        <div><h2>{title}</h2><p className="muted">{text}</p></div>
      </div>
      {children}
    </section>
  )
}

function Feedback({ result }: { result: { ok: boolean; text: string } | null }) {
  return result ? <p className={result.ok ? 'form-success' : 'form-error'} role="status">{result.text}</p> : null
}

export function ProfilePanel() {
  const { user, updateAccount, notify } = useApp()
  const [account, setAccount] = useState({ username: user.username, email: user.email })
  const [profile, setProfile] = useState<UserProfile>(user.profile)
  const [accountResult, setAccountResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [profileResult, setProfileResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const chooseAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('Kies een afbeelding (JPG, PNG of WEBP).', 'error')
    try {
      const avatar = await resizeImage(file, 320)
      const error = await updateAccount({ avatar })
      notify(error ?? 'Profielfoto bijgewerkt', error ? 'error' : 'ok')
    } catch {
      notify('Afbeelding kon niet worden verwerkt.', 'error')
    }
  }

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const error = await updateAccount(account)
    setAccountResult({ ok: !error, text: error ?? 'Accountgegevens opgeslagen.' })
    setBusy(false)
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const error = await updateAccount({ profile })
    setProfileResult({ ok: !error, text: error ?? 'Profiel opgeslagen.' })
    setBusy(false)
  }

  const field = (key: keyof UserProfile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input value={profile[key]} onChange={event => setProfile(current => ({ ...current, [key]: event.target.value }))} {...props} /></label>
  )
  const initials = (profile.firstName ? `${profile.firstName[0]}${profile.lastName[0] ?? ''}` : user.username.slice(0, 2)).toUpperCase()

  return (
    <>
      <PageHead eyebrow="MIJN ACCOUNT" title="Profiel" description="Beheer uw persoonlijke gegevens, bedrijfsgegevens en profielfoto." />
      <div className="profile-layout">
        <section className="panel profile-photo-card">
          {user.avatar ? <img className="profile-photo" src={user.avatar} alt="Profielfoto" /> : <div className="profile-photo fallback">{initials}</div>}
          <h2>{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || user.username}</h2>
          <p className="muted">{profile.jobTitle || (user.role === 'admin' ? 'Beheerder' : 'Vastgoedbeheerder')}{profile.company && ` · ${profile.company}`}</p>
          <label className="button ghost small">Foto wijzigen<input type="file" accept="image/*" onChange={chooseAvatar} hidden /></label>
          {user.avatar && <button type="button" className="link-button" onClick={async () => notify((await updateAccount({ avatar: '' })) ?? 'Profielfoto verwijderd')}>Foto verwijderen</button>}
          <dl className="meta">
            <div><dt>Lid sinds</dt><dd>{formatDateTime(user.createdAt).split(',')[0]}</dd></div>
            <div><dt>Laatst ingelogd</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
          </dl>
        </section>
        <div className="stack">
          <Card icon="user" title="Persoonlijke gegevens" text="Uw naam en contactgegevens.">
            <form className="form-grid" onSubmit={saveProfile}>
              {field('firstName', 'Voornaam', { autoComplete: 'given-name' })}
              {field('lastName', 'Achternaam', { autoComplete: 'family-name' })}
              {field('phone', 'Telefoonnummer', { type: 'tel', autoComplete: 'tel' })}
              {field('jobTitle', 'Functie')}
              <div className="wide-field form-actions"><Feedback result={profileResult} /><button className="button" disabled={busy}>Opslaan</button></div>
            </form>
          </Card>
          <Card icon="building" title="Bedrijfsgegevens" text="Worden gebruikt voor facturen en contracten.">
            <form className="form-grid" onSubmit={saveProfile}>
              {field('company', 'Bedrijfsnaam', { autoComplete: 'organization' })}
              {field('kvk', 'KvK-nummer', { inputMode: 'numeric', maxLength: 8 })}
              {field('btw', 'BTW-nummer', { placeholder: 'NL000000000B01' })}
              {field('iban', 'IBAN', { placeholder: 'NL00 BANK 0000 0000 00' })}
              <label className="wide-field">Adres<input value={profile.address} onChange={event => setProfile(current => ({ ...current, address: event.target.value }))} autoComplete="street-address" /></label>
              {field('postcode', 'Postcode', { autoComplete: 'postal-code' })}
              {field('city', 'Plaats', { autoComplete: 'address-level2' })}
              <div className="wide-field form-actions"><button className="button" disabled={busy}>Opslaan</button></div>
            </form>
          </Card>
          <Card icon="lock" title="Inloggegevens" text="Gebruikersnaam en e-mailadres voor uw account.">
            <form className="form-grid" onSubmit={saveAccount}>
              <label>Gebruikersnaam<input value={account.username} onChange={event => setAccount(current => ({ ...current, username: event.target.value }))} required autoComplete="username" /></label>
              <label>E-mailadres<input type="email" value={account.email} onChange={event => setAccount(current => ({ ...current, email: event.target.value }))} required autoComplete="email" /></label>
              <div className="wide-field form-actions"><Feedback result={accountResult} /><button className="button" disabled={busy}>Opslaan</button></div>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}

type Tab = 'display' | 'notifications' | 'work' | 'security' | 'privacy'
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'display', label: 'Weergave', icon: 'sun' },
  { id: 'notifications', label: 'Meldingen', icon: 'bell' },
  { id: 'work', label: 'Werkwijze', icon: 'settings' },
  { id: 'security', label: 'Beveiliging', icon: 'lock' },
  { id: 'privacy', label: 'Gegevens & privacy', icon: 'shield' },
]

export function SettingsPanel() {
  const { user, updateAccount, notify, confirm, logout } = useApp()
  const [tab, setTab] = useState<Tab>('display')
  const s = user.settings

  const set = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const error = await updateAccount({ settings: { [key]: value } })
    if (error) notify(error, 'error')
  }

  const [passwords, setPasswords] = useState({ current: '', next: '', repeat: '' })
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; text: string } | null>(null)
  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (passwords.next !== passwords.repeat) return setPasswordResult({ ok: false, text: 'De nieuwe wachtwoorden komen niet overeen.' })
    const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }) })
    const data = await response.json().catch(() => null)
    setPasswordResult({ ok: response.ok, text: response.ok ? 'Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.' : (data?.error ?? 'Wijzigen mislukt.') })
    if (response.ok) setPasswords({ current: '', next: '', repeat: '' })
  }

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!(await confirm('Uw account en alle bijbehorende gegevens worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.', 'Account verwijderen'))) return
    const response = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: deletePassword }) })
    if (response.ok) window.location.href = '/login'
    else setDeleteError((await response.json().catch(() => null))?.error ?? 'Verwijderen mislukt.')
  }

  return (
    <>
      <PageHead eyebrow="VOORKEUREN" title="Instellingen" description="Pas PUNTIQ aan op uw manier van werken." />
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Instellingen">
          {tabs.map(item => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} aria-current={tab === item.id} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size={17} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="stack">
          {tab === 'display' && (
            <Card icon="sun" title="Weergave" text="Maak de interface comfortabeler.">
              <SettingRow title="Thema" hint="Licht, donker of volg uw apparaat.">
                <div className="segmented" role="group" aria-label="Thema">
                  {(['light', 'dark', 'system'] as const).map(theme => (
                    <button key={theme} type="button" aria-pressed={s.theme === theme} onClick={() => set('theme', theme)}>{theme === 'light' ? 'Licht' : theme === 'dark' ? 'Donker' : 'Systeem'}</button>
                  ))}
                </div>
              </SettingRow>
              <SettingRow title="Compacte weergave" hint="Minder witruimte, meer informatie in beeld."><Toggle label="Compacte weergave" on={s.compact} onChange={value => set('compact', value)} /></SettingRow>
              <SettingRow title="Minder beweging" hint="Beperk animaties en overgangen."><Toggle label="Minder beweging" on={s.reducedMotion} onChange={value => set('reducedMotion', value)} /></SettingRow>
              <SettingRow title="Startpagina" hint="Waar u na het inloggen terechtkomt.">
                <select value={s.landingPage} onChange={event => set('landingPage', event.target.value)}>
                  {[['dashboard', 'Overzicht'], ['properties', 'Vastgoed'], ['tenants', 'Huurders'], ['contracts', 'Contracten'], ['maintenance', 'Onderhoud'], ['finance', 'Financieel']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </SettingRow>
            </Card>
          )}
          {tab === 'notifications' && (
            <Card icon="bell" title="Meldingen" text="Bepaal welke signalen u in uw overzicht ziet.">
              <SettingRow title="Contracten" hint="Afloop en jaarlijkse huurindexatie."><Toggle label="Contractmeldingen" on={s.notifyContracts} onChange={value => set('notifyContracts', value)} /></SettingRow>
              <SettingRow title="Onderhoud" hint="Urgente onderhoudsverzoeken."><Toggle label="Onderhoudsmeldingen" on={s.notifyMaintenance} onChange={value => set('notifyMaintenance', value)} /></SettingRow>
              <SettingRow title="Betalingen" hint="Achterstallige en binnenkort verschuldigde betalingen."><Toggle label="Betalingsmeldingen" on={s.notifyPayments} onChange={value => set('notifyPayments', value)} /></SettingRow>
              <SettingRow title="E-mailsamenvatting" hint="Voorkeur voor e-mailupdates (e-mailverzending wordt later geactiveerd)."><Toggle label="E-mailmeldingen" on={s.emailNotifications} onChange={value => set('emailNotifications', value)} /></SettingRow>
              <SettingRow title="Herinnering contractafloop" hint="Aantal dagen vóór de einddatum.">
                <select value={s.contractReminderDays} onChange={event => set('contractReminderDays', Number(event.target.value))}>
                  {[30, 60, 90, 120, 180].map(days => <option key={days} value={days}>{days} dagen</option>)}
                </select>
              </SettingRow>
            </Card>
          )}
          {tab === 'work' && (
            <Card icon="settings" title="Werkwijze" text="Standaardwaarden voor contracten en betalingen.">
              <SettingRow title="Huurindexatie" hint="Percentage voor de jaarlijkse huurverhoging.">
                <span className="input-suffix"><input type="number" min="0" max="25" step="0.1" defaultValue={s.rentIndexation} key={s.rentIndexation} onBlur={event => set('rentIndexation', Number(event.target.value))} aria-label="Huurindexatie in procenten" /> %</span>
              </SettingRow>
              <SettingRow title="Betalingstermijn" hint="Standaard aantal dagen tot de vervaldatum.">
                <span className="input-suffix"><input type="number" min="0" max="90" step="1" defaultValue={s.defaultPaymentTermDays} key={s.defaultPaymentTermDays} onBlur={event => set('defaultPaymentTermDays', Number(event.target.value))} aria-label="Betalingstermijn in dagen" /> dagen</span>
              </SettingRow>
            </Card>
          )}
          {tab === 'security' && (
            <>
              <Card icon="lock" title="Wachtwoord wijzigen" text="Minimaal 8 tekens, met letters en cijfers.">
                <form className="form-grid" onSubmit={changePassword}>
                  <label className="wide-field">Huidig wachtwoord<input type="password" autoComplete="current-password" value={passwords.current} onChange={event => setPasswords(current => ({ ...current, current: event.target.value }))} required /></label>
                  <label>Nieuw wachtwoord<input type="password" autoComplete="new-password" minLength={8} value={passwords.next} onChange={event => setPasswords(current => ({ ...current, next: event.target.value }))} required /></label>
                  <label>Herhaal nieuw wachtwoord<input type="password" autoComplete="new-password" minLength={8} value={passwords.repeat} onChange={event => setPasswords(current => ({ ...current, repeat: event.target.value }))} required /></label>
                  <div className="wide-field form-actions"><Feedback result={passwordResult} /><button className="button">Wachtwoord wijzigen</button></div>
                </form>
              </Card>
              <Card icon="shield" title="Sessies" text="Uw sessie is beveiligd met een ondertekende httpOnly-cookie en verloopt na 8 uur.">
                <div className="button-row">
                  <button type="button" className="button ghost" onClick={() => logout(false)}><Icon name="logout" size={16} /> Uitloggen</button>
                  <button type="button" className="button danger ghost" onClick={() => logout(true)}>Overal uitloggen</button>
                </div>
              </Card>
            </>
          )}
          {tab === 'privacy' && (
            <>
              <Card icon="download" title="Uw gegevens" text="Download een kopie van al uw gegevens (JSON).">
                <a className="button ghost fit" href="/api/account/export" download><Icon name="download" size={16} /> Gegevens exporteren</a>
              </Card>
              <Card icon="trash" title="Account verwijderen" text="Verwijdert uw account en alle woningen, huurders, contracten en documenten definitief.">
                {user.role === 'admin' ? <p className="muted">Het beheerdersaccount kan niet worden verwijderd.</p> : (
                  <form className="form-grid" onSubmit={deleteAccount}>
                    <label className="wide-field">Bevestig met uw wachtwoord<input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} required /></label>
                    {deleteError && <p className="form-error wide-field" role="alert">{deleteError}</p>}
                    <div className="wide-field form-actions"><button className="button danger">Account verwijderen</button></div>
                  </form>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  )
}
