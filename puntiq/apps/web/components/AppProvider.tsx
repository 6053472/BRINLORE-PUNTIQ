'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Property, RecordKind, RecordMap, User, UserProfile, UserSettings } from '../lib/types'

type Toast = { id: number; message: string; tone: 'ok' | 'error' }
type ConfirmState = { message: string; confirmLabel: string; resolve: (value: boolean) => void } | null

type ProfilePatch = { username?: string; email?: string; avatar?: string; profile?: Partial<UserProfile>; settings?: Partial<UserSettings> }

type AppContextValue = {
  user: User
  draftUsername: string | null
  setDraftUsername: (value: string | null) => void
  loading: boolean
  properties: Property[]
  records: RecordMap
  notify: (message: string, tone?: 'ok' | 'error') => void
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>
  saveProperty: (input: Partial<Property>, id?: number) => Promise<Property | null>
  removeProperty: (id: number) => Promise<boolean>
  importProperties: (rows: Record<string, string | number>[]) => Promise<{ created: number; skipped: number; errors: { line: number; message: string }[] } | null>
  saveRecord: <K extends RecordKind>(kind: K, data: Record<string, unknown>, id?: number) => Promise<RecordMap[K][number] | null>
  removeRecord: (kind: RecordKind, id: number) => Promise<boolean>
  updateAccount: (patch: ProfilePatch) => Promise<string | null>
  logout: (everywhere?: boolean) => Promise<void>
}

const emptyRecords: RecordMap = { tenants: [], contracts: [], maintenance: [], documents: [], invoices: [], payments: [], wws: [], wwso: [] }
const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp moet binnen AppProvider worden gebruikt.')
  return value
}

/** Houdt het overzicht licht: foto's worden los geladen (zie /api/properties/[id]/image/[index]). */
const slim = (property: Property): Property => ({ ...property, image: undefined, images: undefined, imageCount: property.images?.length ?? (property.image ? 1 : 0), imageVersion: Date.now() })

export const THEME_KEY = 'puntiq-theme'

function applyPreferences(settings: UserSettings) {
  const root = document.documentElement
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.classList.toggle('compact', settings.compact)
  root.classList.toggle('reduced-motion', settings.reducedMotion)
  try {
    localStorage.setItem(THEME_KEY, settings.theme)
  } catch {
    // localStorage kan geblokkeerd zijn (privémodus); de voorkeur staat ook op de server.
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const response = await fetch(url, { ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers })
    const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
    if (response.status === 401) {
      window.location.href = '/login'
      return { ok: false, data: null, error: 'Uw sessie is verlopen.' }
    }
    return { ok: response.ok, data, error: response.ok ? undefined : (data?.error ?? 'Er ging iets mis.') }
  } catch {
    return { ok: false, data: null, error: 'Geen verbinding met de server.' }
  }
}

export function AppProvider({ initialUser, children }: { initialUser: User; children: ReactNode }) {
  const [user, setUser] = useState<User>(initialUser)
  const [draftUsername, setDraftUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState<Property[]>([])
  const [records, setRecords] = useState<RecordMap>(emptyRecords)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const toastId = useRef(0)
  const notifyRef = useRef<(message: string, tone?: 'ok' | 'error') => void>(() => undefined)

  useEffect(() => {
    applyPreferences(user.settings)
    if (user.settings.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyPreferences(user.settings)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [user.settings])

  useEffect(() => {
    let cancelled = false
    Promise.all([request<{ properties: Property[] }>('/api/properties'), request<RecordMap>('/api/records')]).then(([props, recs]) => {
      if (cancelled) return
      if (props.data?.properties) setProperties(props.data.properties)
      if (recs.data) setRecords({ ...emptyRecords, ...recs.data })
      setLoading(false)
      // Zonder melding zou een mislukte load eruitzien als een lege portefeuille.
      if (!props.ok || !recs.ok) notifyRef.current('Gegevens konden niet (volledig) worden geladen. Ververs de pagina voordat u iets wijzigt.', 'error')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = ++toastId.current
    setToasts(current => [...current.slice(-3), { id, message, tone }])
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), tone === 'error' ? 5000 : 3000)
  }, [])

  useEffect(() => {
    notifyRef.current = notify
  }, [notify])

  const confirm = useCallback(
    (message: string, confirmLabel = 'Verwijderen') => new Promise<boolean>(resolve => setConfirmState(previous => {
      previous?.resolve(false) // een eerdere, nog openstaande vraag blijft niet eeuwig hangen
      return { message, confirmLabel, resolve }
    })),
    [],
  )

  // Escape sluit de bevestiging, niet ook het modal eronder.
  useEffect(() => {
    if (!confirmState) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      confirmState.resolve(false)
      setConfirmState(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirmState])

  const saveProperty = useCallback(async (input: Partial<Property>, id?: number) => {
    const result = await request<{ property: Property }>(id ? `/api/properties/${id}` : '/api/properties', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) })
    if (!result.ok || !result.data?.property) {
      notify(result.error ?? 'Woning kon niet worden opgeslagen.', 'error')
      return null
    }
    const saved = slim(result.data.property)
    setProperties(current => (id ? current.map(item => (item.id === id ? saved : item)) : [saved, ...current]))
    return saved
  }, [notify])

  const removeProperty = useCallback(async (id: number) => {
    const result = await request<{ ok: boolean }>(`/api/properties/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      notify(result.error ?? 'Woning kon niet worden verwijderd.', 'error')
      return false
    }
    setProperties(current => current.filter(item => item.id !== id))
    return true
  }, [notify])

  const importProperties = useCallback(async (rows: Record<string, string | number>[]) => {
    const result = await request<{ created: Property[]; skipped: number; errors: { line: number; message: string }[] }>('/api/properties/import', { method: 'POST', body: JSON.stringify({ rows }) })
    if (!result.ok || !result.data) {
      notify(result.error ?? 'Importeren is mislukt.', 'error')
      return null
    }
    const { created, skipped, errors } = result.data
    setProperties(current => [...created.map(slim), ...current])
    return { created: created.length, skipped, errors }
  }, [notify])

  const saveRecord = useCallback(async <K extends RecordKind>(kind: K, data: Record<string, unknown>, id?: number) => {
    const result = await request<{ record: RecordMap[K][number] }>(id ? `/api/records/${kind}/${id}` : `/api/records/${kind}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) })
    if (!result.ok || !result.data?.record) {
      notify(result.error ?? 'Opslaan mislukt.', 'error')
      return null
    }
    const saved = result.data.record
    setRecords(current => ({
      ...current,
      [kind]: id ? (current[kind] as { id: number }[]).map(item => (item.id === id ? saved : item)) : [saved, ...current[kind]],
    }))
    return saved
  }, [notify])

  const removeRecord = useCallback(async (kind: RecordKind, id: number) => {
    const result = await request<{ ok: boolean }>(`/api/records/${kind}/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      notify(result.error ?? 'Verwijderen mislukt.', 'error')
      return false
    }
    setRecords(current => ({ ...current, [kind]: (current[kind] as { id: number }[]).filter(item => item.id !== id) }))
    return true
  }, [notify])

  const updateAccount = useCallback(async (patch: ProfilePatch) => {
    const result = await request<{ user: User }>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(patch) })
    if (!result.ok || !result.data?.user) return result.error ?? 'Opslaan mislukt.'
    setUser(result.data.user)
    return null
  }, [])

  const logout = useCallback(async (everywhere = false) => {
    await fetch(everywhere ? '/api/auth/sessions' : '/api/auth/logout', { method: everywhere ? 'DELETE' : 'POST' }).catch(() => undefined)
    window.location.href = '/login'
  }, [])

  // Automatisch uitloggen na inactiviteit (instelbaar onder Wachtwoord & beveiliging).
  const idleMinutes = user.settings.idleLogoutMinutes
  useEffect(() => {
    if (!idleMinutes) return
    let timer = 0
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void logout(false) }, idleMinutes * 60_000)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const
    events.forEach(name => window.addEventListener(name, reset, { passive: true }))
    reset()
    return () => {
      window.clearTimeout(timer)
      events.forEach(name => window.removeEventListener(name, reset))
    }
  }, [idleMinutes, logout])

  const value = useMemo<AppContextValue>(
    () => ({ user, draftUsername, setDraftUsername, loading, properties, records, notify, confirm, saveProperty, removeProperty, importProperties, saveRecord, removeRecord, updateAccount, logout }),
    [user, draftUsername, loading, properties, records, notify, confirm, saveProperty, removeProperty, importProperties, saveRecord, removeRecord, updateAccount, logout],
  )

  const answer = (result: boolean) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.tone}`}>{toast.tone === 'ok' ? '✓' : '!'} {toast.message}</div>
        ))}
      </div>
      {confirmState && (
        <div className="modal-backdrop" onClick={() => answer(false)}>
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" onClick={event => event.stopPropagation()}>
            <h2>Weet u het zeker?</h2>
            <p className="muted">{confirmState.message}</p>
            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => answer(false)}>Annuleren</button>
              <button type="button" className="button danger" autoFocus onClick={() => answer(true)}>{confirmState.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  )
}
