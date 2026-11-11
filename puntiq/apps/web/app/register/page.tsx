'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthShell } from '../../components/AuthShell'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== repeat) return setError('De wachtwoorden komen niet overeen.')
    setBusy(true)
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
      setError('De server is niet bereikbaar. Probeer het later opnieuw.')
    }
    setBusy(false)
  }

  return (
    <AuthShell eyebrow="NIEUW ACCOUNT" title="Start met PUNTIQ" intro="Maak uw eigen account aan voor vastgoedbeheer." footer={<>Al een account? <a href="/login">Inloggen</a></>}>
      <form onSubmit={submit} className="auth-form">
        <label>Gebruikersnaam<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" minLength={3} autoFocus required /></label>
        <label>E-mailadres<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Wachtwoord<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label>
        <label>Herhaal wachtwoord<input type="password" value={repeat} onChange={event => setRepeat(event.target.value)} minLength={8} autoComplete="new-password" required /></label>
        <small className="muted">Minimaal 8 tekens, met letters en cijfers.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button full" disabled={busy}>{busy ? 'Account maken…' : 'Account registreren'}</button>
      </form>
    </AuthShell>
  )
}
