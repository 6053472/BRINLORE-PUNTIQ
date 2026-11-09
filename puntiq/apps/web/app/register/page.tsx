'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const result = await response.json().catch(() => null)
      if (response.ok) {
        router.replace('/login?registered=1')
        return
      }
      setError(result?.error ?? 'Registreren mislukt. Probeer het opnieuw.')
    } catch {
      setError('De server is niet bereikbaar. Start de website opnieuw en probeer het nogmaals.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <img className="login-logo" src="/brinlore-puntiq-logo.png" alt="BRINLORE PUNTIQ" />
        </div>
        <p className="eyebrow">NIEUW ACCOUNT</p>
        <h1>Start met PUNTIQ</h1>
        <p className="muted">Maak uw eigen account aan voor vastgoedbeheer.</p>
        <form onSubmit={submit} className="login-form">
          <label>Gebruikersnaam<input name="username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /></label>
          <label>E-mailadres<input name="email" type="text" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Wachtwoord<input name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Account maken…' : 'Account registreren'}</button>
        </form>
        <p className="login-switch">Al een account? <a href="/login">Inloggen</a></p>
      </section>
    </main>
  )
}
