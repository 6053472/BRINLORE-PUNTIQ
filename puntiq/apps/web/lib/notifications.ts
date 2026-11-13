import { addDays, daysBetween, formatDate, money, today } from './format'
import type { Contract, Maintenance, ModuleId, Payment, Property, UserSettings } from './types'

export type AppNotification = {
  id: string
  tone: 'urgent' | 'warning' | 'info'
  title: string
  detail: string
  when: string
  module: ModuleId
}

type Source = {
  contracts: Contract[]
  maintenance: Maintenance[]
  payments: Payment[]
  properties: Property[]
  settings: UserSettings
}

export type ContractState = 'Concept' | 'Actief' | 'Verloopt binnenkort' | 'Verlopen' | 'Beëindigd'

/** Effectieve status: een actief contract kan binnenkort verlopen of al verlopen zijn. */
export function contractState(contract: Contract, reminderDays: number, now = today()): ContractState {
  if (contract.status !== 'Actief') return contract.status as ContractState
  const left = daysBetween(now, contract.end)
  if (left < 0) return 'Verlopen'
  return left <= reminderDays ? 'Verloopt binnenkort' : 'Actief'
}

export const isOverdue = (payment: Payment, now = today()) => payment.status === 'Openstaand' && payment.dueDate < now

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
      const left = daysBetween(now, contract.end)
      if (settings.notifyContracts && left < 0) {
        list.push({ id: `c${contract.id}-expired`, tone: 'urgent', title: 'Contract verlopen', detail: `${contract.property} — ${contract.tenant}`, when: formatDate(contract.end), module: 'contracts' })
      } else if (settings.notifyContracts && left <= settings.contractReminderDays) {
        list.push({ id: `c${contract.id}-ending`, tone: 'warning', title: `Contract verloopt over ${left} ${left === 1 ? 'dag' : 'dagen'}`, detail: `${contract.property} — ${contract.tenant}`, when: formatDate(contract.end), module: 'contracts' })
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
          list.push({ id: `c${contract.id}-index-${iso}`, tone: 'info', title: 'Jaarlijkse huurindexatie', detail: `${contract.property}: ${money(contract.rent)} → ${money(proposed)} (+${settings.rentIndexation}%)`, when: formatDate(iso), module: 'contracts' })
        }
      }
    }
  }

  if (settings.notifyPayments) {
    for (const payment of source.payments) {
      if (payment.status !== 'Openstaand') continue
      if (payment.dueDate < now) {
        list.push({ id: `p${payment.id}-late`, tone: 'urgent', title: `Betaling achterstallig: ${money(payment.amount)}`, detail: `${payment.description}${payment.tenant ? ` — ${payment.tenant}` : ''}`, when: formatDate(payment.dueDate), module: 'finance' })
      } else if (payment.dueDate <= addDays(now, settings.paymentReminderDays)) {
        list.push({ id: `p${payment.id}-soon`, tone: 'info', title: `Betaling binnenkort: ${money(payment.amount)}`, detail: payment.description, when: formatDate(payment.dueDate), module: 'finance' })
      }
    }
  }

  const rank = { urgent: 0, warning: 1, info: 2 }
  return list.sort((a, b) => rank[a.tone] - rank[b.tone])
}
