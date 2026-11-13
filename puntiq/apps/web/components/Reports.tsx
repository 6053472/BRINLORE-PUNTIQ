'use client'

import { useMemo, useState } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { PageHead } from './ui'
import { buildReport, formatCell, reportTypes, type ReportDocument, type ReportId } from '../lib/reports'
import { today, toIso } from '../lib/format'

type Preset = 'jaar' | 'vorigjaar' | 'kwartaal' | 'maand' | 'vorigemaand' | '12mnd' | 'aangepast'
const presetLabels: Record<Preset, string> = {
  jaar: 'Dit jaar', vorigjaar: 'Vorig jaar', kwartaal: 'Dit kwartaal', maand: 'Deze maand', vorigemaand: 'Vorige maand', '12mnd': 'Laatste 12 maanden', aangepast: 'Aangepast',
}

function presetRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date()
  const [y, m] = [now.getFullYear(), now.getMonth()]
  const first = (year: number, month: number) => toIso(new Date(year, month, 1))
  const last = (year: number, month: number) => toIso(new Date(year, month + 1, 0))
  switch (preset) {
    case 'jaar': return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'vorigjaar': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'kwartaal': return { from: first(y, Math.floor(m / 3) * 3), to: last(y, Math.floor(m / 3) * 3 + 2) }
    case 'maand': return { from: first(y, m), to: last(y, m) }
    case 'vorigemaand': return { from: first(y, m - 1), to: last(y, m - 1) }
    case '12mnd': return { from: first(y, m - 11), to: last(y, m) }
    default: return null
  }
}

function Preview({ doc }: { doc: ReportDocument }) {
  return (
    <article className="report-preview" aria-label={`Voorbeeld: ${doc.title}`}>
      <header>
        <small>BRINLORE PUNTIQ · RAPPORTAGE</small>
        <h2>{doc.title}</h2>
        <p>{doc.company}{doc.period && <> · {formatCell(doc.period.from, 'date')} t/m {formatCell(doc.period.to, 'date')}</>} · {doc.filters.join(' · ')}</p>
      </header>
      {doc.sections.map(section => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          {section.description && <p className="muted small-text">{section.description}</p>}
          {section.kpis && (
            <div className="report-kpis">
              {section.kpis.map(kpi => <div key={kpi.label}><span>{kpi.label}</span><strong>{formatCell(kpi.value, kpi.type)}</strong></div>)}
            </div>
          )}
          {section.table && (section.table.rows.length === 0 ? <p className="muted small-text">{section.empty ?? 'Geen gegevens.'}</p> : (
            <div className="table-scroll">
              <table className="report-table">
                <thead><tr>{section.table.columns.map(column => <th key={column.key} className={column.type === 'text' || column.type === 'date' ? '' : 'right'}>{column.label}</th>)}</tr></thead>
                <tbody>
                  {section.table.rows.slice(0, 50).map((row, index) => (
                    <tr key={index}>{section.table!.columns.map(column => <td key={column.key} className={column.type === 'text' || column.type === 'date' ? '' : 'right'}>{formatCell(row[column.key] ?? null, column.type)}</td>)}</tr>
                  ))}
                </tbody>
                {section.table.totals && (
                  <tfoot><tr>{section.table.columns.map(column => <td key={column.key} className={column.type === 'text' || column.type === 'date' ? '' : 'right'}>{section.table!.totals![column.key] === undefined ? '' : formatCell(section.table!.totals![column.key], column.type)}</td>)}</tr></tfoot>
                )}
              </table>
              {section.table.rows.length > 50 && <p className="muted small-text">Voorbeeld toont 50 van {section.table.rows.length} regels; de export bevat alles.</p>}
            </div>
          ))}
        </section>
      ))}
      {doc.disclaimer && <p className="report-disclaimer">{doc.disclaimer}</p>}
    </article>
  )
}

export function ReportsModule() {
  const { user, properties, records, notify, loading } = useApp()
  const [reportId, setReportId] = useState<ReportId>('inkomsten')
  const [preset, setPreset] = useState<Preset>('jaar')
  const [custom, setCustom] = useState(() => presetRange('jaar')!)
  const [propertyId, setPropertyId] = useState('')
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null)

  const type = reportTypes.find(item => item.id === reportId)!
  const range = presetRange(preset) ?? custom
  const validRange = range.from && range.to && range.from <= range.to

  const doc = useMemo(() => buildReport(reportId, {
    properties, tenants: records.tenants, contracts: records.contracts, invoices: records.invoices, payments: records.payments,
    maintenance: records.maintenance, wws: records.wws, wwso: records.wwso,
  }, {
    from: range.from, to: range.to, propertyId: propertyId ? Number(propertyId) : undefined,
    company: user.profile.company || [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') || user.username,
    generatedBy: [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') || user.username,
    now: today(), contractReminderDays: user.settings.contractReminderDays,
  }), [reportId, range.from, range.to, propertyId, properties, records, user])

  const exportAs = async (format: 'pdf' | 'xlsx') => {
    if (type.usesPeriod && !validRange) return notify('Kies een geldige periode.', 'error')
    setBusy(format)
    try {
      const { downloadReport } = await import('../lib/report-export')
      await downloadReport(doc, format)
      notify(`${format === 'pdf' ? 'PDF' : 'Excel-bestand'} gedownload`)
    } catch (error) {
      console.error(error)
      notify('Exporteren is mislukt. Probeer het opnieuw.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHead eyebrow="RAPPORTAGES" title="Rapportages" description="Maak rapporten over vastgoed, huurders, huurinkomsten, onderhoud en WWS-berekeningen en exporteer ze naar PDF of Excel." />
      <div className="reports-layout">
        <nav className="report-types" aria-label="Soort rapport">
          {reportTypes.map(item => (
            <button key={item.id} type="button" className={item.id === reportId ? 'active' : ''} aria-pressed={item.id === reportId} onClick={() => setReportId(item.id)}>
              <span className="card-icon"><Icon name={item.icon} size={18} /></span>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>
        <div className="stack">
          <div className="panel report-options">
            {type.usesPeriod ? (
              <label>Periode
                <select value={preset} onChange={event => setPreset(event.target.value as Preset)}>
                  {(Object.keys(presetLabels) as Preset[]).map(key => <option key={key} value={key}>{presetLabels[key]}</option>)}
                </select>
              </label>
            ) : <p className="muted small-text report-note">Dit rapport toont de stand van vandaag.</p>}
            {type.usesPeriod && preset === 'aangepast' && <>
              <label>Van<input type="date" value={custom.from} onChange={event => setCustom(current => ({ ...current, from: event.target.value }))} /></label>
              <label>Tot en met<input type="date" value={custom.to} min={custom.from} onChange={event => setCustom(current => ({ ...current, to: event.target.value }))} /></label>
            </>}
            <label>Woning
              <select value={propertyId} onChange={event => setPropertyId(event.target.value)}>
                <option value="">Alle woningen</option>
                {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="report-actions">
              <button type="button" className="button ghost" disabled={busy !== null || loading} onClick={() => exportAs('xlsx')}><Icon name="download" size={16} /> {busy === 'xlsx' ? 'Bezig…' : 'Excel'}</button>
              <button type="button" className="button" disabled={busy !== null || loading} onClick={() => exportAs('pdf')}><Icon name="download" size={16} /> {busy === 'pdf' ? 'Bezig…' : 'PDF'}</button>
            </div>
          </div>
          {type.usesPeriod && !validRange ? <p className="form-error">Kies een geldige periode (de begindatum ligt na de einddatum).</p> : loading ? <p className="muted pad">Laden…</p> : <Preview doc={doc} />}
        </div>
      </div>
    </>
  )
}
