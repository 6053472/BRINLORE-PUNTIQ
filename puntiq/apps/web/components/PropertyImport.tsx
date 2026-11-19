'use client'

import { useState, type ChangeEvent } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { Modal } from './ui'
import { downloadCsv } from '../lib/format'
import { MAX_IMPORT_ROWS, importTemplate, parsePropertyCsv, type ParsedImport } from '../lib/property-import'

const TYPES = ['Zelfstandig', 'Onzelfstandig', 'Bedrijfsruimte']
const STATUSES = ['Beschikbaar', 'Verhuurd', 'In onderhoud']
const MAX_FILE_BYTES = 5_000_000

/** Importeert woningen uit een CSV-bestand: eerst een controle, dan pas opslaan. */
export function ImportModal({ onClose }: { onClose: () => void }) {
  const { importProperties, notify } = useApp()
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { line: number; message: string }[] } | null>(null)

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setResult(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setParsed(null)
      return notify('Het bestand is te groot (maximaal 5 MB).', 'error')
    }
    setFileName(file.name)
    setParsed(parsePropertyCsv(await file.text(), TYPES, STATUSES))
  }

  const tooMany = (parsed?.rows.length ?? 0) > MAX_IMPORT_ROWS
  const run = async () => {
    if (!parsed || !parsed.rows.length || tooMany) return
    setBusy(true)
    const outcome = await importProperties(parsed.rows)
    setBusy(false)
    if (!outcome) return
    setResult(outcome)
    setParsed(null)
    notify(`${outcome.created} woning${outcome.created === 1 ? '' : 'en'} geïmporteerd`)
  }

  return (
    <Modal
      eyebrow="VASTGOED"
      title="Woningen importeren"
      subtitle={`Voeg tot ${MAX_IMPORT_ROWS.toLocaleString('nl-NL')} woningen tegelijk toe vanuit een CSV-bestand (Excel: opslaan als CSV).`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="button ghost" onClick={onClose}>{result ? 'Sluiten' : 'Annuleren'}</button>
          {!result && <button type="button" className="button" disabled={busy || !parsed?.rows.length || tooMany} onClick={run}>{busy ? 'Bezig…' : `Importeer ${parsed?.rows.length ?? 0} woningen`}</button>}
        </>
      }
    >
      {!result && (
        <div className="import-drop">
          <label>Bestand kiezen<input type="file" accept=".csv,text/csv,text/plain" onChange={choose} /></label>
          <button type="button" className="link-button" onClick={() => downloadCsv('vastgoed-importsjabloon.csv', importTemplate)}><Icon name="download" size={14} /> Sjabloon downloaden</button>
          <small className="muted">Verplicht: Naam en Adres. Type: {TYPES.join(', ')}. Status: {STATUSES.join(', ')}. Woningen met dezelfde naam én hetzelfde adres worden overgeslagen.</small>
        </div>
      )}
      {parsed && (
        <>
          <div className="import-summary">
            <span className="status s-actief">{parsed.rows.length} geldige regels</span>
            {parsed.errors.length > 0 && <span className="status tone-bad">{parsed.errors.length} met fouten (worden overgeslagen)</span>}
            {tooMany && <span className="status tone-bad">Maximaal {MAX_IMPORT_ROWS} per import</span>}
          </div>
          <p className="muted small-text">{fileName} · herkende kolommen: {parsed.recognized.join(', ') || '—'}{parsed.ignored.length > 0 && ` · genegeerd: ${parsed.ignored.join(', ')}`}</p>
          {parsed.errors.length > 0 && <ul className="import-errors">{parsed.errors.slice(0, 100).map(error => <li key={`${error.line}-${error.message}`}>Regel {error.line}: {error.message}</li>)}</ul>}
        </>
      )}
      {result && (
        <>
          <div className="import-summary">
            <span className="status s-actief">{result.created} geïmporteerd</span>
            {result.skipped > 0 && <span className="status tone-neutral">{result.skipped} bestond al</span>}
            {result.errors.length > 0 && <span className="status tone-bad">{result.errors.length} mislukt</span>}
          </div>
          {result.errors.length > 0 && <ul className="import-errors">{result.errors.slice(0, 100).map(error => <li key={`${error.line}-${error.message}`}>Regel {error.line}: {error.message}</li>)}</ul>}
        </>
      )}
    </Modal>
  )
}
