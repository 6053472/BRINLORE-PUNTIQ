import { addDays, daysBetween, formatDate, money, today } from './format'
import { invoiceViews } from './finance'
import type { Contract, Invoice, Maintenance, ModuleId, Payment, Property, UserSettings } from './types'

export type AppNotification = {
  id: string
  tone: 'urgent' | 'warning' | 'info'
  title: string
  detail: string
  when: string
  module: ModuleId
  /** Optioneel: het record waar de melding over gaat (bijv. contract-id), zodat het direct kan worden geopend. */
  recordId?: number
}

type Source = {
  contracts: Contract[]
  maintenance: Maintenance[]
  invoices: Invoice[]
  payments: Payment[]
  properties: Property[]
  settings: UserSettings
}

export type ContractState = 'Concept' | 'Actief' | 'Verloopt binnenkort' | 'Verlopen' | 'Beëindigd'

/** Effectieve status: een actief contract kan binnenkort verlopen of al verlopen zijn. */
export function contractState(contract: Contract, reminderDays: number, now = today()): ContractState {
  if (contract.status !== 'Actief') return contract.status as ContractState
  if (!contract.end) return 'Actief' // onbepaalde tijd
  const left = daysBetween(now, contract.end)
  if (left < 0) return 'Verlopen'
  return left <= reminderDays ? 'Verloopt binnenkort' : 'Actief'
}

/** Dagen tot de einddatum, of null bij onbepaalde tijd. */
export function daysUntilEnd(contract: Contract, now = today()) {
  return contract.end ? daysBetween(now, contract.end) : null
}

export function buildNotifications(source: Source): AppNotification[] {
  const { settings } = source
  const now = today()
  const list: AppNotification[] = []

  if (settings.notifyMaintenance) {
    for (const item of source.maintenance) {
      if (item.status === 'Afgerond' || item.priority !== 'Hoog') continue
      list.push({ id: `m${item.id}-${item.status}`, tone: 'urgent', title: `Urgent onderhoud: ${item.title}`, detail: item.property, when: item.date ? formatDate(item.date) : 'Open', module: 'maintenance' })
    }
  }

  if (settings.notifyContracts || settings.notifyIndexation) {
    for (const contract of source.contracts) {
      if (contract.status !== 'Actief') continue
      const left = contract.end ? daysBetween(now, contract.end) : null
      const detail = `${contract.property} — ${contract.tenant}`
      if (settings.notifyContracts && left !== null && left < 0) {
        list.push({ id: `c${contract.id}-expired`, tone: 'urgent', title: 'Contract verlopen', detail, when: formatDate(contract.end), module: 'contracts', recordId: contract.id })
      } else if (settings.notifyContracts && left !== null && left <= settings.contractReminderDays) {
        // Binnen 30 dagen krijgt de melding voorrang (rood); daarvoor is het een waarschuwing.
        const title = left === 0 ? 'Contract loopt vandaag af' : `Contract loopt af over ${left} ${left === 1 ? 'dag' : 'dagen'}`
        list.push({ id: `c${contract.id}-ending-${contract.end}`, tone: left <= 30 ? 'urgent' : 'warning', title, detail, when: formatDate(contract.end), module: 'contracts', recordId: contract.id })
      }
      if (settings.notifyIndexation && contract.rent) {
        const anniversary = new Date(`${contract.start}T00:00:00`)
        const next = new Date(`${now}T00:00:00`)
        anniversary.setFullYear(next.getFullYear())
        if (anniversary < next) anniversary.setFullYear(next.getFullYear() + 1)
        const iso = `${anniversary.getFullYear()}-${String(anniversary.getMonth() + 1).padStart(2, '0')}-${String(anniversary.getDate()).padStart(2, '0')}`
        const until = daysBetween(now, iso)
        if (until > 0 && until <= 60 && contract.start < iso) {
          const proposed = contract.rent * (1 + settings.rentIndexation / 100)
          list.push({ id: `c${contract.id}-index-${iso}`, tone: 'info', title: 'Jaarlijkse huurindexatie', detail: `${contract.property}: ${money(contract.rent)} → ${money(proposed)} (+${settings.rentIndexation}%)`, when: formatDate(iso), module: 'contracts', recordId: contract.id })
        }
      }
    }
  }

  if (settings.notifyPayments) {
    // Op basis van het openstaande saldo per factuur: deelbetalingen tellen mee.
    for (const invoice of invoiceViews(source.invoices, source.payments, now)) {
      const detail = `${invoice.number} · ${invoice.description}${invoice.tenant ? ` — ${invoice.tenant}` : ''}`
      if (invoice.state === 'Achterstallig') {
        list.push({ id: `i${invoice.id}-late-${invoice.balance}`, tone: 'urgent', title: `Achterstallig: ${money(invoice.balance)}`, detail, when: formatDate(invoice.dueDate), module: 'finance', recordId: invoice.id })
      } else if ((invoice.state === 'Openstaand' || invoice.state === 'Deels betaald') && invoice.dueDate <= addDays(now, settings.paymentReminderDays)) {
        list.push({ id: `i${invoice.id}-soon`, tone: 'info', title: `Vervalt binnenkort: ${money(invoice.balance)}`, detail, when: formatDate(invoice.dueDate), module: 'finance', recordId: invoice.id })
      }
    }
  }

  const rank = { urgent: 0, warning: 1, info: 2 }
  return list.sort((a, b) => rank[a.tone] - rank[b.tone])
}
