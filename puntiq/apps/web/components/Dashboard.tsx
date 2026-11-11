'use client'

import { useMemo } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { PropertyTable } from './Properties'
import { EmptyState, PageHead, PanelHeading, Stat } from './ui'
import { buildNotifications } from '../lib/notifications'
import { greeting, longDate, money, moneyShort } from '../lib/format'
import type { ModuleId, Property } from '../lib/types'

export function Dashboard({ onNavigate, onAdd, onWws, onSelect }: {
  onNavigate: (id: ModuleId) => void
  onAdd: () => void
  onWws: () => void
  onSelect: (property: Property) => void
}) {
  const { user, properties, records, loading } = useApp()
  const notifications = useMemo(
    () => buildNotifications({ contracts: records.contracts, maintenance: records.maintenance, payments: records.payments, properties, settings: user.settings }),
    [records, properties, user.settings],
  )

  const rented = properties.filter(property => property.status === 'Verhuurd')
  const available = properties.filter(property => property.status === 'Beschikbaar')
  const inMaintenance = properties.filter(property => property.status === 'In onderhoud')
  const total = properties.length
  const occupancy = total ? Math.round((rented.length / total) * 1000) / 10 : 0
  const monthlyRent = rented.reduce((sum, property) => sum + property.rent, 0)
  const portfolioValue = properties.reduce((sum, property) => sum + (property.price ?? 0), 0)
  const urgent = notifications.filter(item => item.tone === 'urgent').length

  const rentedEnd = total ? (rented.length / total) * 100 : 0
  const availableEnd = rentedEnd + (total ? (available.length / total) * 100 : 0)
  const donut = total
    ? `conic-gradient(var(--navy) 0 ${rentedEnd}%, var(--sage) ${rentedEnd}% ${availableEnd}%, var(--gold) ${availableEnd}% 100%)`
    : 'conic-gradient(var(--line) 0 100%)'

  const name = user.profile.firstName || user.username
  const recent = properties.slice(0, 5)

  return (
    <>
      <PageHead eyebrow={longDate().toUpperCase()} title={`${greeting()}, ${name}`} description="Hier is wat er vandaag speelt binnen uw portefeuille.">
        <button type="button" className="button ghost" onClick={onWws}><Icon name="calc" size={16} /> WWS-berekening</button>
        <button type="button" className="button" onClick={onAdd}><Icon name="plus" size={16} /> Nieuwe woning</button>
      </PageHead>

      <div className="stats-grid">
        <Stat label="Totaal objecten" value={String(total)} trend={total ? `${available.length} beschikbaar` : 'Voeg uw eerste woning toe'} icon="building" />
        <Stat label="Bezettingsgraad" value={total ? `${String(occupancy).replace('.', ',')}%` : '—'} trend={`${rented.length} van ${total} verhuurd`} icon="check" tone="sage" />
        <Stat label="Openstaande acties" value={String(notifications.length)} trend={urgent ? `${urgent} urgent` : 'Geen urgente acties'} icon="alert" tone={urgent ? 'red' : 'gold'} />
        <Stat label="Maandelijkse huur" value={money(monthlyRent)} trend="Verhuurde objecten" icon="euro" tone="gold" />
      </div>

      <div className="grid-main">
        <div className="panel">
          <PanelHeading title="Portefeuille" subtitle="Verdeling van uw vastgoedobjecten" link="Bekijk alles" onClick={() => onNavigate('properties')} />
          <div className="chart-wrap">
            <div className="donut" style={{ background: donut }} role="img" aria-label={`${rented.length} verhuurd, ${available.length} beschikbaar, ${inMaintenance.length} in onderhoud`}>
              <div><strong>{total}</strong><span>objecten</span></div>
            </div>
            <div className="legend">
              <div className="legend-row"><i style={{ background: 'var(--navy)' }} /><span>Verhuurd</span><strong>{rented.length}</strong></div>
              <div className="legend-row"><i style={{ background: 'var(--sage)' }} /><span>Beschikbaar</span><strong>{available.length}</strong></div>
              <div className="legend-row"><i style={{ background: 'var(--gold)' }} /><span>In onderhoud</span><strong>{inMaintenance.length}</strong></div>
              <div className="legend-total"><span>Totale waarde</span><strong>{portfolioValue ? moneyShort(portfolioValue) : '—'}</strong></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <PanelHeading title="Actie vereist" subtitle="Uw belangrijkste taken" />
          {notifications.length === 0 ? (
            <EmptyState icon="check" title="Alles bij" text="Er zijn geen openstaande acties." />
          ) : (
            <div className="actions-list">
              {notifications.slice(0, 5).map(item => (
                <button type="button" key={item.id} className="action" onClick={() => onNavigate(item.module)}>
                  <span className={`action-icon ${item.tone}`}><Icon name={item.module === 'maintenance' ? 'wrench' : item.module === 'finance' ? 'euro' : 'file'} size={17} /></span>
                  <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                  <time>{item.when}</time>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <PanelHeading title="Recente objecten" subtitle="De laatst toegevoegde objecten in uw portefeuille" link="Alle objecten" onClick={() => onNavigate('properties')} />
        {loading ? <p className="muted pad">Laden…</p> : recent.length ? (
          <PropertyTable properties={recent} onSelect={onSelect} />
        ) : (
          <EmptyState icon="building" title="Welkom bij BRINLORE PUNTIQ" text="Begin met het toevoegen van uw eerste woning. Daarna koppelt u huurders, contracten en onderhoud." action={<button type="button" className="button" onClick={onAdd}><Icon name="plus" size={16} /> Eerste woning toevoegen</button>} />
        )}
      </div>
    </>
  )
}
