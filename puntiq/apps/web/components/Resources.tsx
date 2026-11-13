'use client'

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, Status } from './ui'
import { downloadCsv, formatBytes, formatDate, money, readFileAsDataUrl, today } from '../lib/format'
import type { DocumentItem, Maintenance, RecordKind, Tenant } from '../lib/types'

export type Field = {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'file'
  options?: string[]
  list?: string[]
  required?: boolean
  placeholder?: string
  wide?: boolean
  step?: string
}

export function RecordForm({ title, eyebrow, fields, initial, onClose, onSave }: {
  title: string
  eyebrow: string
  fields: Field[]
  initial?: Record<string, unknown>
  onClose: () => void
  onSave: (values: Record<string, unknown>) => Promise<boolean>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const values: Record<string, unknown> = {}
    try {
      for (const field of fields) {
        if (field.type !== 'file') values[field.name] = String(form.get(field.name) ?? '')
      }
      for (const field of fields) {
        if (field.type !== 'file') continue
        const file = form.get(field.name)
        if (file instanceof File && file.size > 0) {
          if (file.size > 5 * 1024 * 1024) throw new Error('Het bestand is groter dan 5 MB.')
          values.file = await readFileAsDataUrl(file)
          values.size = file.size
          values.mime = file.type || 'application/octet-stream'
          if (!String(values.name ?? '').trim()) values.name = file.name
        }
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Bestand kon niet worden gelezen.')
      setBusy(false)
      return
    }
    const ok = await onSave(values)
    if (!ok) setBusy(false)
  }

  return (
    <Modal
      title={title}
      eyebrow={eyebrow}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="button ghost" onClick={onClose}>Annuleren</button>
          <button className="button" disabled={busy}>{busy ? 'Bezig met opslaan…' : 'Opslaan'}</button>
        </>
      }
    >
      <div className="form-grid">
        {fields.map(field => {
          const value = initial?.[field.name]
          const defaultValue = value == null ? '' : String(value)
          const listId = field.list ? `list-${field.name}` : undefined
          return (
            <label key={field.name} className={field.wide || field.type === 'textarea' ? 'wide-field' : undefined}>
              {field.label}{field.required && <abbr title="Verplicht"> *</abbr>}
              {field.type === 'select' ? (
                <select name={field.name} defaultValue={defaultValue || field.options?.[0]}>
                  {field.options?.map(option => <option key={option}>{option}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea name={field.name} rows={3} defaultValue={defaultValue} placeholder={field.placeholder} />
              ) : field.type === 'file' ? (
                <input name={field.name} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv" required={field.required} />
              ) : (
                <input name={field.name} type={field.type ?? 'text'} defaultValue={defaultValue} placeholder={field.placeholder} required={field.required} list={listId} step={field.step} min={field.type === 'number' ? 0 : undefined} />
              )}
              {field.list && <datalist id={listId}>{field.list.map(option => <option key={option} value={option} />)}</datalist>}
            </label>
          )
        })}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  )
}

export type Column<T> = { label: string; render: (row: T) => ReactNode; sort?: (row: T) => string | number; align?: 'right' }

export function ResourceModule<T extends { id: number }>({ kind, eyebrow, title, description, addLabel, rows, columns, fields, filter, searchText, csv, rowActions, emptyText, defaults, extraActions, normalize }: {
  kind: RecordKind
  eyebrow: string
  title: string
  description: string
  addLabel: string
  rows: T[]
  columns: Column<T>[]
  fields: Field[]
  filter?: { label: string; options: string[]; value: (row: T) => string }
  searchText: (row: T) => string
  csv: { filename: string; header: string[]; row: (row: T) => (string | number | undefined)[] }
  rowActions?: (row: T) => ReactNode
  emptyText: string
  defaults?: Record<string, unknown>
  extraActions?: ReactNode
  normalize?: (values: Record<string, unknown>) => Record<string, unknown>
}) {
  const { saveRecord, removeRecord, confirm, notify, loading } = useApp()
  const [query, setQuery] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [sort, setSort] = useState<{ index: number; dir: 1 | -1 } | null>(null)
  const [editing, setEditing] = useState<T | 'new' | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    let list = rows.filter(row => (!needle || searchText(row).toLowerCase().includes(needle)) && (!filterValue || filter?.value(row) === filterValue))
    if (sort) {
      const getter = columns[sort.index].sort
      if (getter) list = [...list].sort((a, b) => (getter(a) > getter(b) ? 1 : getter(a) < getter(b) ? -1 : 0) * sort.dir)
    }
    return list
  }, [rows, query, filterValue, sort, columns, filter, searchText])

  const save = async (values: Record<string, unknown>) => {
    const editingRow = editing !== 'new' && editing ? editing : null
    const payload = normalize ? normalize(values) : values
    const saved = await saveRecord(kind, payload, editingRow?.id)
    if (!saved) return false
    setEditing(null)
    notify(editingRow ? 'Wijzigingen opgeslagen' : 'Toegevoegd')
    return true
  }

  const remove = async (row: T) => {
    if (!(await confirm('Dit item wordt definitief verwijderd.'))) return
    if (await removeRecord(kind, row.id)) notify('Verwijderd')
  }

  const toggleSort = (index: number) => setSort(current => (current?.index === index ? (current.dir === 1 ? { index, dir: -1 } : null) : { index, dir: 1 }))

  return (
    <>
      <PageHead eyebrow={eyebrow} title={title} description={description}>
        {extraActions}
        <button type="button" className="button" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> {addLabel}</button>
      </PageHead>
      <div className="panel">
        <div className="table-tools">
          <div className="search">
            <Icon name="search" size={16} />
            <input className="global-search" aria-label={`Zoek in ${title}`} placeholder={`Zoek in ${title.toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          {filter && (
            <select className="filter-select" aria-label={filter.label} value={filterValue} onChange={event => setFilterValue(event.target.value)}>
              <option value="">{filter.label}: alle</option>
              {filter.options.map(option => <option key={option}>{option}</option>)}
            </select>
          )}
          <button type="button" className="button ghost small" disabled={!visible.length} onClick={() => downloadCsv(csv.filename, [csv.header, ...visible.map(csv.row)])}>
            <Icon name="download" size={15} /> Exporteren
          </button>
        </div>
        {loading ? (
          <p className="muted pad">Laden…</p>
        ) : rows.length === 0 ? (
          <EmptyState title={`Nog geen ${title.toLowerCase()}`} text={emptyText} action={<button type="button" className="button" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> {addLabel}</button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title="Geen resultaten" text="Pas uw zoekopdracht of filter aan." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th key={column.label} className={column.align} aria-sort={sort?.index === index ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                      {column.sort ? (
                        <button type="button" className="th-sort" onClick={() => toggleSort(index)}>
                          {column.label}{sort?.index === index ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                        </button>
                      ) : column.label}
                    </th>
                  ))}
                  <th className="right"><span className="sr">Acties</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(row => (
                  <tr key={row.id}>
                    {columns.map(column => <td key={column.label} className={column.align}>{column.render(row)}</td>)}
                    <td className="right row-actions">
                      {rowActions?.(row)}
                      <button type="button" className="icon-button" aria-label="Bewerken" onClick={() => setEditing(row)}><Icon name="edit" size={16} /></button>
                      <button type="button" className="icon-button danger-icon" aria-label="Verwijderen" onClick={() => remove(row)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <RecordForm
          title={editing === 'new' ? addLabel : 'Bewerken'}
          eyebrow={eyebrow}
          fields={fields}
          initial={editing === 'new' ? defaults : (editing as unknown as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  )
}

export function TenantsModule() {
  const { records, properties } = useApp()
  const propertyNames = properties.map(property => property.name)
  return (
    <ResourceModule<Tenant>
      kind="tenants"
      eyebrow="HUURDERS"
      title="Huurders"
      description="Houd uw huurders en contactgegevens overzichtelijk bij."
      addLabel="Nieuwe huurder"
      emptyText="Voeg uw eerste huurder toe om contracten en betalingen te koppelen."
      rows={records.tenants}
      filter={{ label: 'Status', options: ['Nieuw', 'Actief', 'Vertrokken'], value: row => row.status }}
      searchText={row => `${row.name} ${row.email ?? ''} ${row.phone ?? ''} ${row.property ?? ''}`}
      csv={{ filename: 'huurders.csv', header: ['Naam', 'E-mail', 'Telefoon', 'Object', 'Status'], row: row => [row.name, row.email, row.phone, row.property, row.status] }}
      columns={[
        { label: 'Huurder', sort: row => row.name.toLowerCase(), render: row => <strong>{row.name}</strong> },
        { label: 'Object', sort: row => row.property ?? '', render: row => row.property || '—' },
        { label: 'E-mail', render: row => (row.email ? <a href={`mailto:${row.email}`}>{row.email}</a> : '—') },
        { label: 'Telefoon', render: row => (row.phone ? <a href={`tel:${row.phone.replaceAll(' ', '')}`}>{row.phone}</a> : '—') },
        { label: 'Status', sort: row => row.status, render: row => <Status value={row.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Naam huurder', required: true, placeholder: 'bijv. Eva Jansen' },
        { name: 'status', label: 'Status', type: 'select', options: ['Nieuw', 'Actief', 'Vertrokken'] },
        { name: 'email', label: 'E-mailadres', type: 'email', placeholder: 'eva@email.nl' },
        { name: 'phone', label: 'Telefoonnummer', type: 'tel', placeholder: '06 1234 5678' },
        { name: 'property', label: 'Object', list: propertyNames, placeholder: 'bijv. Prinsengracht 482', wide: true },
        { name: 'notes', label: 'Notities', type: 'textarea', placeholder: 'Bijzonderheden, afspraken…' },
      ]}
    />
  )
}

export function MaintenanceModule() {
  const { records, properties, saveRecord, notify } = useApp()
  const next = (status: string) => (status === 'Open' ? 'In behandeling' : status === 'In behandeling' ? 'Afgerond' : 'Open')
  return (
    <ResourceModule<Maintenance>
      kind="maintenance"
      eyebrow="ONDERHOUD"
      title="Onderhoud"
      description="Volg meldingen, werkzaamheden en onderhoudskosten."
      addLabel="Verzoek melden"
      emptyText="Meld storingen en plan werkzaamheden; kosten komen automatisch terug in uw financiële overzicht."
      rows={records.maintenance}
      filter={{ label: 'Status', options: ['Open', 'In behandeling', 'Afgerond'], value: row => row.status }}
      searchText={row => `${row.title} ${row.property} ${row.contractor ?? ''} ${row.priority}`}
      csv={{ filename: 'onderhoud.csv', header: ['Verzoek', 'Object', 'Prioriteit', 'Datum', 'Status', 'Kosten', 'Uitvoerder'], row: row => [row.title, row.property, row.priority, row.date, row.status, row.cost, row.contractor] }}
      columns={[
        { label: 'Verzoek', sort: row => row.title.toLowerCase(), render: row => <strong>{row.title}</strong> },
        { label: 'Object', sort: row => row.property.toLowerCase(), render: row => row.property },
        { label: 'Prioriteit', sort: row => ['Hoog', 'Gemiddeld', 'Laag'].indexOf(row.priority), render: row => <Status value={row.priority} /> },
        { label: 'Datum', sort: row => row.date ?? '', render: row => formatDate(row.date) },
        { label: 'Kosten', align: 'right', sort: row => row.cost ?? 0, render: row => (row.cost ? money(row.cost) : '—') },
        { label: 'Status', sort: row => row.status, render: row => <Status value={row.status} /> },
      ]}
      rowActions={row => (
        <button
          type="button"
          className="button ghost small"
          onClick={async () => {
            const status = next(row.status)
            if (await saveRecord('maintenance', { status }, row.id)) notify(`Status: ${status}`)
          }}
        >
          → {next(row.status)}
        </button>
      )}
      defaults={{ date: today(), priority: 'Gemiddeld' }}
      fields={[
        { name: 'title', label: 'Omschrijving', required: true, placeholder: 'bijv. Lekkende kraan', wide: true },
        { name: 'property', label: 'Object', required: true, list: properties.map(property => property.name) },
        { name: 'priority', label: 'Prioriteit', type: 'select', options: ['Hoog', 'Gemiddeld', 'Laag'] },
        { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In behandeling', 'Afgerond'] },
        { name: 'date', label: 'Datum', type: 'date' },
        { name: 'contractor', label: 'Uitvoerder', placeholder: 'bijv. Installatiebedrijf Smit' },
        { name: 'cost', label: 'Kosten (€)', type: 'number', step: '0.01' },
        { name: 'description', label: 'Toelichting', type: 'textarea' },
      ]}
    />
  )
}

export function DocumentsModule() {
  const { records, properties } = useApp()
  return (
    <ResourceModule<DocumentItem>
      kind="documents"
      eyebrow="DOCUMENTEN"
      title="Documenten"
      description="Alle contracten, rapporten en documenten op één plek."
      addLabel="Document uploaden"
      emptyText="Upload huurovereenkomsten, energielabels en inspectierapporten (maximaal 5 MB per bestand)."
      rows={records.documents}
      filter={{ label: 'Categorie', options: ['Contracten', 'WWS / WWSO', 'Onderhoud', 'Financieel', 'Overig'], value: row => row.category }}
      searchText={row => `${row.name} ${row.category} ${row.property ?? ''}`}
      csv={{ filename: 'documenten.csv', header: ['Document', 'Categorie', 'Object', 'Datum', 'Grootte (bytes)'], row: row => [row.name, row.category, row.property, row.date, row.size] }}
      columns={[
        { label: 'Document', sort: row => row.name.toLowerCase(), render: row => <strong><Icon name="file" size={15} /> {row.name}</strong> },
        { label: 'Categorie', sort: row => row.category, render: row => row.category },
        { label: 'Object', render: row => row.property || '—' },
        { label: 'Datum', sort: row => row.date ?? '', render: row => formatDate(row.date) },
        { label: 'Grootte', align: 'right', sort: row => row.size ?? 0, render: row => formatBytes(row.size) },
      ]}
      rowActions={row => row.hasFile ? <a className="icon-button" aria-label={`Download ${row.name}`} href={`/api/records/documents/${row.id}`}><Icon name="download" size={16} /></a> : null}
      defaults={{ date: today() }}
      fields={[
        { name: 'file', label: 'Bestand', type: 'file', wide: true },
        { name: 'name', label: 'Naam (optioneel bij upload)', required: false, wide: true },
        { name: 'category', label: 'Categorie', type: 'select', options: ['Contracten', 'WWS / WWSO', 'Onderhoud', 'Financieel', 'Overig'] },
        { name: 'date', label: 'Datum', type: 'date' },
        { name: 'property', label: 'Object', list: properties.map(property => property.name), wide: true },
      ]}
      normalize={values => {
        // Bij bewerken zonder nieuw bestand blijft het bestaande bestand ongemoeid.
        if (!values.file) delete values.file
        return values
      }}
    />
  )
}
