'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
    })
    if (response.ok) {
      router.push('/')
    } else {
      const responseText = await response.text()
      let message = 'Inloggen mislukt.'
      if (responseText) {
        try {
          message = JSON.parse(responseText).error ?? message
        } catch {
          // The server may return an empty or non-JSON error response.
        }
      }
      setError(message)
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <img className="login-logo" src="/brinlore-puntiq-logo.png" alt="BRINLORE PUNTIQ" />
        </div>
        <p className="eyebrow">VASTGOEDBEHEER</p>
        <h1>Welkom terug</h1>
        <p className="muted">Log in om uw portefeuille te beheren.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label>Gebruikersnaam<input name="username" autoComplete="username" required /></label>
          <label>Wachtwoord<input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Bezig met inloggen…' : 'Inloggen'}</button>
        </form>
        <p className="login-switch">Nog geen account? <a href="/register">Registreren</a></p>
      </section>
    </main>
  )
}
