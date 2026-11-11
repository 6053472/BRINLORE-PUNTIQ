'use client'

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthShell } from '../../components/AuthShell'

type Site = { registrationOpen: boolean; maintenance: boolean; maintenanceMessage: string }

function LoginForm() {
  const registered = useSearchParams().get('registered') === '1'
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'user' | 'admin' | null>(null)
  const [site, setSite] = useState<Site | null>(null)

  useEffect(() => {
    fetch('/api/site').then(response => (response.ok ? response.json() : null)).then(setSite).catch(() => undefined)
  }, [])

  async function login(admin: boolean) {
    const form = formRef.current
    if (!form || !form.reportValidity()) return
    setBusy(admin ? 'admin' : 'user')
    setError('')
    const data = new FormData(form)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.get('username'), password: data.get('password'), admin }),
      })
      if (response.ok) {
        // Beheerders landen direct in het beheeroverzicht.
        window.location.href = admin ? '/#admin' : '/'
        return
      }
      const result = await response.json().catch(() => null)
      setError(result?.error ?? 'Inloggen mislukt.')
    } catch {
      setError('De server is niet bereikbaar. Probeer het later opnieuw.')
    }
    setBusy(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void login(false)
  }

  return (
    <AuthShell
      eyebrow="VASTGOEDBEHEER"
      title="Welkom terug"
      intro="Log in om uw portefeuille te beheren."
      footer={site?.registrationOpen === false ? <>Registreren is momenteel gesloten.</> : <>Nog geen account? <a href="/register">Registreren</a></>}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="auth-form">
        {registered && <p className="form-success" role="status">Account aangemaakt. U kunt nu inloggen.</p>}
        {site?.maintenance && <p className="form-error" role="status">{site.maintenanceMessage || 'PUNTIQ is tijdelijk in onderhoud. Alleen beheerders kunnen inloggen.'}</p>}
        <label>Gebruikersnaam<input name="username" autoComplete="username" autoFocus required /></label>
        <label>Wachtwoord<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button full" disabled={busy !== null}>{busy === 'user' ? 'Bezig met inloggen…' : 'Inloggen'}</button>
        <div className="auth-divider"><span>of</span></div>
        <button type="button" className="button ghost full" disabled={busy !== null} onClick={() => login(true)}>
          {busy === 'admin' ? 'Bezig met inloggen…' : 'Inloggen als beheerder'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
