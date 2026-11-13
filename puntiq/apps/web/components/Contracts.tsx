'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, PanelHeading, Stat, Status } from './ui'
import { contractState, daysUntilEnd } from '../lib/notifications'
import { daysBetween, downloadCsv, formatBytes, formatDate, money, readFileAsDataUrl, today } from '../lib/format'
import type { Contract, ContractTerm, DocumentItem, Property, Tenant } from '../lib/types'

const MAX_UPLOAD = 5 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg'
const PREVIEWABLE = ['application/pdf', 'image/png', 'image/jpeg']
const STATES = ['Concept', 'Actief', 'Verloopt binnenkort', 'Verlopen', 'Beëindigd']

/* ---------- Helpers ---------- */

function useLinks() {
  const { properties, records } = useApp()
  return useMemo(() => {
    const propertyOf = (contract: Contract): Property | undefined =>
      properties.find(item => item.id === contract.propertyId) ?? properties.find(item => item.name === contract.property)
    const tenantOf = (contract: Contract): Tenant | undefined =>
      records.tenants.find(item => item.id === contract.tenantId) ?? records.tenants.find(item => item.name === contract.tenant)
    const documentsOf = (contract: Contract): DocumentItem[] => records.documents.filter(doc => doc.contractId === contract.id)
    return { propertyOf, tenantOf, documentsOf }
  }, [properties, records.tenants, records.documents])
}

function remaining(contract: Contract) {
  const left = daysUntilEnd(contract)
  if (left === null) return 'Onbepaalde tijd'
  if (contract.status !== 'Actief') return formatDate(contract.end)
  if (left < 0) return `${-left} ${left === -1 ? 'dag' : 'dagen'} verlopen`
  if (left === 0) return 'Loopt vandaag af'
  return `Nog ${left} ${left === 1 ? 'dag' : 'dagen'}`
}

async function uploadDocument(saveRecord: ReturnType<typeof useApp>['saveRecord'], file: File, contract: Contract, name?: string) {
  if (file.size > MAX_UPLOAD) throw new Error('Het bestand is groter dan 5 MB.')
  return saveRecord('documents', {
    file: await readFileAsDataUrl(file),
    name: name?.trim() || file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    category: 'Contracten',
    property: contract.property,
    contractId: contract.id,
    date: today(),
  })
}

/* ---------- Formulier ---------- */

const NEW_TENANT = '__nieuw__'

function ContractForm({ contract, onClose, onSaved }: { contract?: Contract; onClose: () => void; onSaved: (contract: Contract) => void }) {
  const { properties, records, saveRecord, notify } = useApp()
  const { propertyOf, tenantOf } = useLinks()
  const [propertyId, setPropertyId] = useState(() => String(contract ? propertyOf(contract)?.id ?? '' : ''))
  const [tenantId, setTenantId] = useState(() => String(contract ? tenantOf(contract)?.id ?? '' : ''))
  const [newTenant, setNewTenant] = useState('')
  const [term, setTerm] = useState<ContractTerm>(contract?.term ?? (contract?.end ? 'Bepaalde tijd' : 'Onbepaalde tijd'))
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Oudere contracten zonder koppeling: toon de oude naam als keuze, zodat er niets verloren gaat.
  const legacyProperty = contract && !propertyOf(contract) ? contract.property : ''
  const legacyTenant = contract && !tenantOf(contract) ? contract.tenant : ''

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null
    if (chosen && chosen.size > MAX_UPLOAD) {
      setError('Het bestand is groter dan 5 MB.')
      event.target.value = ''
      return
    }
    setError('')
    setFile(chosen)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const property = properties.find(item => String(item.id) === propertyId)
    const propertyName = property?.name ?? (propertyId === 'legacy' ? legacyProperty : '')
    if (!propertyName) return setError('Kies de woning waar dit contract bij hoort.')
    const start = String(form.get('start'))
    const end = term === 'Bepaalde tijd' ? String(form.get('end') || '') : ''
    if (term === 'Bepaalde tijd' && !end) return setError('Vul de einddatum in.')
    if (end && end <= start) return setError('De einddatum moet na de startdatum liggen.')
    setBusy(true)
    setError('')

    let tenant: Tenant | undefined = records.tenants.find(item => String(item.id) === tenantId)
    let tenantName = tenant?.name ?? (tenantId === 'legacy' ? legacyTenant : '')
    if (tenantId === NEW_TENANT) {
      if (!newTenant.trim()) {
        setBusy(false)
        return setError('Vul de naam van de nieuwe huurder in.')
      }
      const created = await saveRecord('tenants', { name: newTenant.trim(), status: 'Actief', property: propertyName })
      if (!created) return setBusy(false)
      tenant = created as Tenant
      tenantName = tenant.name
    }
    if (!tenantName) {
      setBusy(false)
      return setError('Kies de huurder.')
    }

    const saved = await saveRecord('contracts', {
      property: propertyName,
      propertyId: property?.id ?? null,
      tenant: tenantName,
      tenantId: tenant?.id ?? null,
      term,
      start,
      end: end || null,
      rent: form.get('rent') || null,
      deposit: form.get('deposit') || null,
      status: String(form.get('status')),
      notes: String(form.get('notes') ?? ''),
    }, contract?.id)
    if (!saved) return setBusy(false)
    if (file) {
      try {
        if (!(await uploadDocument(saveRecord, file, saved as Contract))) notify('Contract opgeslagen, maar het bestand kon niet worden geüpload.', 'error')
      } catch (problem) {
        notify(problem instanceof Error ? problem.message : 'Bestand kon niet worden gelezen.', 'error')
      }
    }
    notify(contract ? 'Contract bijgewerkt' : 'Contract toegevoegd')
    onSaved(saved as Contract)
  }

  return (
    <Modal
      title={contract ? 'Contract bewerken' : 'Nieuw huurcontract'}
      eyebrow="CONTRACTEN"
      onClose={onClose}
      onSubmit={submit}
      actions={<><button type="button" className="button ghost" onClick={onClose}>Annuleren</button><button className="button" disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button></>}
    >
      <div className="form-grid">
        <label className="wide-field">Woning<abbr title="Verplicht"> *</abbr>
          <select value={propertyId} onChange={event => setPropertyId(event.target.value)} required>
            <option value="">— Kies een woning —</option>
            {legacyProperty && <option value="legacy">{legacyProperty} (niet gekoppeld)</option>}
            {properties.map(item => <option key={item.id} value={item.id}>{item.name}{item.address ? ` — ${item.address}` : ''}</option>)}
          </select>
          {!properties.length && <small className="field-hint">U heeft nog geen woningen. Voeg eerst een woning toe onder Vastgoed.</small>}
        </label>
        <label className="wide-field">Huurder<abbr title="Verplicht"> *</abbr>
          <select value={tenantId} onChange={event => setTenantId(event.target.value)} required>
            <option value="">— Kies een huurder —</option>
            {legacyTenant && <option value="legacy">{legacyTenant} (niet gekoppeld)</option>}
            {records.tenants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            <option value={NEW_TENANT}>+ Nieuwe huurder…</option>
          </select>
        </label>
        {tenantId === NEW_TENANT && <label className="wide-field">Naam nieuwe huurder<input value={newTenant} onChange={event => setNewTenant(event.target.value)} placeholder="bijv. Eva Jansen" autoFocus /></label>}
        <label>Looptijd
          <select value={term} onChange={event => setTerm(event.target.value as ContractTerm)}>
            <option>Onbepaalde tijd</option>
            <option>Bepaalde tijd</option>
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={contract?.status ?? 'Actief'}>
            <option>Concept</option><option>Actief</option><option>Beëindigd</option>
          </select>
        </label>
        <label>Startdatum<abbr title="Verplicht"> *</abbr><input name="start" type="date" defaultValue={contract?.start ?? today()} required /></label>
        {term === 'Bepaalde tijd'
          ? <label>Einddatum<abbr title="Verplicht"> *</abbr><input name="end" type="date" defaultValue={contract?.end ?? ''} required /></label>
          : <span className="muted small-text form-note">Geen einddatum bij onbepaalde tijd.</span>}
        <label>Huurprijs per maand (€)<input name="rent" type="number" min="0" step="0.01" defaultValue={contract?.rent ?? ''} placeholder="kale huur" /></label>
        <label>Waarborgsom (€)<input name="deposit" type="number" min="0" step="0.01" defaultValue={contract?.deposit ?? ''} /></label>
        <label className="wide-field">{contract ? 'Document toevoegen (optioneel)' : 'Huurcontract uploaden (optioneel)'}
          <input type="file" accept={ACCEPT} onChange={chooseFile} />
          <small className="field-hint">PDF, Word of afbeelding, maximaal 5 MB. Het bestand verschijnt ook onder Documenten.</small>
        </label>
        <label className="wide-field">Notities<textarea name="notes" rows={3} defaultValue={contract?.notes ?? ''} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  )
}

/* ---------- Detail ---------- */

function ContractDetail({ contract, onClose, onEdit }: { contract: Contract; onClose: () => void; onEdit: () => void }) {
  const { user, saveRecord, removeRecord, confirm, notify } = useApp()
  const { propertyOf, tenantOf, documentsOf } = useLinks()
  const property = propertyOf(contract)
  const tenant = tenantOf(contract)
  const documents = documentsOf(contract)
  const state = contractState(contract, user.settings.contractReminderDays)
  const [preview, setPreview] = useState<DocumentItem | null>(() => documents.find(doc => doc.hasFile && PREVIEWABLE.includes(doc.mime ?? '')) ?? null)
  const [action, setAction] = useState<null | 'verlengen' | 'beeindigen'>(null)
  const [busy, setBusy] = useState(false)

  const total = contract.end ? daysBetween(contract.start, contract.end) : null
  const elapsed = Math.max(0, daysBetween(contract.start, today()))
  const progress = total ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : null

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const saved = await uploadDocument(saveRecord, file, contract)
      if (saved) notify('Document toegevoegd')
    } catch (problem) {
      notify(problem instanceof Error ? problem.message : 'Bestand kon niet worden gelezen.', 'error')
    }
    setBusy(false)
  }

  const removeDocument = async (doc: DocumentItem) => {
    if (!(await confirm(`"${doc.name}" wordt definitief verwijderd.`))) return
    if (await removeRecord('documents', doc.id)) {
      if (preview?.id === doc.id) setPreview(null)
      notify('Document verwijderd')
    }
  }

  const applyAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const date = String(new FormData(event.currentTarget).get('date'))
    if (action === 'verlengen') {
      if (date <= (contract.end ?? contract.start)) return notify('De nieuwe einddatum moet na de huidige einddatum liggen.', 'error')
      if (await saveRecord('contracts', { end: date, term: 'Bepaalde tijd', status: 'Actief' }, contract.id)) notify(`Contract verlengd tot ${formatDate(date)}`)
    } else if (action === 'beeindigen') {
      if (date < contract.start) return notify('De einddatum ligt vóór de startdatum.', 'error')
      if (await saveRecord('contracts', { status: 'Beëindigd', terminatedOn: date, end: date }, contract.id)) notify('Contract beëindigd')
    }
    setAction(null)
  }

  const remove = async () => {
    const message = documents.length
      ? `Dit contract wordt verwijderd. De ${documents.length} gekoppelde document(en) blijven bewaard onder Documenten.`
      : 'Dit contract wordt definitief verwijderd.'
    if (!(await confirm(message, 'Contract verwijderen'))) return
    if (await removeRecord('contracts', contract.id)) {
      notify('Contract verwijderd')
      onClose()
    }
  }

  const facts: [string, string][] = [
    ['Startdatum', formatDate(contract.start)],
    ['Einddatum', contract.end ? formatDate(contract.end) : 'Onbepaalde tijd'],
    ['Looptijd', contract.term ?? (contract.end ? 'Bepaalde tijd' : 'Onbepaalde tijd')],
    ['Huurprijs', contract.rent ? `${money(contract.rent)} / maand` : '—'],
    ['Waarborgsom', contract.deposit ? money(contract.deposit) : '—'],
    ...(contract.terminatedOn ? [['Beëindigd per', formatDate(contract.terminatedOn)] as [string, string]] : []),
  ]

  return (
    <Modal
      wide
      eyebrow="HUURCONTRACT"
      title={`${contract.property} — ${contract.tenant}`}
      subtitle={remaining(contract)}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="button ghost danger" onClick={remove}><Icon name="trash" size={15} /> Verwijderen</button>
          {contract.status !== 'Beëindigd' && <button type="button" className="button ghost" onClick={() => setAction(action === 'beeindigen' ? null : 'beeindigen')}>Beëindigen</button>}
          {contract.status !== 'Beëindigd' && contract.end && <button type="button" className="button ghost" onClick={() => setAction(action === 'verlengen' ? null : 'verlengen')}>Verlengen</button>}
          <button type="button" className="button" onClick={onEdit}><Icon name="edit" size={15} /> Bewerken</button>
        </>
      }
    >
      <div className="contract-detail">
        <div className="contract-main">
          <div className="contract-status-row">
            <Status value={state} />
            {contract.rent ? <strong className="contract-rent">{money(contract.rent)} <small>per maand</small></strong> : null}
          </div>
          {progress !== null && (
            <div className="contract-progress" aria-label={`Looptijd ${Math.round(progress)}% verstreken`}>
              <div><span style={{ width: `${progress}%` }} className={state === 'Verloopt binnenkort' || state === 'Verlopen' ? 'warn' : ''} /></div>
              <small><span>{formatDate(contract.start)}</span><span>{formatDate(contract.end)}</span></small>
            </div>
          )}
          {action && (
            <form className="contract-action" onSubmit={applyAction}>
              <label>{action === 'verlengen' ? 'Nieuwe einddatum' : 'Contract eindigt per'}
                <input name="date" type="date" required defaultValue={action === 'beeindigen' ? today() : ''} min={action === 'verlengen' ? contract.end : contract.start} />
              </label>
              <button className="button small">{action === 'verlengen' ? 'Verlengen' : 'Beëindigen'}</button>
              <button type="button" className="button ghost small" onClick={() => setAction(null)}>Annuleren</button>
            </form>
          )}
          <dl className="facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>

          <div className="contract-links">
            <section>
              <h3><Icon name="building" size={16} /> Woning</h3>
              {property ? <p><strong>{property.name}</strong><br /><span className="muted">{property.address}</span></p> : <p className="muted">{contract.property} <em>(niet gekoppeld aan een woning)</em></p>}
            </section>
            <section>
              <h3><Icon name="user" size={16} /> Huurder</h3>
              {tenant ? (
                <p>
                  <strong>{tenant.name}</strong>
                  {tenant.email && <><br /><a href={`mailto:${tenant.email}`}>{tenant.email}</a></>}
                  {tenant.phone && <><br /><a href={`tel:${tenant.phone.replaceAll(' ', '')}`}>{tenant.phone}</a></>}
                </p>
              ) : <p className="muted">{contract.tenant} <em>(niet gekoppeld aan een huurder)</em></p>}
            </section>
          </div>
          {contract.notes && <div className="contract-notes"><h3>Notities</h3><p>{contract.notes}</p></div>}
        </div>

        <aside className="contract-docs">
          <PanelHeading title="Documenten" subtitle={documents.length ? `${documents.length} bestand(en)` : 'Nog geen bestanden'} />
          <ul>
            {documents.map(doc => (
              <li key={doc.id} className={preview?.id === doc.id ? 'active' : ''}>
                <Icon name="file" size={16} />
                <span><strong>{doc.name}</strong><small>{formatDate(doc.date)} · {formatBytes(doc.size)}</small></span>
                {doc.hasFile && PREVIEWABLE.includes(doc.mime ?? '') && <button type="button" className="icon-button" aria-label={`Bekijk ${doc.name}`} onClick={() => setPreview(doc)}><Icon name="search" size={15} /></button>}
                {doc.hasFile && <a className="icon-button" aria-label={`Download ${doc.name}`} href={`/api/records/documents/${doc.id}`}><Icon name="download" size={15} /></a>}
                <button type="button" className="icon-button danger-icon" aria-label={`Verwijder ${doc.name}`} onClick={() => removeDocument(doc)}><Icon name="trash" size={15} /></button>
              </li>
            ))}
          </ul>
          <label className={`button ghost small fit ${busy ? 'disabled' : ''}`}>
            <Icon name="plus" size={14} /> {busy ? 'Uploaden…' : 'Document uploaden'}
            <input type="file" accept={ACCEPT} onChange={upload} hidden disabled={busy} />
          </label>
          {preview && (
            <div className="contract-preview">
              {preview.mime === 'application/pdf'
                ? <iframe title={`Voorbeeld ${preview.name}`} src={`/api/records/documents/${preview.id}?inline=1`} />
                // eslint-disable-next-line @next/next/no-img-element
                : <img alt={`Voorbeeld ${preview.name}`} src={`/api/records/documents/${preview.id}?inline=1`} />}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  )
}

/* ---------- Module ---------- */

export function ContractsModule({ focusId, onFocusHandled }: { focusId?: number | null; onFocusHandled?: () => void }) {
  const { records, user, loading } = useApp()
  const { documentsOf } = useLinks()
  const reminderDays = user.settings.contractReminderDays
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)

  // Openen vanuit een melding of de zoekbalk.
  useEffect(() => {
    if (focusId == null) return
    Promise.resolve().then(() => {
      setDetailId(focusId)
      onFocusHandled?.()
    })
  }, [focusId, onFocusHandled])

  const rows = useMemo(() => records.contracts.map(contract => ({ contract, state: contractState(contract, reminderDays), left: daysUntilEnd(contract) })), [records.contracts, reminderDays])
  const active = rows.filter(row => row.state === 'Actief' || row.state === 'Verloopt binnenkort')
  const expiring = rows.filter(row => row.state === 'Verloopt binnenkort' || row.state === 'Verlopen').sort((a, b) => (a.left ?? 0) - (b.left ?? 0))
  const monthly = active.reduce((sum, row) => sum + (row.contract.rent ?? 0), 0)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows
      .filter(row => (!stateFilter || row.state === stateFilter) && (!needle || `${row.contract.property} ${row.contract.tenant} ${row.state}`.toLowerCase().includes(needle)))
      .sort((a, b) => STATES.indexOf(a.state) - STATES.indexOf(b.state) || (a.contract.end ?? '9999').localeCompare(b.contract.end ?? '9999'))
  }, [rows, query, stateFilter])

  const detail = records.contracts.find(contract => contract.id === detailId)

  return (
    <>
      <PageHead eyebrow="CONTRACTEN" title="Huurcontracten" description="Upload, bekijk en beheer huurcontracten. U krijgt een melding als een contract binnenkort afloopt.">
        <button type="button" className="button" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nieuw contract</button>
      </PageHead>

      <div className="stats-grid">
        <Stat label="Actieve contracten" value={String(active.length)} trend={`${records.contracts.length} in totaal`} icon="file" />
        <Stat label="Lopen binnenkort af" value={String(rows.filter(row => row.state === 'Verloopt binnenkort').length)} trend={`Binnen ${reminderDays} dagen`} icon="bell" tone="gold" />
        <Stat label="Verlopen, nog actief" value={String(rows.filter(row => row.state === 'Verlopen').length)} trend="Verlengen of beëindigen" icon="alert" tone={rows.some(row => row.state === 'Verlopen') ? 'red' : 'sage'} />
        <Stat label="Huur per maand" value={money(monthly)} trend="Actieve contracten" icon="euro" tone="sage" />
      </div>

      {expiring.length > 0 && (
        <div className="panel expiring-panel">
          <PanelHeading title="Aandacht nodig" subtitle={`Contracten die verlopen zijn of binnen ${reminderDays} dagen aflopen. Termijn aanpassen via Instellingen → Meldingen.`} />
          <ul>
            {expiring.map(({ contract, state }) => (
              <li key={contract.id}>
                <button type="button" onClick={() => setDetailId(contract.id)}>
                  <span className={`dot ${state === 'Verlopen' || (daysUntilEnd(contract) ?? 99) <= 30 ? 'urgent' : 'warning'}`} />
                  <span><strong>{contract.property}</strong><small>{contract.tenant}</small></span>
                  <em>{remaining(contract)}</em>
                  <time>{formatDate(contract.end)}</time>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <div className="table-tools">
          <div className="search">
            <Icon name="search" size={16} />
            <input className="global-search" aria-label="Zoek in contracten" placeholder="Zoek op woning of huurder…" value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <select className="filter-select" aria-label="Status" value={stateFilter} onChange={event => setStateFilter(event.target.value)}>
            <option value="">Status: alle</option>
            {STATES.map(state => <option key={state}>{state}</option>)}
          </select>
          <button type="button" className="button ghost small" disabled={!visible.length} onClick={() => downloadCsv('contracten.csv', [
            ['Woning', 'Huurder', 'Looptijd', 'Startdatum', 'Einddatum', 'Huur per maand', 'Waarborgsom', 'Status'],
            ...visible.map(({ contract, state }) => [contract.property, contract.tenant, contract.term ?? '', contract.start, contract.end ?? '', contract.rent, contract.deposit, state]),
          ])}>
            <Icon name="download" size={15} /> Exporteren
          </button>
        </div>
        {loading ? <p className="muted pad">Laden…</p> : records.contracts.length === 0 ? (
          <EmptyState icon="file" title="Nog geen contracten" text="Leg een huurcontract vast en upload de getekende overeenkomst. U krijgt automatisch een melding voordat het afloopt." action={<button type="button" className="button" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nieuw contract</button>} />
        ) : visible.length === 0 ? <EmptyState icon="search" title="Geen resultaten" text="Pas uw zoekopdracht of filter aan." /> : (
          <div className="table-scroll">
            <table className="clickable-rows">
              <thead><tr><th>Woning</th><th>Huurder</th><th>Startdatum</th><th>Einddatum</th><th className="right">Huur / maand</th><th>Status</th><th><span className="sr">Documenten</span></th></tr></thead>
              <tbody>
                {visible.map(({ contract, state }) => {
                  const docs = documentsOf(contract).length
                  return (
                    <tr key={contract.id} onClick={() => setDetailId(contract.id)}>
                      <td><button type="button" className="link-button strong" onClick={event => { event.stopPropagation(); setDetailId(contract.id) }}>{contract.property}</button></td>
                      <td>{contract.tenant}</td>
                      <td>{formatDate(contract.start)}</td>
                      <td>{contract.end ? <>{formatDate(contract.end)}{(state === 'Verloopt binnenkort' || state === 'Verlopen') && <small className="table-sub">{remaining(contract)}</small>}</> : <span className="muted">Onbepaald</span>}</td>
                      <td className="right"><strong>{contract.rent ? money(contract.rent) : '—'}</strong></td>
                      <td><Status value={state} /></td>
                      <td className="right muted">{docs > 0 && <span title={`${docs} document(en)`}><Icon name="file" size={15} /> {docs}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && !editing && <ContractDetail key={detail.id} contract={detail} onClose={() => setDetailId(null)} onEdit={() => setEditing(detail)} />}
      {editing && (
        <ContractForm
          contract={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={saved => { setEditing(null); setDetailId(saved.id) }}
        />
      )}
    </>
  )
}
