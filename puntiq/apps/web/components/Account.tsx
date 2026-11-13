'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { PageHead, SettingRow, Toggle } from './ui'
import { formatDateTime, resizeImage } from '../lib/format'
import { buildNotifications } from '../lib/notifications'
import { checkProfileField, passwordChecks, passwordStrength, type ProfileKey } from '../lib/validation'
import type { UserSettings } from '../lib/types'

export type SettingsSection = 'profile' | 'company' | 'security' | 'preferences' | 'notifications' | 'privacy'

export const settingsSections: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profiel', icon: 'user' },
  { id: 'company', label: 'Bedrijfsgegevens', icon: 'building' },
  { id: 'security', label: 'Wachtwoord & beveiliging', icon: 'lock' },
  { id: 'preferences', label: 'Voorkeuren', icon: 'sun' },
  { id: 'notifications', label: 'Meldingen', icon: 'bell' },
  { id: 'privacy', label: 'Gegevens & privacy', icon: 'shield' },
]

export const isSettingsSection = (value: unknown): value is SettingsSection => settingsSections.some(section => section.id === value)

type Result = { ok: boolean; text: string } | null
type DirtyHandler = (id: string, dirty: boolean) => void

function Card({ icon, title, text, children }: { icon: string; title: string; text: string; children: ReactNode }) {
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

function Feedback({ result }: { result: Result }) {
  return result ? <p className={result.ok ? 'form-success' : 'form-error'} role="status">{result.text}</p> : null
}

function FormActions({ result, dirty, busy, onReset, label = 'Opslaan' }: { result: Result; dirty: boolean; busy: boolean; onReset: () => void; label?: string }) {
  return (
    <div className="wide-field form-actions">
      {result ? <Feedback result={result} /> : dirty && <p className="unsaved">Niet-opgeslagen wijzigingen</p>}
      {dirty && <button type="button" className="button ghost" onClick={onReset} disabled={busy}>Annuleren</button>}
      <button className="button" disabled={busy || !dirty}>{busy ? 'Opslaan…' : label}</button>
    </div>
  )
}

/* ---------- Profiel- en bedrijfsformulier ---------- */

type FieldDef = { key: ProfileKey; label: string; wide?: boolean; props?: InputHTMLAttributes<HTMLInputElement> }

function ProfileForm({ id, fields, onDirty }: { id: string; fields: FieldDef[]; onDirty: DirtyHandler }) {
  const { user, updateAccount } = useApp()
  const keys = fields.map(field => field.key)
  const [saved, setSaved] = useState(() => Object.fromEntries(keys.map(key => [key, user.profile[key]])) as Record<ProfileKey, string>)
  const [values, setValues] = useState(saved)
  const [errors, setErrors] = useState<Partial<Record<ProfileKey, string>>>({})
  const [result, setResult] = useState<Result>(null)
  const [busy, setBusy] = useState(false)
  const dirty = keys.some(key => values[key] !== saved[key])

  useEffect(() => onDirty(id, dirty), [id, dirty, onDirty])

  const change = (key: ProfileKey, value: string) => {
    setValues(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
    setResult(null)
  }
  const blur = (key: ProfileKey) => {
    const error = checkProfileField(key, values[key]).error
    if (error) setErrors(current => ({ ...current, [key]: error }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = {} as Record<ProfileKey, string>
    const nextErrors: Partial<Record<ProfileKey, string>> = {}
    for (const key of keys) {
      const checked = checkProfileField(key, values[key])
      normalized[key] = checked.value
      if (checked.error) nextErrors[key] = checked.error
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setResult({ ok: false, text: 'Controleer de gemarkeerde velden.' })
      return
    }
    setBusy(true)
    const error = await updateAccount({ profile: normalized })
    setBusy(false)
    setResult({ ok: !error, text: error ?? 'Wijzigingen opgeslagen.' })
    if (!error) {
      setSaved(normalized)
      setValues(normalized)
    }
  }

  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      {fields.map(({ key, label, wide, props }) => (
        <label key={key} className={wide ? 'wide-field' : undefined}>
          {label}
          <input
            {...props}
            value={values[key]}
            onChange={event => change(key, event.target.value)}
            onBlur={() => blur(key)}
            aria-invalid={Boolean(errors[key])}
            aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
          />
          {errors[key] && <small className="field-error" id={`${id}-${key}-error`}>{errors[key]}</small>}
        </label>
      ))}
      <FormActions result={result} dirty={dirty} busy={busy} onReset={() => { setValues(saved); setErrors({}); setResult(null) }} />
    </form>
  )
}

function LoginForm({ onDirty }: { onDirty: DirtyHandler }) {
  const { user, updateAccount, setDraftUsername } = useApp()
  const [saved, setSaved] = useState({ username: user.username, email: user.email })
  const [values, setValues] = useState(saved)
  const [result, setResult] = useState<Result>(null)
  const [busy, setBusy] = useState(false)
  const dirty = values.username !== saved.username || values.email !== saved.email

  useEffect(() => onDirty('login', dirty), [dirty, onDirty])
  useEffect(() => () => setDraftUsername(null), [setDraftUsername])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = { username: values.username.trim(), email: values.email.trim() }
    setBusy(true)
    const error = await updateAccount(next)
    setBusy(false)
    setResult({ ok: !error, text: error ?? 'Inloggegevens opgeslagen.' })
    if (!error) {
      setSaved(next)
      setValues(next)
      setDraftUsername(null)
    }
  }
  const reset = () => {
    setValues(saved)
    setDraftUsername(null)
    setResult(null)
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>Gebruikersnaam<input value={values.username} onChange={event => { setValues(current => ({ ...current, username: event.target.value })); setDraftUsername(event.target.value); setResult(null) }} required minLength={3} autoComplete="username" /></label>
      <label>E-mailadres<input type="email" value={values.email} onChange={event => { setValues(current => ({ ...current, email: event.target.value })); setResult(null) }} required autoComplete="email" /></label>
      <FormActions result={result} dirty={dirty} busy={busy} onReset={reset} />
    </form>
  )
}

/* ---------- Secties ---------- */

function ProfileSection({ onDirty }: { onDirty: DirtyHandler }) {
  const { user, updateAccount, notify } = useApp()
  const p = user.profile
  const initials = (p.firstName ? `${p.firstName[0]}${p.lastName[0] ?? ''}` : user.username.slice(0, 2)).toUpperCase()

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
  const removeAvatar = async () => {
    const error = await updateAccount({ avatar: '' })
    notify(error ?? 'Profielfoto verwijderd', error ? 'error' : 'ok')
  }

  return (
    <>
      <section className="panel card avatar-card">
        {user.avatar ? <img className="profile-photo" src={user.avatar} alt="Profielfoto" /> : <div className="profile-photo fallback" aria-hidden="true">{initials}</div>}
        <div className="avatar-info">
          <h2>{[p.firstName, p.lastName].filter(Boolean).join(' ') || user.username}</h2>
          <p className="muted">{p.jobTitle || (user.role === 'admin' ? 'Beheerder' : 'Vastgoedbeheerder')}{p.company && ` · ${p.company}`}</p>
          <div className="button-row">
            <label className="button ghost small">Foto wijzigen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} hidden /></label>
            {user.avatar && <button type="button" className="link-button" onClick={removeAvatar}>Foto verwijderen</button>}
          </div>
        </div>
        <dl className="meta">
          <div><dt>Lid sinds</dt><dd>{formatDateTime(user.createdAt).split(',')[0]}</dd></div>
          <div><dt>Laatst ingelogd</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
        </dl>
      </section>
      <Card icon="user" title="Persoonlijke gegevens" text="Uw naam en contactgegevens.">
        <ProfileForm id="personal" onDirty={onDirty} fields={[
          { key: 'firstName', label: 'Voornaam', props: { autoComplete: 'given-name' } },
          { key: 'lastName', label: 'Achternaam', props: { autoComplete: 'family-name' } },
          { key: 'phone', label: 'Telefoonnummer', props: { type: 'tel', autoComplete: 'tel', placeholder: '+31 6 12345678' } },
          { key: 'jobTitle', label: 'Functie', props: { autoComplete: 'organization-title' } },
        ]} />
      </Card>
      <Card icon="lock" title="Inloggegevens" text="Gebruikersnaam en e-mailadres waarmee u inlogt.">
        <LoginForm onDirty={onDirty} />
      </Card>
    </>
  )
}

function CompanySection({ onDirty }: { onDirty: DirtyHandler }) {
  return (
    <Card icon="building" title="Bedrijfsgegevens" text="Worden gebruikt op facturen en contracten. Uw bedrijfsnaam verschijnt ook als werkruimte in het menu.">
      <ProfileForm id="company" onDirty={onDirty} fields={[
        { key: 'company', label: 'Bedrijfsnaam', wide: true, props: { autoComplete: 'organization' } },
        { key: 'kvk', label: 'KvK-nummer', props: { inputMode: 'numeric', maxLength: 9, placeholder: '12345678' } },
        { key: 'btw', label: 'Btw-nummer', props: { placeholder: 'NL123456789B01' } },
        { key: 'iban', label: 'IBAN', wide: true, props: { placeholder: 'NL00 BANK 0123 4567 89', autoComplete: 'off', spellCheck: false } },
        { key: 'address', label: 'Adres', wide: true, props: { autoComplete: 'street-address', placeholder: 'Straat en huisnummer' } },
        { key: 'postcode', label: 'Postcode', props: { autoComplete: 'postal-code', placeholder: '1234 AB' } },
        { key: 'city', label: 'Plaats', props: { autoComplete: 'address-level2' } },
      ]} />
    </Card>
  )
}

const strengthLabels = ['', 'Te zwak', 'Redelijk', 'Goed', 'Sterk']

function SecuritySection({ onDirty }: { onDirty: DirtyHandler }) {
  const { user, logout, confirm } = useApp()
  const empty = { current: '', next: '', repeat: '' }
  const [values, setValues] = useState(empty)
  const [show, setShow] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [busy, setBusy] = useState(false)
  const dirty = Boolean(values.current || values.next || values.repeat)

  useEffect(() => onDirty('password', dirty), [dirty, onDirty])

  const checks = passwordChecks(values.next)
  const strength = passwordStrength(values.next)
  const meetsPolicy = checks.every(check => !check.required || check.ok)
  const mismatch = values.repeat.length > 0 && values.repeat !== values.next
  const sameAsCurrent = values.next.length > 0 && values.next === values.current
  const canSubmit = Boolean(values.current) && meetsPolicy && values.repeat === values.next && !sameAsCurrent && !busy

  const set = (key: keyof typeof empty) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues(current => ({ ...current, [key]: event.target.value }))
    setResult(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: values.current, newPassword: values.next }) })
      if (response.status === 401) return void (window.location.href = '/login')
      const data = await response.json().catch(() => null)
      setResult({ ok: response.ok, text: response.ok ? 'Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.' : (data?.error ?? 'Wijzigen mislukt.') })
      if (response.ok) setValues(empty)
    } catch {
      setResult({ ok: false, text: 'Geen verbinding met de server.' })
    } finally {
      setBusy(false)
    }
  }

  const logoutEverywhere = async () => {
    if (await confirm('U wordt op alle apparaten uitgelogd, ook op dit apparaat.', 'Overal uitloggen')) logout(true)
  }

  const type = show ? 'text' : 'password'
  return (
    <>
      <Card icon="lock" title="Wachtwoord wijzigen" text="Na het wijzigen blijft u hier ingelogd; andere apparaten worden uitgelogd.">
        <form className="form-grid" onSubmit={submit} noValidate>
          <label className="wide-field">Huidig wachtwoord<input type={type} autoComplete="current-password" value={values.current} onChange={set('current')} required /></label>
          <label>
            Nieuw wachtwoord
            <input type={type} autoComplete="new-password" value={values.next} onChange={set('next')} aria-invalid={sameAsCurrent} aria-describedby="password-strength" required />
            {sameAsCurrent && <small className="field-error">Kies een ander wachtwoord dan het huidige.</small>}
          </label>
          <label>
            Herhaal nieuw wachtwoord
            <input type={type} autoComplete="new-password" value={values.repeat} onChange={set('repeat')} aria-invalid={mismatch} required />
            {mismatch && <small className="field-error">De wachtwoorden komen niet overeen.</small>}
          </label>
          <div className="wide-field password-help" id="password-strength">
            <div className="strength" data-level={strength} aria-hidden="true"><span /><span /><span /><span /></div>
            <small className="strength-label">{values.next ? `Sterkte: ${strengthLabels[strength]}` : 'Sterkte'}</small>
            <ul className="password-checks">
              {checks.map(check => (
                <li key={check.id} className={check.ok ? 'ok' : ''}>
                  <Icon name={check.ok ? 'check' : check.required ? 'x' : 'plus'} size={14} />
                  {check.label}{!check.required && <em> (aanbevolen)</em>}
                </li>
              ))}
            </ul>
          </div>
          <label className="check-label wide-field"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} /> Wachtwoorden tonen</label>
          <div className="wide-field form-actions">
            <Feedback result={result} />
            {dirty && <button type="button" className="button ghost" onClick={() => { setValues(empty); setResult(null) }} disabled={busy}>Annuleren</button>}
            <button className="button" disabled={!canSubmit}>{busy ? 'Wijzigen…' : 'Wachtwoord wijzigen'}</button>
          </div>
        </form>
      </Card>
      <Card icon="shield" title="Sessies" text="Uw sessie is beveiligd met een ondertekende httpOnly-cookie en verloopt 8 uur na het inloggen.">
        <dl className="meta flat">
          <div><dt>Laatst ingelogd</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
          <div><dt>Rol</dt><dd>{user.role === 'admin' ? 'Beheerder' : 'Gebruiker'}</dd></div>
        </dl>
        <div className="button-row">
          <button type="button" className="button ghost" onClick={() => logout(false)}><Icon name="logout" size={16} /> Uitloggen</button>
          <button type="button" className="button danger ghost" onClick={logoutEverywhere}>Overal uitloggen</button>
        </div>
      </Card>
    </>
  )
}

function NumberSetting({ value, min, max, step, suffix, label, onSave }: { value: number; min: number; max: number; step: number; suffix: string; label: string; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    // Serverwaarde gewijzigd (bijv. afgerond of begrensd): invoer bijwerken.
    setShown(value)
    setDraft(String(value))
  }
  const commit = () => {
    const parsed = Number(draft.replace(',', '.'))
    if (draft.trim() === '' || !Number.isFinite(parsed)) return setDraft(String(value))
    const clamped = Math.min(max, Math.max(min, parsed))
    setDraft(String(clamped))
    if (clamped !== value) onSave(clamped)
  }
  return (
    <span className="input-suffix">
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} aria-label={label} /> {suffix}
    </span>
  )
}

function useSettingSaver() {
  const { updateAccount, notify } = useApp()
  return useCallback(async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const error = await updateAccount({ settings: { [key]: value } })
    if (error) notify(error, 'error')
  }, [updateAccount, notify])
}

const landingPages = [['dashboard', 'Overzicht'], ['properties', 'Vastgoed'], ['tenants', 'Huurders'], ['contracts', 'Contracten'], ['maintenance', 'Onderhoud'], ['finance', 'Financieel']]

function PreferencesSection() {
  const { user } = useApp()
  const s = user.settings
  const set = useSettingSaver()
  return (
    <>
      <Card icon="sun" title="Weergave" text="Maak de interface comfortabeler. Wijzigingen worden direct opgeslagen.">
        <SettingRow title="Thema" hint="Licht, donker of volg de instelling van uw apparaat.">
          <div className="segmented" role="group" aria-label="Thema">
            {(['light', 'dark', 'system'] as const).map(theme => (
              <button key={theme} type="button" aria-pressed={s.theme === theme} onClick={() => set('theme', theme)}>{theme === 'light' ? 'Licht' : theme === 'dark' ? 'Donker' : 'Systeem'}</button>
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Compacte weergave" hint="Minder witruimte, meer informatie in beeld."><Toggle label="Compacte weergave" on={s.compact} onChange={value => set('compact', value)} /></SettingRow>
        <SettingRow title="Minder beweging" hint="Beperk animaties en overgangen."><Toggle label="Minder beweging" on={s.reducedMotion} onChange={value => set('reducedMotion', value)} /></SettingRow>
        <SettingRow title="Startpagina" hint="Waar u na het inloggen terechtkomt.">
          <select value={s.landingPage} onChange={event => set('landingPage', event.target.value)} aria-label="Startpagina">
            {landingPages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </SettingRow>
      </Card>
      <Card icon="settings" title="Werkwijze" text="Standaardwaarden voor nieuwe contracten en betalingen.">
        <SettingRow title="Huurindexatie" hint="Percentage voor de jaarlijkse huurverhoging (0–25%).">
          <NumberSetting value={s.rentIndexation} min={0} max={25} step={0.1} suffix="%" label="Huurindexatie in procenten" onSave={value => set('rentIndexation', value)} />
        </SettingRow>
        <SettingRow title="Betalingstermijn" hint="Standaard aantal dagen tot de vervaldatum (0–90).">
          <NumberSetting value={s.defaultPaymentTermDays} min={0} max={90} step={1} suffix="dagen" label="Betalingstermijn in dagen" onSave={value => set('defaultPaymentTermDays', Math.round(value))} />
        </SettingRow>
      </Card>
    </>
  )
}

function NotificationsSection() {
  const { user, records, properties } = useApp()
  const s = user.settings
  const set = useSettingSaver()
  const active = useMemo(
    () => buildNotifications({ contracts: records.contracts, maintenance: records.maintenance, payments: records.payments, properties, settings: s }).length,
    [records, properties, s],
  )
  const anyOn = s.notifyContracts || s.notifyIndexation || s.notifyMaintenance || s.notifyPayments

  return (
    <>
      <Card icon="bell" title="Meldingen in PUNTIQ" text="Bepaal welke signalen u in het meldingencentrum en op het overzicht ziet.">
        <SettingRow title="Contractafloop" hint="Contracten die binnenkort aflopen of verlopen zijn."><Toggle label="Contractafloop" on={s.notifyContracts} onChange={value => set('notifyContracts', value)} /></SettingRow>
        {s.notifyContracts && (
          <div className="setting-row sub">
            <div><strong>Herinnering vooraf</strong><small>Hoe lang vóór de einddatum u een melding krijgt.</small></div>
            <select value={s.contractReminderDays} onChange={event => set('contractReminderDays', Number(event.target.value))} aria-label="Herinnering contractafloop">
              {[30, 60, 90, 120, 180].map(days => <option key={days} value={days}>{days} dagen</option>)}
            </select>
          </div>
        )}
        <SettingRow title="Huurindexatie" hint={`Jaarlijkse indexatiemoment (${s.rentIndexation}%), 60 dagen vooraf.`}><Toggle label="Huurindexatie" on={s.notifyIndexation} onChange={value => set('notifyIndexation', value)} /></SettingRow>
        <SettingRow title="Urgent onderhoud" hint="Onderhoudsverzoeken met hoge prioriteit."><Toggle label="Onderhoudsmeldingen" on={s.notifyMaintenance} onChange={value => set('notifyMaintenance', value)} /></SettingRow>
        <SettingRow title="Betalingen" hint="Achterstallige en binnenkort verschuldigde betalingen."><Toggle label="Betalingsmeldingen" on={s.notifyPayments} onChange={value => set('notifyPayments', value)} /></SettingRow>
        {s.notifyPayments && (
          <div className="setting-row sub">
            <div><strong>Herinnering vooraf</strong><small>Hoe lang vóór de vervaldatum u een melding krijgt.</small></div>
            <select value={s.paymentReminderDays} onChange={event => set('paymentReminderDays', Number(event.target.value))} aria-label="Herinnering betalingen">
              {[3, 7, 14, 30].map(days => <option key={days} value={days}>{days} dagen</option>)}
            </select>
          </div>
        )}
        <p className="settings-summary" role="status">
          <Icon name={anyOn ? 'bell' : 'alert'} size={16} />
          {anyOn ? `Met deze instellingen heeft u nu ${active} ${active === 1 ? 'actieve melding' : 'actieve meldingen'}.` : 'Alle meldingen staan uit. U mist mogelijk aflopende contracten en achterstallige betalingen.'}
        </p>
      </Card>
      <Card icon="file" title="E-mail" text={`Samenvattingen worden verstuurd naar ${user.email}.`}>
        <SettingRow title="E-mailsamenvatting" hint="E-mailverzending wordt binnenkort geactiveerd; uw voorkeur wordt alvast bewaard."><Toggle label="E-mailsamenvatting" on={s.emailNotifications} onChange={value => set('emailNotifications', value)} /></SettingRow>
        <SettingRow title="Frequentie" hint="Hoe vaak u een samenvatting ontvangt.">
          <div className="segmented" role="group" aria-label="Frequentie e-mailsamenvatting">
            {(['daily', 'weekly'] as const).map(frequency => (
              <button key={frequency} type="button" disabled={!s.emailNotifications} aria-pressed={s.emailFrequency === frequency} onClick={() => set('emailFrequency', frequency)}>{frequency === 'daily' ? 'Dagelijks' : 'Wekelijks'}</button>
            ))}
          </div>
        </SettingRow>
      </Card>
    </>
  )
}

function PrivacySection() {
  const { user, confirm } = useApp()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!(await confirm('Uw account en alle bijbehorende gegevens worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.', 'Account verwijderen'))) return
    const response = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).catch(() => null)
    if (response?.ok) window.location.href = '/login'
    else setError((await response?.json().catch(() => null))?.error ?? 'Verwijderen mislukt.')
  }
  return (
    <>
      <Card icon="download" title="Uw gegevens" text="Download een kopie van al uw gegevens (JSON).">
        <a className="button ghost fit" href="/api/account/export" download><Icon name="download" size={16} /> Gegevens exporteren</a>
      </Card>
      <Card icon="trash" title="Account verwijderen" text="Verwijdert uw account en alle woningen, huurders, contracten en documenten definitief.">
        {user.role === 'admin' ? <p className="muted">Het beheerdersaccount kan niet worden verwijderd.</p> : (
          <form className="form-grid" onSubmit={deleteAccount}>
            <label className="wide-field">Bevestig met uw wachtwoord<input type="password" autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError('') }} required /></label>
            {error && <p className="form-error wide-field" role="alert">{error}</p>}
            <div className="wide-field form-actions"><button className="button danger">Account verwijderen</button></div>
          </form>
        )}
      </Card>
    </>
  )
}

/* ---------- Pagina ---------- */

export function SettingsPanel({ section, onSection }: { section: SettingsSection; onSection: (section: SettingsSection) => void }) {
  const { confirm } = useApp()
  const [dirty, setDirty] = useState<string[]>([])
  const [shownSection, setShownSection] = useState(section)
  if (shownSection !== section) {
    // Andere sectie (ook via terugknop of URL): formulieren van de vorige sectie zijn weg.
    setShownSection(section)
    setDirty([])
  }

  const onDirty = useCallback<DirtyHandler>((id, isDirty) => {
    setDirty(current => (isDirty === current.includes(id) ? current : isDirty ? [...current, id] : current.filter(item => item !== id)))
  }, [])

  // Waarschuwen bij verversen of sluiten met niet-opgeslagen wijzigingen.
  useEffect(() => {
    if (!dirty.length) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty.length])

  const choose = async (next: SettingsSection) => {
    if (next === section) return
    if (dirty.length && !(await confirm('U heeft niet-opgeslagen wijzigingen. Wilt u doorgaan zonder op te slaan?', 'Doorgaan'))) return
    setDirty([])
    onSection(next)
  }

  const current = settingsSections.find(item => item.id === section) ?? settingsSections[0]
  return (
    <>
      <PageHead eyebrow="MIJN ACCOUNT" title="Instellingen" description="Beheer uw profiel, bedrijfsgegevens, beveiliging, voorkeuren en meldingen." />
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Instellingen">
          {settingsSections.map(item => (
            <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => choose(item.id)}>
              <Icon name={item.icon} size={17} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="stack" aria-label={current.label} role="region" key={section}>
          {section === 'profile' && <ProfileSection onDirty={onDirty} />}
          {section === 'company' && <CompanySection onDirty={onDirty} />}
          {section === 'security' && <SecuritySection onDirty={onDirty} />}
          {section === 'preferences' && <PreferencesSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </>
  )
}
