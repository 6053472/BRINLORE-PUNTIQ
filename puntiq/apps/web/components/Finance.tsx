'use client'

import { useMemo, useState } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { ResourceModule } from './Resources'
import { PageHead, Stat, Status, PanelHeading } from './ui'
import { isOverdue } from '../lib/notifications'
import { addDays, formatDate, money, monthKey, monthLabel, today, toIso } from '../lib/format'
import type { Payment } from '../lib/types'

function lastMonths(count: number) {
  const base = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (count - 1 - index), 1)
    return { key: monthKey(toIso(date)), label: monthLabel(date) }
  })
}

export function FinanceModule() {
  const { records, saveRecord, notify, properties, user } = useApp()
  const [busy, setBusy] = useState(false)
  const now = today()
  const thisMonth = monthKey(now)

  const figures = useMemo(() => {
    const paid = records.payments.filter(payment => payment.status === 'Betaald')
    const open = records.payments.filter(payment => payment.status === 'Openstaand')
    const late = open.filter(payment => isOverdue(payment, now))
    const sum = (list: { amount: number }[]) => list.reduce((total, item) => total + item.amount, 0)
    const months = lastMonths(6).map(month => ({
      ...month,
      income: sum(paid.filter(payment => monthKey(payment.paidDate ?? payment.dueDate) === month.key)),
      costs: records.maintenance.filter(item => item.date && monthKey(item.date) === month.key).reduce((total, item) => total + (item.cost ?? 0), 0),
    }))
    return {
      received: sum(paid.filter(payment => monthKey(payment.paidDate ?? payment.dueDate) === thisMonth)),
      open: sum(open),
      late: sum(late),
      lateCount: late.length,
      costs: months[months.length - 1].costs,
      months,
    }
  }, [records.payments, records.maintenance, now, thisMonth])

  const peak = Math.max(1, ...figures.months.flatMap(month => [month.income, month.costs]))

  const generate = async () => {
    setBusy(true)
    const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date())
    const due = addDays(`${thisMonth}-01`, user.settings.defaultPaymentTermDays)
    let created = 0
    for (const contract of records.contracts) {
      if (contract.status !== 'Actief' || !contract.rent || contract.start > now || contract.end < `${thisMonth}-01`) continue
      const exists = records.payments.some(payment => payment.type === 'Huur' && payment.property === contract.property && payment.tenant === contract.tenant && monthKey(payment.dueDate) === thisMonth || payment.description === `Huur ${label} — ${contract.property}`)
      if (exists) continue
      if (await saveRecord('payments', { description: `Huur ${label} — ${contract.property}`, property: contract.property, tenant: contract.tenant, type: 'Huur', amount: contract.rent, dueDate: due, status: 'Openstaand' })) created += 1
    }
    setBusy(false)
    notify(created ? `${created} huurbetaling${created > 1 ? 'en' : ''} aangemaakt` : 'Geen nieuwe huurbetalingen nodig: alle actieve contracten staan al in de lijst')
  }

  const peakIncome = figures.months.some(month => month.income > 0 || month.costs > 0)

  return (
    <>
      <PageHead eyebrow="FINANCIEEL" title="Financieel" description="Inzicht in huurinkomsten, kosten en financiële prestaties." />
      <div className="stats-grid">
        <Stat label="Ontvangen deze maand" value={money(figures.received)} trend="Betaalde facturen" icon="euro" tone="sage" />
        <Stat label="Openstaand" value={money(figures.open)} trend={`${records.payments.filter(p => p.status === 'Openstaand').length} betalingen`} icon="file" tone="gold" />
        <Stat label="Achterstallig" value={money(figures.late)} trend={figures.lateCount ? `${figures.lateCount} betalingen vereisen aandacht` : 'Geen achterstanden'} icon="alert" tone={figures.lateCount ? 'red' : 'sage'} />
        <Stat label="Onderhoudskosten" value={money(figures.costs)} trend="Deze maand" icon="wrench" />
      </div>
      <div className="panel chart-panel">
        <PanelHeading title="Inkomsten en kosten" subtitle="Ontvangen betalingen en onderhoudskosten, laatste 6 maanden" />
        {peakIncome ? (
          <div className="bar-chart" role="img" aria-label="Staafdiagram van inkomsten en kosten per maand">
            {figures.months.map(month => (
              <div className="bar-column" key={month.key}>
                <div className="bars">
                  <div className="bar income" style={{ height: `${(month.income / peak) * 100}%` }} title={`Inkomsten ${money(month.income)}`} />
                  <div className="bar cost" style={{ height: `${(month.costs / peak) * 100}%` }} title={`Kosten ${money(month.costs)}`} />
                </div>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        ) : <p className="muted pad">Nog geen betalingen of kosten om weer te geven.</p>}
        <div className="chart-legend"><span><i className="dot navy" /> Inkomsten</span><span><i className="dot gold" /> Onderhoudskosten</span></div>
      </div>
      <ResourceModule<Payment>
        kind="payments"
        eyebrow="BETALINGEN"
        title="Betalingen"
        description="Huur, servicekosten en overige betalingen."
        addLabel="Nieuwe betaling"
        emptyText="Registreer betalingen of genereer automatisch de huur voor alle actieve contracten."
        rows={records.payments}
        filter={{ label: 'Status', options: ['Openstaand', 'Achterstallig', 'Betaald'], value: payment => (isOverdue(payment, now) ? 'Achterstallig' : payment.status) }}
        searchText={payment => `${payment.description} ${payment.property ?? ''} ${payment.tenant ?? ''} ${payment.type}`}
        csv={{ filename: 'betalingen.csv', header: ['Omschrijving', 'Object', 'Huurder', 'Type', 'Bedrag', 'Vervaldatum', 'Status', 'Betaald op'], row: payment => [payment.description, payment.property, payment.tenant, payment.type, payment.amount, payment.dueDate, payment.status, payment.paidDate] }}
        columns={[
          { label: 'Omschrijving', sort: payment => payment.description.toLowerCase(), render: payment => <><strong>{payment.description}</strong>{payment.tenant && <span className="sub">{payment.tenant}</span>}</> },
          { label: 'Type', render: payment => payment.type },
          { label: 'Vervaldatum', sort: payment => payment.dueDate, render: payment => formatDate(payment.dueDate) },
          { label: 'Bedrag', align: 'right', sort: payment => payment.amount, render: payment => <strong>{money(payment.amount)}</strong> },
          { label: 'Status', sort: payment => payment.status, render: payment => <Status value={isOverdue(payment, now) ? 'Achterstallig' : payment.status} /> },
        ]}
        rowActions={payment => payment.status === 'Openstaand' && (
          <button type="button" className="button ghost small" onClick={async () => { if (await saveRecord('payments', { status: 'Betaald', paidDate: today() }, payment.id)) notify('Betaling geregistreerd') }}>
            <Icon name="check" size={14} /> Betaald
          </button>
        )}
        defaults={{ dueDate: addDays(today(), user.settings.defaultPaymentTermDays), type: 'Huur' }}
        fields={[
          { name: 'description', label: 'Omschrijving', required: true, wide: true, placeholder: 'bijv. Huur november — Singel 229' },
          { name: 'property', label: 'Object', list: properties.map(property => property.name) },
          { name: 'tenant', label: 'Huurder', list: records.tenants.map(tenant => tenant.name) },
          { name: 'type', label: 'Type', type: 'select', options: ['Huur', 'Servicekosten', 'Borg', 'Onderhoud', 'Overig'] },
          { name: 'amount', label: 'Bedrag (€)', type: 'number', step: '0.01', required: true },
          { name: 'dueDate', label: 'Vervaldatum', type: 'date', required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Openstaand', 'Betaald'] },
        ]}
        extraActions={<button type="button" className="button ghost" disabled={busy} onClick={generate}><Icon name="euro" size={16} /> Huur deze maand genereren</button>}
      />
    </>
  )
}
