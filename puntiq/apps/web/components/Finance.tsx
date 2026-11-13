'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, PanelHeading, Stat, Status } from './ui'
import {
  aging, groupBy, invoiceStates, invoiceViews, monthly, propertyKey, tenantKey, totals,
  type GroupRow, type InvoiceState, type InvoiceView,
} from '../lib/finance'
import { addDays, downloadCsv, formatDate, money, monthKey, monthLabel, today, toIso } from '../lib/format'
import type { Invoice, InvoiceType, Payment, PaymentMethod, Tenant } from '../lib/types'

const TYPES: InvoiceType[] = ['Huur', 'Servicekosten', 'Borg', 'Onderhoud', 'Overig']
const METHODS: PaymentMethod[] = ['Overboeking', 'Automatische incasso', 'iDEAL', 'Contant', 'Overig']
type Tab = 'overzicht' | 'facturen' | 'betalingen'
type PeriodKey = 'maand' | 'vorige' | 'kwartaal' | 'jaar' | 'alles' | 'aangepast'
type Filters = { period: PeriodKey; from: string; to: string; tenant: string; property: string }

/* ---------- Helpers ---------- */

function periodRange(filters: Filters): { from: string; to: string } | undefined {
  const now = new Date()
  const first = (y: number, m: number) => toIso(new Date(y, m, 1))
  const last = (y: number, m: number) => toIso(new Date(y, m + 1, 0))
  const [y, m] = [now.getFullYear(), now.getMonth()]
  switch (filters.period) {
    case 'maand': return { from: first(y, m), to: last(y, m) }
    case 'vorige': return { from: first(y, m - 1), to: last(y, m - 1) }
    case 'kwartaal': return { from: first(y, Math.floor(m / 3) * 3), to: last(y, Math.floor(m / 3) * 3 + 2) }
    case 'jaar': return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'aangepast': return filters.from && filters.to ? { from: filters.from, to: filters.to } : undefined
    default: return undefined
  }
}

const periodLabels: Record<PeriodKey, string> = { maand: 'Deze maand', vorige: 'Vorige maand', kwartaal: 'Dit kwartaal', jaar: 'Dit jaar', alles: 'Alles', aangepast: 'Aangepast' }

function lastMonths(count: number) {
  const base = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (count - 1 - index), 1)
    return { key: monthKey(toIso(date)), label: monthLabel(date) }
  })
}

/** Filtert op huurder en woning (op id, of op naam bij oudere records). */
function matches(item: { tenant?: string; tenantId?: number; property?: string; propertyId?: number }, filters: Filters) {
  const t = tenantKey(item)?.key ?? ''
  const p = propertyKey(item)?.key ?? ''
  return (!filters.tenant || t === filters.tenant) && (!filters.property || p === filters.property)
}

const stateClass = (state: InvoiceState) => (state === 'Deels betaald' ? 'Openstaand' : state === 'Geannuleerd' ? 'Beëindigd' : state)

function useLinks() {
  const { properties, records } = useApp()
  return useMemo(() => ({
    tenantById: (id?: number) => records.tenants.find(item => item.id === id),
    propertyById: (id?: number) => properties.find(item => item.id === id),
    activeContractOf: (tenant?: Tenant) => tenant ? records.contracts.find(c => c.status === 'Actief' && (c.tenantId === tenant.id || c.tenant === tenant.name)) : undefined,
  }), [properties, records.tenants, records.contracts])
}

/* ---------- Formulieren ---------- */

function InvoiceForm({ invoice, onClose }: { invoice?: Invoice; onClose: () => void }) {
  const { records, properties, saveRecord, notify, user } = useApp()
  const { tenantById, propertyById, activeContractOf } = useLinks()
  const [tenantId, setTenantId] = useState(String(invoice?.tenantId ?? ''))
  const [propertyId, setPropertyId] = useState(String(invoice?.propertyId ?? ''))
  const [contractId, setContractId] = useState(String(invoice?.contractId ?? ''))
  const [type, setType] = useState<InvoiceType>(invoice?.type ?? 'Huur')
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : '')
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? today())
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? addDays(today(), user.settings.defaultPaymentTermDays))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const chooseTenant = (id: string) => {
    setTenantId(id)
    const contract = activeContractOf(tenantById(Number(id)))
    if (!contract) return
    setContractId(String(contract.id))
    const property = propertyById(contract.propertyId) ?? properties.find(item => item.name === contract.property)
    if (property) setPropertyId(String(property.id))
    if (!amount && contract.rent && type === 'Huur') setAmount(String(contract.rent))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (dueDate < issueDate) return setError('De vervaldatum ligt vóór de factuurdatum.')
    const tenant = tenantById(Number(tenantId))
    const property = propertyById(Number(propertyId))
    setBusy(true)
    setError('')
    const saved = await saveRecord('invoices', {
      number: String(form.get('number') ?? '').trim() || (invoice ? invoice.number : ''),
      description: String(form.get('description')),
      type,
      tenant: tenant?.name ?? invoice?.tenant ?? '',
      tenantId: tenant?.id ?? null,
      property: property?.name ?? invoice?.property ?? '',
      propertyId: property?.id ?? null,
      contractId: contractId ? Number(contractId) : null,
      period: type === 'Huur' && form.get('period') ? String(form.get('period')) : null,
      amount: Number(amount),
      issueDate,
      dueDate,
      notes: String(form.get('notes') ?? ''),
    }, invoice?.id)
    setBusy(false)
    if (saved) {
      notify(invoice ? 'Factuur bijgewerkt' : `Factuur ${(saved as Invoice).number} aangemaakt`)
      onClose()
    }
  }

  const contracts = records.contracts.filter(c => !tenantId || c.tenantId === Number(tenantId) || c.tenant === tenantById(Number(tenantId))?.name)
  return (
    <Modal title={invoice ? `Factuur ${invoice.number} bewerken` : 'Nieuwe factuur'} eyebrow="FACTUREN" onClose={onClose} onSubmit={submit}
      actions={<><button type="button" className="button ghost" onClick={onClose}>Annuleren</button><button className="button" disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button></>}>
      <div className="form-grid">
        <label>Huurder
          <select value={tenantId} onChange={event => chooseTenant(event.target.value)}>
            <option value="">{invoice?.tenant && !invoice.tenantId ? `${invoice.tenant} (niet gekoppeld)` : '— Kies een huurder —'}</option>
            {records.tenants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Woning
          <select value={propertyId} onChange={event => setPropertyId(event.target.value)}>
            <option value="">{invoice?.property && !invoice.propertyId ? `${invoice.property} (niet gekoppeld)` : '— Kies een woning —'}</option>
            {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Contract (optioneel)
          <select value={contractId} onChange={event => setContractId(event.target.value)}>
            <option value="">— Geen —</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.property} — {c.tenant}</option>)}
          </select>
        </label>
        <label>Soort
          <select value={type} onChange={event => setType(event.target.value as InvoiceType)}>{TYPES.map(item => <option key={item}>{item}</option>)}</select>
        </label>
        <label className="wide-field">Omschrijving<abbr title="Verplicht"> *</abbr><input name="description" defaultValue={invoice?.description ?? ''} required placeholder="bijv. Huur december 2026" /></label>
        <label>Bedrag (€)<abbr title="Verplicht"> *</abbr><input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
        {type === 'Huur' ? <label>Huurperiode<input name="period" type="month" defaultValue={invoice?.period ?? monthKey(today())} /></label> : <span />}
        <label>Factuurdatum<input type="date" value={issueDate} onChange={event => setIssueDate(event.target.value)} required /></label>
        <label>Vervaldatum<input type="date" value={dueDate} min={issueDate} onChange={event => setDueDate(event.target.value)} required /></label>
        <label>Factuurnummer<input name="number" defaultValue={invoice?.number ?? ''} placeholder="automatisch" /></label>
        <label className="wide-field">Notities<textarea name="notes" rows={2} defaultValue={invoice?.notes ?? ''} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  )
}

function PaymentForm({ payment, invoice, views, onClose }: { payment?: Payment; invoice?: InvoiceView; views: InvoiceView[]; onClose: () => void }) {
  const { records, properties, saveRecord, notify } = useApp()
  const { tenantById, propertyById } = useLinks()
  const [invoiceId, setInvoiceId] = useState(String(payment?.invoiceId ?? invoice?.id ?? ''))
  const linked = views.find(view => String(view.id) === invoiceId)
  const [amount, setAmount] = useState(payment ? String(payment.amount) : invoice ? String(invoice.balance) : '')
  const [tenantId, setTenantId] = useState(String(payment?.tenantId ?? invoice?.tenantId ?? ''))
  const [propertyId, setPropertyId] = useState(String(payment?.propertyId ?? invoice?.propertyId ?? ''))
  const [busy, setBusy] = useState(false)
  // Saldo van de factuur exclusief deze betaling (bij bewerken).
  const balanceBefore = linked ? linked.balance + (payment && payment.invoiceId === linked.id ? payment.amount : 0) : 0
  const over = linked && Number(amount) > balanceBefore + 0.005

  const chooseInvoice = (id: string) => {
    setInvoiceId(id)
    const view = views.find(item => String(item.id) === id)
    if (!view) return
    if (!payment) setAmount(String(view.balance))
    setTenantId(String(view.tenantId ?? ''))
    setPropertyId(String(view.propertyId ?? ''))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const tenant = tenantById(Number(tenantId))
    const property = propertyById(Number(propertyId))
    setBusy(true)
    const saved = await saveRecord('payments', {
      amount: Number(amount),
      receivedOn: String(form.get('receivedOn')),
      method: String(form.get('method')),
      reference: String(form.get('reference') ?? ''),
      invoiceId: linked ? linked.id : null,
      tenant: tenant?.name ?? linked?.tenant ?? payment?.tenant ?? '',
      tenantId: tenant?.id ?? null,
      property: property?.name ?? linked?.property ?? payment?.property ?? '',
      propertyId: property?.id ?? null,
      note: String(form.get('note') ?? ''),
    }, payment?.id)
    setBusy(false)
    if (saved) {
      notify(payment ? 'Betaling bijgewerkt' : 'Betaling geregistreerd')
      onClose()
    }
  }

  const openInvoices = views.filter(view => view.balance > 0 || view.id === payment?.invoiceId || view.id === invoice?.id)
  return (
    <Modal title={payment ? 'Betaling bewerken' : 'Betaling registreren'} eyebrow="BETALINGEN" onClose={onClose} onSubmit={submit}
      actions={<><button type="button" className="button ghost" onClick={onClose}>Annuleren</button><button className="button" disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button></>}>
      <div className="form-grid">
        <label className="wide-field">Factuur
          <select value={invoiceId} onChange={event => chooseInvoice(event.target.value)}>
            <option value="">— Nog niet koppelen —</option>
            {openInvoices.map(view => <option key={view.id} value={view.id}>{view.number} · {view.tenant || 'onbekende huurder'} · {view.description} · open {money(view.balance)}</option>)}
          </select>
          {linked && <small className="field-hint">Factuurbedrag {money(linked.amount)}, al betaald {money(linked.paid - (payment?.invoiceId === linked.id ? payment.amount : 0))}, open {money(balanceBefore)}.</small>}
        </label>
        <label>Bedrag (€)<abbr title="Verplicht"> *</abbr><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
        <label>Ontvangen op<input name="receivedOn" type="date" defaultValue={payment?.receivedOn ?? today()} required /></label>
        <label>Huurder
          <select value={tenantId} onChange={event => setTenantId(event.target.value)} disabled={Boolean(linked?.tenantId)}>
            <option value="">{payment?.tenant && !payment.tenantId ? `${payment.tenant} (niet gekoppeld)` : '— Onbekend —'}</option>
            {records.tenants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Woning
          <select value={propertyId} onChange={event => setPropertyId(event.target.value)} disabled={Boolean(linked?.propertyId)}>
            <option value="">{payment?.property && !payment.propertyId ? `${payment.property} (niet gekoppeld)` : '— Onbekend —'}</option>
            {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Betaalmethode<select name="method" defaultValue={payment?.method ?? 'Overboeking'}>{METHODS.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Referentie / omschrijving bank<input name="reference" defaultValue={payment?.reference ?? ''} placeholder="bijv. betalingskenmerk" /></label>
        <label className="wide-field">Notitie<input name="note" defaultValue={payment?.note ?? ''} /></label>
      </div>
      {over && <p className="form-error" role="status">Let op: dit bedrag is {money(Number(amount) - balanceBefore)} hoger dan het openstaande saldo. Het teveel betaalde blijft zichtbaar als overbetaling.</p>}
    </Modal>
  )
}

/* ---------- Factuurdetail ---------- */

function InvoiceDetail({ view, onClose, onEdit, onPay, onEditPayment }: { view: InvoiceView; onClose: () => void; onEdit: () => void; onPay: () => void; onEditPayment: (payment: Payment) => void }) {
  const { saveRecord, removeRecord, confirm, notify } = useApp()
  const cancelled = view.state === 'Geannuleerd'
  const toggleCancel = async () => {
    if (!cancelled && !(await confirm(`Factuur ${view.number} wordt geannuleerd en telt niet meer mee als openstaand.`, 'Annuleren'))) return
    if (await saveRecord('invoices', { status: cancelled ? 'Open' : 'Geannuleerd' }, view.id)) notify(cancelled ? 'Factuur heropend' : 'Factuur geannuleerd')
  }
  const remove = async () => {
    if (!(await confirm(`Factuur ${view.number} wordt definitief verwijderd.`))) return
    if (await removeRecord('invoices', view.id)) { notify('Factuur verwijderd'); onClose() }
  }
  const unlink = async (payment: Payment) => {
    if (await saveRecord('payments', { invoiceId: null }, payment.id)) notify('Betaling losgekoppeld')
  }
  return (
    <Modal wide eyebrow={`FACTUUR ${view.number}`} title={view.description} subtitle={[view.tenant, view.property].filter(Boolean).join(' · ')} onClose={onClose}
      actions={
        <>
          {view.payments.length === 0 && <button type="button" className="button ghost danger" onClick={remove}><Icon name="trash" size={15} /> Verwijderen</button>}
          <button type="button" className="button ghost" onClick={toggleCancel}>{cancelled ? 'Heropenen' : 'Annuleren'}</button>
          <button type="button" className="button ghost" onClick={onEdit}><Icon name="edit" size={15} /> Bewerken</button>
          {!cancelled && view.balance > 0 && <button type="button" className="button" onClick={onPay}><Icon name="check" size={15} /> Betaling registreren</button>}
        </>
      }>
      <div className="contract-status-row">
        <Status value={stateClass(view.state)} label={view.state} />
        {view.daysOverdue > 0 && <strong className="overdue-days">{view.daysOverdue} dagen te laat</strong>}
      </div>
      <dl className="facts">
        {([
          ['Soort', view.type], ['Factuurdatum', formatDate(view.issueDate)], ['Vervaldatum', formatDate(view.dueDate)],
          ['Bedrag', money(view.amount)], ['Betaald', money(view.paid)], ['Openstaand', money(view.balance)],
          ...(view.period ? [['Huurperiode', view.period]] : []),
        ] as [string, string][]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {view.paid > view.amount + 0.005 && <p className="form-error">Overbetaling van {money(view.paid - view.amount)}.</p>}
      <div className="panel invoice-payments">
        <PanelHeading title="Betalingen" subtitle={view.payments.length ? `${view.payments.length} betaling(en)` : 'Nog geen betalingen ontvangen'} />
        {view.payments.length > 0 && (
          <table>
            <thead><tr><th>Datum</th><th>Methode</th><th>Referentie</th><th className="right">Bedrag</th><th /></tr></thead>
            <tbody>
              {view.payments.map(payment => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.receivedOn)}</td><td>{payment.method}</td><td>{payment.reference || '—'}</td>
                  <td className="right"><strong>{money(payment.amount)}</strong></td>
                  <td className="right row-actions">
                    <button type="button" className="icon-button" aria-label="Betaling bewerken" onClick={() => onEditPayment(payment)}><Icon name="edit" size={15} /></button>
                    <button type="button" className="link-button" onClick={() => unlink(payment)}>Ontkoppelen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {view.notes && <div className="contract-notes"><h3>Notities</h3><p>{view.notes}</p></div>}
    </Modal>
  )
}

/* ---------- Overzicht ---------- */

function GroupTable({ title, subtitle, rows, onPick }: { title: string; subtitle: string; rows: GroupRow[]; onPick: (row: GroupRow) => void }) {
  return (
    <div className="panel">
      <PanelHeading title={title} subtitle={subtitle} />
      {rows.length === 0 ? <p className="muted pad">Nog geen gegevens.</p> : (
        <div className="table-scroll">
          <table className="clickable-rows">
            <thead><tr><th>Naam</th><th className="right">Gefactureerd</th><th className="right">Ontvangen</th><th className="right">Openstaand</th><th className="right">Achterstallig</th><th>Oudste achterstand</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} onClick={() => onPick(row)}>
                  <td><button type="button" className="link-button strong" onClick={event => { event.stopPropagation(); onPick(row) }}>{row.label}</button></td>
                  <td className="right">{money(row.invoiced)}</td>
                  <td className="right">{money(row.received)}</td>
                  <td className="right">{row.open ? <strong>{money(row.open)}</strong> : '—'}</td>
                  <td className="right">{row.overdue ? <span className="status s-achterstallig">{money(row.overdue)} ({row.overdueCount})</span> : '—'}</td>
                  <td>{row.oldestDue ? formatDate(row.oldestDue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ---------- Module ---------- */

export function FinanceModule({ focusInvoiceId, onFocusHandled }: { focusInvoiceId?: number | null; onFocusHandled?: () => void }) {
  const { records, properties, saveRecord, notify, user, loading } = useApp()
  const now = today()
  const [tab, setTab] = useState<Tab>('overzicht')
  const [filters, setFilters] = useState<Filters>({ period: 'alles', from: '', to: '', tenant: '', property: '' })
  const [stateFilter, setStateFilter] = useState<'' | InvoiceState | 'Open'>('')
  const [methodFilter, setMethodFilter] = useState('')
  const [linkFilter, setLinkFilter] = useState<'' | 'gekoppeld' | 'los'>('')
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [invoiceForm, setInvoiceForm] = useState<Invoice | 'new' | null>(null)
  const [paymentForm, setPaymentForm] = useState<{ payment?: Payment; invoice?: InvoiceView } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (focusInvoiceId == null) return
    Promise.resolve().then(() => {
      setTab('facturen')
      setDetailId(focusInvoiceId)
      onFocusHandled?.()
    })
  }, [focusInvoiceId, onFocusHandled])

  const views = useMemo(() => invoiceViews(records.invoices, records.payments, now), [records.invoices, records.payments, now])
  const range = periodRange(filters)
  const inRange = (date: string) => !range || (date >= range.from && date <= range.to)
  const scopedViews = views.filter(view => matches(view, filters))
  const scopedPayments = records.payments.filter(payment => matches(payment, filters))
  const figures = totals(scopedViews, scopedPayments, range)
  const months = lastMonths(6)
  const chart = monthly(scopedViews, scopedPayments, months.map(month => month.key)).map((row, index) => ({
    ...row,
    label: months[index].label,
    costs: records.maintenance.filter(item => item.date && monthKey(item.date) === row.month).reduce((sum, item) => sum + (item.cost ?? 0), 0),
  }))
  const peak = Math.max(1, ...chart.flatMap(row => [row.invoiced, row.received, row.costs]))
  const buckets = aging(scopedViews)

  const tenantOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const tenant of records.tenants) map.set(`t${tenant.id}`, tenant.name)
    for (const item of [...records.invoices, ...records.payments]) { const key = tenantKey(item); if (key && !map.has(key.key)) map.set(key.key, key.label) }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]))
  }, [records.tenants, records.invoices, records.payments])
  const propertyOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const property of properties) map.set(`p${property.id}`, property.name)
    for (const item of [...records.invoices, ...records.payments]) { const key = propertyKey(item); if (key && !map.has(key.key)) map.set(key.key, key.label) }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]))
  }, [properties, records.invoices, records.payments])

  const needle = query.trim().toLowerCase()
  // Openstaande en achterstallige posten zijn een stand van vandaag: daarop werkt de periodefilter niet.
  const periodApplies = stateFilter !== 'Achterstallig' && stateFilter !== 'Open'
  const invoiceRows = scopedViews
    .filter(view => !periodApplies || inRange(view.issueDate))
    .filter(view => !stateFilter || (stateFilter === 'Open' ? view.balance > 0 && view.state !== 'Geannuleerd' : view.state === stateFilter))
    .filter(view => !needle || `${view.number} ${view.description} ${view.tenant ?? ''} ${view.property ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number))
  const invoiceNumber = (id?: number) => views.find(view => view.id === id)?.number
  const paymentRows = scopedPayments
    .filter(payment => inRange(payment.receivedOn))
    .filter(payment => !methodFilter || payment.method === methodFilter)
    .filter(payment => !linkFilter || (linkFilter === 'los' ? !payment.invoiceId : Boolean(payment.invoiceId)))
    .filter(payment => !needle || `${payment.reference ?? ''} ${payment.tenant ?? ''} ${payment.property ?? ''} ${invoiceNumber(payment.invoiceId) ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))
  const unlinked = records.payments.filter(payment => !payment.invoiceId).length

  const generateRent = async () => {
    setBusy(true)
    const month = monthKey(now)
    const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date())
    const start = `${month}-01`
    let created = 0
    for (const contract of records.contracts) {
      if (contract.status !== 'Actief' || !contract.rent || contract.start > toIso(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0)) || (contract.end && contract.end < start)) continue
      const exists = records.invoices.some(invoice => invoice.contractId === contract.id && invoice.period === month && invoice.status !== 'Geannuleerd')
      if (exists) continue
      const tenant = records.tenants.find(item => item.id === contract.tenantId || item.name === contract.tenant)
      const property = properties.find(item => item.id === contract.propertyId || item.name === contract.property)
      const saved = await saveRecord('invoices', {
        description: `Huur ${label} — ${contract.property}`, type: 'Huur', period: month,
        tenant: contract.tenant, tenantId: tenant?.id ?? null, property: contract.property, propertyId: property?.id ?? null, contractId: contract.id,
        amount: contract.rent, issueDate: start < now ? start : now, dueDate: addDays(start, user.settings.defaultPaymentTermDays), status: 'Open',
      })
      if (saved) created += 1
    }
    setBusy(false)
    notify(created ? `${created} huurfactu${created > 1 ? 'ren' : 'ur'} aangemaakt voor ${label}` : `Alle actieve contracten zijn voor ${label} al gefactureerd`)
  }

  const pick = (field: 'tenant' | 'property') => (row: GroupRow) => {
    setFilters(current => ({ ...current, [field]: row.key }))
    setStateFilter(row.overdue ? 'Achterstallig' : '')
    setTab('facturen')
  }

  const detail = views.find(view => view.id === detailId)
  const filterCount = [filters.tenant, filters.property, filters.period !== 'alles'].filter(Boolean).length

  return (
    <>
      <PageHead eyebrow="FINANCIEEL" title="Betalingen" description="Facturen, ontvangen betalingen en achterstanden per huurder en woning.">
        <button type="button" className="button ghost" disabled={busy} onClick={generateRent}><Icon name="euro" size={16} /> {busy ? 'Bezig…' : 'Huur deze maand factureren'}</button>
        <button type="button" className="button ghost" onClick={() => setInvoiceForm('new')}><Icon name="file" size={16} /> Nieuwe factuur</button>
        <button type="button" className="button" onClick={() => setPaymentForm({})}><Icon name="check" size={16} /> Betaling registreren</button>
      </PageHead>

      <div className="panel finance-filters">
        <label>Periode
          <select value={filters.period} onChange={event => setFilters(current => ({ ...current, period: event.target.value as PeriodKey }))}>
            {(Object.keys(periodLabels) as PeriodKey[]).map(key => <option key={key} value={key}>{periodLabels[key]}</option>)}
          </select>
        </label>
        {filters.period === 'aangepast' && <>
          <label>Van<input type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} /></label>
          <label>Tot en met<input type="date" value={filters.to} min={filters.from} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} /></label>
        </>}
        <label>Huurder
          <select value={filters.tenant} onChange={event => setFilters(current => ({ ...current, tenant: event.target.value }))}>
            <option value="">Alle huurders</option>
            {tenantOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>Woning
          <select value={filters.property} onChange={event => setFilters(current => ({ ...current, property: event.target.value }))}>
            <option value="">Alle woningen</option>
            {propertyOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        {filterCount > 0 && <button type="button" className="link-button" onClick={() => { setFilters({ period: 'alles', from: '', to: '', tenant: '', property: '' }); setStateFilter('') }}>Filters wissen</button>}
      </div>

      <div className="stats-grid">
        <Stat label="Ontvangen" value={money(figures.received)} trend={filters.period === 'alles' ? 'Totaal' : periodLabels[filters.period]} icon="euro" tone="sage" />
        <Stat label="Gefactureerd" value={money(figures.invoiced)} trend={filters.period === 'alles' ? 'Totaal' : periodLabels[filters.period]} icon="file" />
        <Stat label="Openstaand" value={money(figures.open)} trend={`${figures.openCount} factu${figures.openCount === 1 ? 'ur' : 'ren'} · per vandaag`} icon="calc" tone="gold" />
        <Stat label="Achterstallig" value={money(figures.overdue)} trend={figures.overdueCount ? `${figures.overdueCount} factu${figures.overdueCount === 1 ? 'ur' : 'ren'} over de vervaldatum` : 'Geen achterstanden'} icon="alert" tone={figures.overdueCount ? 'red' : 'sage'} />
      </div>

      <nav className="tabs" aria-label="Onderdelen">
        {(['overzicht', 'facturen', 'betalingen'] as Tab[]).map(item => (
          <button key={item} type="button" className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>
            {item === 'overzicht' ? 'Overzicht' : item === 'facturen' ? `Facturen (${scopedViews.length})` : `Betalingen (${scopedPayments.length})`}
            {item === 'betalingen' && unlinked > 0 && <span className="nav-count" title="Niet gekoppeld aan een factuur">{unlinked}</span>}
          </button>
        ))}
      </nav>

      {loading ? <p className="muted pad">Laden…</p> : tab === 'overzicht' ? (
        <div className="stack">
          <div className="grid-main">
            <div className="panel chart-panel">
              <PanelHeading title="Gefactureerd en ontvangen" subtitle="Laatste 6 maanden, met onderhoudskosten" />
              {chart.some(row => row.invoiced || row.received || row.costs) ? (
                <div className="bar-chart" role="img" aria-label="Staafdiagram van gefactureerd, ontvangen en onderhoudskosten per maand">
                  {chart.map(row => (
                    <div className="bar-column" key={row.month}>
                      <div className="bars">
                        <div className="bar invoiced" style={{ height: `${(row.invoiced / peak) * 100}%` }} title={`Gefactureerd ${money(row.invoiced)}`} />
                        <div className="bar income" style={{ height: `${(row.received / peak) * 100}%` }} title={`Ontvangen ${money(row.received)}`} />
                        <div className="bar cost" style={{ height: `${(row.costs / peak) * 100}%` }} title={`Onderhoudskosten ${money(row.costs)}`} />
                      </div>
                      <span>{row.label}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="muted pad">Nog geen facturen of betalingen om weer te geven.</p>}
              <div className="chart-legend"><span><i className="dot invoiced-dot" /> Gefactureerd</span><span><i className="dot navy" /> Ontvangen</span><span><i className="dot gold" /> Onderhoudskosten</span></div>
            </div>
            <div className="panel">
              <PanelHeading title="Ouderdom achterstanden" subtitle="Openstaand saldo na de vervaldatum" />
              <ul className="aging">
                {buckets.map(bucket => (
                  <li key={bucket.label}>
                    <span>{bucket.label}</span>
                    <div><i style={{ width: `${figures.overdue ? (bucket.amount / figures.overdue) * 100 : 0}%` }} className={bucket.min > 60 ? 'bad' : ''} /></div>
                    <strong>{money(bucket.amount)}</strong>
                    <small>{bucket.count}</small>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <GroupTable title="Per huurder" subtitle="Klik op een huurder om de facturen te zien" rows={groupBy(scopedViews, scopedPayments.filter(payment => inRange(payment.receivedOn)), tenantKey)} onPick={pick('tenant')} />
          <GroupTable title="Per woning" subtitle="Klik op een woning om de facturen te zien" rows={groupBy(scopedViews, scopedPayments.filter(payment => inRange(payment.receivedOn)), propertyKey)} onPick={pick('property')} />
        </div>
      ) : tab === 'facturen' ? (
        <div className="panel">
          <div className="table-tools">
            <div className="search"><Icon name="search" size={16} /><input className="global-search" aria-label="Zoek in facturen" placeholder="Zoek op nummer, omschrijving, huurder…" value={query} onChange={event => setQuery(event.target.value)} /></div>
            <select className="filter-select" aria-label="Status" value={stateFilter} onChange={event => setStateFilter(event.target.value as typeof stateFilter)}>
              <option value="">Status: alle</option>
              <option value="Open">Nog te betalen</option>
              {invoiceStates.map(state => <option key={state}>{state}</option>)}
            </select>
            <button type="button" className="button ghost small" disabled={!invoiceRows.length} onClick={() => downloadCsv('facturen.csv', [
              ['Nummer', 'Huurder', 'Woning', 'Soort', 'Omschrijving', 'Factuurdatum', 'Vervaldatum', 'Bedrag', 'Betaald', 'Openstaand', 'Status'],
              ...invoiceRows.map(view => [view.number, view.tenant, view.property, view.type, view.description, view.issueDate, view.dueDate, view.amount, view.paid, view.balance, view.state]),
            ])}><Icon name="download" size={15} /> Exporteren</button>
          </div>
          {records.invoices.length === 0 ? (
            <EmptyState icon="file" title="Nog geen facturen" text="Maak een factuur aan, of factureer met één klik de huur voor alle actieve contracten." action={<button type="button" className="button" onClick={generateRent}>Huur deze maand factureren</button>} />
          ) : invoiceRows.length === 0 ? <EmptyState icon="search" title="Geen facturen" text="Pas de filters aan." /> : (
            <div className="table-scroll">
              <table className="clickable-rows">
                <thead><tr><th>Nummer</th><th>Huurder</th><th>Woning</th><th>Omschrijving</th><th>Vervaldatum</th><th className="right">Bedrag</th><th className="right">Openstaand</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {invoiceRows.map(view => (
                    <tr key={view.id} onClick={() => setDetailId(view.id)}>
                      <td><button type="button" className="link-button strong" onClick={event => { event.stopPropagation(); setDetailId(view.id) }}>{view.number}</button></td>
                      <td>{view.tenant || '—'}</td>
                      <td>{view.property || '—'}</td>
                      <td>{view.description}<small className="table-sub muted">{view.type}</small></td>
                      <td>{formatDate(view.dueDate)}{view.daysOverdue > 0 && <small className="table-sub">{view.daysOverdue} dagen te laat</small>}</td>
                      <td className="right">{money(view.amount)}</td>
                      <td className="right"><strong>{view.balance > 0 ? money(view.balance) : '—'}</strong></td>
                      <td><Status value={stateClass(view.state)} label={view.state} /></td>
                      <td className="right row-actions" onClick={event => event.stopPropagation()}>
                        {view.balance > 0 && view.state !== 'Geannuleerd' && <button type="button" className="button ghost small" onClick={() => setPaymentForm({ invoice: view })}><Icon name="check" size={14} /> Betaald</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="panel">
          <div className="table-tools">
            <div className="search"><Icon name="search" size={16} /><input className="global-search" aria-label="Zoek in betalingen" placeholder="Zoek op referentie, huurder, factuur…" value={query} onChange={event => setQuery(event.target.value)} /></div>
            <select className="filter-select" aria-label="Betaalmethode" value={methodFilter} onChange={event => setMethodFilter(event.target.value)}>
              <option value="">Methode: alle</option>
              {METHODS.map(method => <option key={method}>{method}</option>)}
            </select>
            <select className="filter-select" aria-label="Koppeling" value={linkFilter} onChange={event => setLinkFilter(event.target.value as typeof linkFilter)}>
              <option value="">Koppeling: alle</option>
              <option value="gekoppeld">Gekoppeld aan factuur</option>
              <option value="los">Niet gekoppeld</option>
            </select>
            <button type="button" className="button ghost small" disabled={!paymentRows.length} onClick={() => downloadCsv('betalingen.csv', [
              ['Datum', 'Huurder', 'Woning', 'Factuur', 'Methode', 'Referentie', 'Bedrag'],
              ...paymentRows.map(payment => [payment.receivedOn, payment.tenant, payment.property, invoiceNumber(payment.invoiceId) ?? '', payment.method, payment.reference, payment.amount]),
            ])}><Icon name="download" size={15} /> Exporteren</button>
          </div>
          {records.payments.length === 0 ? (
            <EmptyState icon="euro" title="Nog geen betalingen" text="Registreer ontvangen betalingen en koppel ze aan een factuur." action={<button type="button" className="button" onClick={() => setPaymentForm({})}>Betaling registreren</button>} />
          ) : paymentRows.length === 0 ? <EmptyState icon="search" title="Geen betalingen" text="Pas de filters aan." /> : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Ontvangen op</th><th>Huurder</th><th>Woning</th><th>Factuur</th><th>Methode</th><th>Referentie</th><th className="right">Bedrag</th><th /></tr></thead>
                <tbody>
                  {paymentRows.map(payment => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.receivedOn)}</td>
                      <td>{payment.tenant || '—'}</td>
                      <td>{payment.property || '—'}</td>
                      <td>{payment.invoiceId ? <button type="button" className="link-button strong" onClick={() => setDetailId(payment.invoiceId!)}>{invoiceNumber(payment.invoiceId) ?? 'Verwijderd'}</button> : <button type="button" className="status tone-warn link-status" onClick={() => setPaymentForm({ payment })}>Niet gekoppeld · koppelen</button>}</td>
                      <td>{payment.method}</td>
                      <td>{payment.reference || '—'}</td>
                      <td className="right"><strong>{money(payment.amount)}</strong></td>
                      <td className="right row-actions"><PaymentRowActions payment={payment} onEdit={() => setPaymentForm({ payment })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {detail && !invoiceForm && !paymentForm && (
        <InvoiceDetail view={detail} onClose={() => setDetailId(null)} onEdit={() => setInvoiceForm(detail)} onPay={() => setPaymentForm({ invoice: detail })} onEditPayment={payment => setPaymentForm({ payment })} />
      )}
      {invoiceForm && <InvoiceForm invoice={invoiceForm === 'new' ? undefined : invoiceForm} onClose={() => setInvoiceForm(null)} />}
      {paymentForm && <PaymentForm payment={paymentForm.payment} invoice={paymentForm.invoice} views={views} onClose={() => setPaymentForm(null)} />}
    </>
  )
}

function PaymentRowActions({ payment, onEdit }: { payment: Payment; onEdit: () => void }) {
  const { removeRecord, confirm, notify } = useApp()
  return (
    <>
      <button type="button" className="icon-button" aria-label="Bewerken" onClick={onEdit}><Icon name="edit" size={16} /></button>
      <button type="button" className="icon-button danger-icon" aria-label="Verwijderen" onClick={async () => {
        if (!(await confirm(`Betaling van ${money(payment.amount)} wordt verwijderd. Een gekoppelde factuur staat daarna weer open.`))) return
        if (await removeRecord('payments', payment.id)) notify('Betaling verwijderd')
      }}><Icon name="trash" size={16} /></button>
    </>
  )
}

