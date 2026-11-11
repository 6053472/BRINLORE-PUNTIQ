import type { ReactNode } from 'react'

export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow: string; title: string; intro: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <img src="/brinlore-puntiq-logo.png" alt="BRINLORE PUNTIQ" />
        <div>
          <p className="eyebrow">PUNTIQ</p>
          <h2>Ruimte voor vandaag.<br />Waarde voor morgen.</h2>
          <ul>
            <li>Portefeuille, huurders en contracten op één plek</li>
            <li>WWS-/WWSO-berekeningen met actueel prijspeil</li>
            <li>Onderhoud en betalingen altijd in beeld</li>
          </ul>
        </div>
        <small>© {new Date().getFullYear()} BRINLORE</small>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted">{intro}</p>
          {children}
          <p className="auth-switch">{footer}</p>
        </div>
      </section>
    </main>
  )
}
