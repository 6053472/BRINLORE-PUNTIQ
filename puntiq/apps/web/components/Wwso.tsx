'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, PanelHeading, Stat } from './ui'
import {
  berekenWwso, controleerWwsoRegelset, energielabels, kiesWwsoRegelset, legeWwsoInvoer, nieuwId,
  type Betrouwbaarheid, type ComplexRuimte, type Energielabel, type GedeeldeRuimte, type PriveRuimte, type RegelStatus, type RubriekId, type Voorziening, type WwsoInvoer, type WwsoUitkomst,
} from '../lib/wwso'
import { formatDate, money, today } from '../lib/format'
import type { WwsoCalculation } from '../lib/types'

const badge: Record<Betrouwbaarheid, [string, string]> = {
  officieel: ['status s-actief', 'Officieel'],
  indicatief: ['status tone-warn', 'Indicatief'],
  onvolledig: ['status tone-bad', 'Onvolledig'],
}
const regelStatus: Record<RegelStatus, [string, string]> = {
  geverifieerd: ['status s-actief', 'Geverifieerd'],
  ongeverifieerd: ['status tone-warn', 'Niet geverifieerd'],
  niet_geconfigureerd: ['status tone-neutral', 'Geen regel'],
}
const fmt = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
const Badge = ({ value }: { value: Betrouwbaarheid }) => <span className={badge[value][0]}>{badge[value][1]}</span>

/* ---------- Generieke invoer ---------- */

function Num({ value, onChange, step = 1, min = 0, label, placeholder }: { value: number | null; onChange: (value: number | null) => void; step?: number; min?: number; label?: string; placeholder?: string }) {
  return <input type="number" inputMode="decimal" min={min} step={step} value={value ?? ''} aria-label={label} placeholder={placeholder} onChange={event => onChange(event.target.value === '' ? null : Math.max(min, Number(event.target.value)))} />
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="wws-section">
      <legend>{title}</legend>
      {hint && <p className="muted small-text">{hint}</p>}
      {children}
    </fieldset>
  )
}

type Column<T> = { label: string; width: string; render: (row: T, update: (patch: Partial<T>) => void) => ReactNode }

/** Bewerkbare tabel met rijen (ruimten, voorzieningen). */
function Rows<T extends { id: string; naam: string }>({ rows, columns, onChange, nieuw, addLabel }: { rows: T[]; columns: Column<T>[]; onChange: (rows: T[]) => void; nieuw: () => T; addLabel: string }) {
  const template = `${columns.map(column => column.width).join(' ')} 36px`
  return (
    <div className="room-table">
      {rows.length > 0 && (
        <div className="room-row room-head" style={{ gridTemplateColumns: template }} aria-hidden="true">
          {columns.map(column => <span key={column.label}>{column.label}</span>)}<span />
        </div>
      )}
      {rows.map(row => (
        <div key={row.id} className="room-row" style={{ gridTemplateColumns: template }}>
          {columns.map(column => <span key={column.label} className="cell">{column.render(row, patch => onChange(rows.map(item => (item.id === row.id ? { ...item, ...patch } : item))))}</span>)}
          <button type="button" className="icon-button danger-icon" aria-label={`${row.naam || 'Rij'} verwijderen`} onClick={() => onChange(rows.filter(item => item.id !== row.id))}><Icon name="x" size={15} /></button>
        </div>
      ))}
      <div className="room-foot">
        <button type="button" className="link-button" onClick={() => onChange([...rows, nieuw()])}><Icon name="plus" size={14} /> {addLabel}</button>
      </div>
    </div>
  )
}

const naamKolom = <T extends { naam: string }>(): Column<T> => ({ label: 'Naam', width: 'minmax(0, 1fr)', render: (row, update) => <input value={row.naam} onChange={event => update({ naam: event.target.value } as Partial<T>)} aria-label="Naam" /> })
const m2Kolom = <T extends { m2: number; naam: string }>(): Column<T> => ({ label: 'm²', width: '80px', render: (row, update) => <Num value={row.m2 || null} step={0.01} label={`${row.naam}: m²`} onChange={value => update({ m2: value ?? 0 } as Partial<T>)} /> })
const vinkKolom = <T extends { naam: string }>(label: string, key: keyof T): Column<T> => ({ label, width: '64px', render: (row, update) => <input type="checkbox" checked={Boolean(row[key])} aria-label={`${row.naam}: ${label.toLowerCase()}`} onChange={event => update({ [key]: event.target.checked } as Partial<T>)} /> })
const delerKolom = <T extends { naam: string }>(label: string, key: keyof T, hint: string): Column<T> => ({ label, width: '86px', render: (row, update) => <Num value={(row[key] as number) || null} min={1} label={`${row.naam}: ${hint}`} onChange={value => update({ [key]: value ?? 1 } as Partial<T>)} /> })
const soortKolom = <T extends { soort: 'vertrek' | 'overig'; naam: string }>(): Column<T> => ({
  label: 'Soort', width: '110px',
  render: (row, update) => (
    <select value={row.soort} aria-label={`${row.naam}: soort`} onChange={event => update({ soort: event.target.value as 'vertrek' | 'overig' } as Partial<T>)}>
      <option value="vertrek">Vertrek</option><option value="overig">Overige ruimte</option>
    </select>
  ),
})

/* ---------- Uitkomst ---------- */

function Uitkomst({ uitkomst, invoer, onHandmatig }: { uitkomst: WwsoUitkomst; invoer: WwsoInvoer; onHandmatig: (id: RubriekId, waarde: { punten: number; toelichting: string } | null) => void }) {
  const [bewerken, setBewerken] = useState<RubriekId | null>(null)
  const [concept, setConcept] = useState({ punten: '', toelichting: '' })
  return (
    <aside className="wws-result" aria-live="polite">
      <div className="result-box">
        <Badge value={uitkomst.betrouwbaarheid} />
        <strong>{uitkomst.totaalPunten ?? '—'} <small>punten</small></strong>
        <p>{uitkomst.maximaleHuur !== null ? <>Maximale kale huur <b>{money(uitkomst.maximaleHuur)}</b></> : uitkomst.totaalPunten !== null ? 'Maximale huur: tabel nog niet ingevoerd' : 'Nog niet alle rubrieken bepaald'}</p>
        <small>Toegerekend aan deze kamer: {fmt(uitkomst.toegerekendeM2Vertrekken)} m² vertrekken</small>
      </div>
      {uitkomst.redenen.length > 0 && (
        <details className="wws-reasons" open={uitkomst.betrouwbaarheid === 'onvolledig'}>
          <summary>{uitkomst.betrouwbaarheid === 'onvolledig' ? 'Wat ontbreekt er?' : 'Waarom niet officieel?'} ({uitkomst.redenen.length})</summary>
          <ul>{uitkomst.redenen.map(reden => <li key={reden}>{reden}</li>)}</ul>
        </details>
      )}
      <div className="breakdown wws-breakdown" aria-label="Puntenuitsplitsing">
        <strong>Rubrieken (bijlage I, onder B)</strong>
        {uitkomst.rubrieken.map(item => (
          <div key={item.id} className={`wws-rubriek ${item.bron}`}>
            <details>
              <summary><span>{item.nummer}. {item.naam}{item.bron === 'handmatig' && <em> · handmatig</em>}</span><b>{item.punten === null ? '—' : fmt(item.punten)}</b></summary>
              {item.stappen.length > 0 && <ul>{item.stappen.map((stap, index) => <li key={index}>{stap}</li>)}</ul>}
              {item.waarschuwingen.map(text => <p key={text} className="wws-warning"><Icon name="alert" size={13} /> {text}</p>)}
              <small className="muted">Regel: {regelStatus[item.status][1]}</small>
            </details>
            <button type="button" className="link-button" onClick={() => {
              const huidig = invoer.handmatig[item.id]
              setConcept({ punten: huidig ? String(huidig.punten) : '', toelichting: huidig?.toelichting ?? '' })
              setBewerken(bewerken === item.id ? null : item.id)
            }}>{invoer.handmatig[item.id] ? 'Wijzigen' : 'Handmatig'}</button>
            {bewerken === item.id && (
              <form className="wws-manual" onSubmit={event => {
                event.preventDefault()
                const punten = Number(concept.punten.replace(',', '.'))
                if (concept.punten.trim() === '' || !Number.isFinite(punten)) return
                onHandmatig(item.id, { punten, toelichting: concept.toelichting.trim() })
                setBewerken(null)
              }}>
                <label>Punten<input type="number" step="0.25" value={concept.punten} onChange={event => setConcept(current => ({ ...current, punten: event.target.value }))} required autoFocus /></label>
                <label>Toelichting / bron<input value={concept.toelichting} onChange={event => setConcept(current => ({ ...current, toelichting: event.target.value }))} /></label>
                <div className="button-row">
                  <button className="button small">Toepassen</button>
                  {invoer.handmatig[item.id] && <button type="button" className="button ghost small" onClick={() => { onHandmatig(item.id, null); setBewerken(null) }}>Terug naar berekening</button>}
                </div>
              </form>
            )}
          </div>
        ))}
        {uitkomst.toeslagen.map(toeslag => <div key={toeslag.naam} className="wws-subtotal"><span>{toeslag.naam}</span><b>+{fmt(toeslag.punten)}</b></div>)}
      </div>
      <p className="muted small-text">Regelset: {uitkomst.regelset.naam}</p>
    </aside>
  )
}

/* ---------- Calculator ---------- */

function parse(record?: WwsoCalculation): WwsoInvoer | null {
  if (!record?.invoer) return null
  try {
    return { ...legeWwsoInvoer(today()), ...(JSON.parse(record.invoer) as WwsoInvoer) }
  } catch {
    return null
  }
}

export function WwsoModal({ onClose, record }: { onClose: () => void; record?: WwsoCalculation }) {
  const { properties, saveRecord, notify } = useApp()
  const [invoer, setInvoer] = useState<WwsoInvoer>(() => parse(record) ?? legeWwsoInvoer(today()))
  const [propertyId, setPropertyId] = useState(() => String(properties.find(property => property.name === record?.property)?.id ?? ''))
  const [label, setLabel] = useState(record?.label ?? '')
  const [busy, setBusy] = useState(false)
  const regelset = useMemo(() => kiesWwsoRegelset(invoer.peildatum), [invoer.peildatum])
  const uitkomst = useMemo(() => (regelset ? berekenWwso(invoer, regelset) : null), [invoer, regelset])
  const selected = properties.find(property => String(property.id) === propertyId)

  const set = <K extends keyof WwsoInvoer>(key: K, value: WwsoInvoer[K]) => setInvoer(current => ({ ...current, [key]: value }))
  const patch = <K extends 'adres' | 'buitenruimte' | 'parkeren' | 'woz' | 'bijzonder' | 'aftrek'>(key: K, value: Partial<WwsoInvoer[K]>) =>
    setInvoer(current => ({ ...current, [key]: { ...current[key], ...value } }))
  const setHandmatig = (id: RubriekId, waarde: { punten: number; toelichting: string } | null) =>
    setInvoer(current => {
      const handmatig = { ...current.handmatig }
      if (waarde) handmatig[id] = waarde
      else delete handmatig[id]
      return { ...current, handmatig }
    })
  const n = invoer.adres.aantalWoonruimten

  const chooseProperty = (id: string) => {
    setPropertyId(id)
    const property = properties.find(item => String(item.id) === id)
    if (property) {
      patch('adres', {
        bouwjaar: invoer.adres.bouwjaar ?? property.yearBuilt ?? null,
        energielabel: invoer.adres.energielabel ?? ((energielabels as string[]).includes(property.energyLabel ?? '') ? (property.energyLabel as Energielabel) : null),
      })
    }
  }

  const save = async () => {
    const name = label.trim() || selected?.name || ''
    if (!name) return notify('Geef de kamer een naam, bijv. "Kamer 3, Singel 229".', 'error')
    if (!uitkomst) return notify('Er is geen WWSO-regelset voor deze peildatum.', 'error')
    setBusy(true)
    const saved = await saveRecord('wwso', {
      label: name,
      property: selected?.name ?? '',
      date: invoer.peildatum,
      points: uitkomst.totaalPunten ?? undefined,
      rent: uitkomst.maximaleHuur ?? undefined,
      regelset: uitkomst.regelset.id,
      betrouwbaarheid: uitkomst.betrouwbaarheid,
      invoer: JSON.stringify(invoer),
    }, record?.id)
    setBusy(false)
    if (saved) {
      notify('WWSO-berekening opgeslagen')
      onClose()
    }
  }

  return (
    <Modal
      wide
      eyebrow="WWSO · ONZELFSTANDIGE WOONRUIMTE"
      title={record ? 'Kamerwaardering bewerken' : 'Kamer waarderen'}
      subtitle="Waardering van één onzelfstandige woonruimte. Gedeelde ruimten en voorzieningen worden naar rato verdeeld."
      onClose={onClose}
      actions={<><button type="button" className="button ghost" onClick={onClose}>Annuleren</button><button type="button" className="button" disabled={busy || !uitkomst} onClick={save}>{busy ? 'Opslaan…' : 'Berekening opslaan'}</button></>}
    >
      <div className="wws-layout">
        <div className="wws-form">
          <Section title="Kamer en adres">
            <div className="form-grid">
              <label>Pand (optioneel)
                <select value={propertyId} onChange={event => chooseProperty(event.target.value)}>
                  <option value="">— Geen koppeling —</option>
                  {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
              </label>
              <label>Naam kamer<input value={label} onChange={event => setLabel(event.target.value)} placeholder={selected ? `Kamer 1, ${selected.name}` : 'bijv. Kamer 3, Singel 229'} /></label>
              <label>Peildatum<input type="date" value={invoer.peildatum} onChange={event => event.target.value && set('peildatum', event.target.value)} /></label>
              <label>Onzelfstandige woonruimten op het adres<Num value={n} min={1} onChange={value => patch('adres', { aantalWoonruimten: value ?? 1 })} /></label>
              <label>Energielabel van het adres
                <select value={invoer.adres.energielabel ?? ''} onChange={event => patch('adres', { energielabel: (event.target.value || null) as Energielabel | null })}>
                  <option value="">Geen geldig label</option>
                  {energielabels.map(value => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Bouwjaar<Num value={invoer.adres.bouwjaar} min={1000} onChange={value => patch('adres', { bouwjaar: value })} placeholder="bij geen label" /></label>
            </div>
            <label className="check-label"><input type="checkbox" checked={invoer.adres.monument} onChange={event => patch('adres', { monument: event.target.checked })} /> Het pand is een monument</label>
            <label className="check-label"><input type="checkbox" checked={invoer.adres.rijksmonumentVoorWbh} onChange={event => patch('adres', { rijksmonumentVoorWbh: event.target.checked })} /> Rijksmonument dat al vóór de Wet betaalbare huur werd verhuurd</label>
            {!regelset && <p className="form-error">Er is geen WWSO-regelset die geldt op {formatDate(invoer.peildatum)}.</p>}
          </Section>

          <Section title="Eigen ruimten" hint="Ruimten die alleen deze huurder gebruikt.">
            <Rows<PriveRuimte> rows={invoer.priveVertrekken} onChange={rows => set('priveVertrekken', rows)} addLabel="Vertrek toevoegen"
              nieuw={() => ({ id: nieuwId(), naam: 'Vertrek', m2: 0, verwarmd: true, gekoeld: false })}
              columns={[naamKolom(), m2Kolom(), vinkKolom('Verwarmd', 'verwarmd'), vinkKolom('Gekoeld', 'gekoeld')]} />
            <Rows<PriveRuimte> rows={invoer.priveOverigeRuimten} onChange={rows => set('priveOverigeRuimten', rows)} addLabel="Overige ruimte toevoegen (berging, eigen gang…)"
              nieuw={() => ({ id: nieuwId(), naam: 'Berging', m2: 0, verwarmd: false, gekoeld: false })}
              columns={[naamKolom(), m2Kolom(), vinkKolom('Verwarmd', 'verwarmd')]} />
          </Section>

          <Section title="Gedeelde ruimten op dit adres" hint="Bijv. woonkamer, gang, zolder. De punten worden gedeeld door het aantal onzelfstandige woonruimten met toegang en gebruiksrecht.">
            <Rows<GedeeldeRuimte> rows={invoer.gedeeldeRuimten} onChange={rows => set('gedeeldeRuimten', rows)} addLabel="Gedeelde ruimte toevoegen"
              nieuw={() => ({ id: nieuwId(), naam: 'Woonkamer', soort: 'vertrek', m2: 0, verwarmd: true, gekoeld: false, gedeeldDoor: n })}
              columns={[naamKolom(), soortKolom(), m2Kolom(), vinkKolom('Verw.', 'verwarmd'), vinkKolom('Gekoeld', 'gekoeld'), delerKolom('Gedeeld door', 'gedeeldDoor', 'aantal woonruimten')]} />
          </Section>

          <Section title="Keuken en sanitair" hint="Voer per voorziening de punten in (aanrecht en voorzieningen volgens rubriek 5 en 6) en met hoeveel woonruimten die wordt gedeeld. 1 = eigen voorziening.">
            <Rows<Voorziening> rows={invoer.keukens} onChange={rows => set('keukens', rows)} addLabel="Keuken toevoegen"
              nieuw={() => ({ id: nieuwId(), naam: 'Gedeelde keuken', punten: 0, gedeeldDoor: n })}
              columns={[naamKolom(), { label: 'Punten', width: '86px', render: (row, update) => <Num value={row.punten || null} step={0.25} label={`${row.naam}: punten`} onChange={value => update({ punten: value ?? 0 })} /> }, delerKolom('Gedeeld door', 'gedeeldDoor', 'aantal woonruimten')]} />
            <Rows<Voorziening> rows={invoer.sanitair} onChange={rows => set('sanitair', rows)} addLabel="Sanitaire voorziening toevoegen"
              nieuw={() => ({ id: nieuwId(), naam: 'Badkamer', punten: 0, gedeeldDoor: n })}
              columns={[naamKolom(), { label: 'Punten', width: '86px', render: (row, update) => <Num value={row.punten || null} step={0.25} label={`${row.naam}: punten`} onChange={value => update({ punten: value ?? 0 })} /> }, delerKolom('Gedeeld door', 'gedeeldDoor', 'aantal woonruimten')]} />
          </Section>

          <Section title="Buitenruimten">
            <div className="form-grid">
              <label>Privé-buitenruimte (m²)<Num value={invoer.buitenruimte.priveM2 || null} step={0.01} onChange={value => patch('buitenruimte', { priveM2: value ?? 0 })} /></label>
              <span />
              <label>Gedeeld op dit adres (m²)<Num value={invoer.buitenruimte.gedeeldOpAdresM2 || null} step={0.01} onChange={value => patch('buitenruimte', { gedeeldOpAdresM2: value ?? 0 })} placeholder="bijv. tuin" /></label>
              <label>…gedeeld door (woonruimten)<Num value={invoer.buitenruimte.gedeeldOpAdresDoor} min={1} onChange={value => patch('buitenruimte', { gedeeldOpAdresDoor: value ?? 1 })} /></label>
              <label>Gedeeld met andere adressen (m²)<Num value={invoer.buitenruimte.complexM2 || null} step={0.01} onChange={value => patch('buitenruimte', { complexM2: value ?? 0 })} placeholder="bijv. binnentuin" /></label>
              <label>…aantal adressen<Num value={invoer.buitenruimte.complexAdressen} min={1} onChange={value => patch('buitenruimte', { complexAdressen: value ?? 1 })} /></label>
            </div>
          </Section>

          <Section title="Gemeenschappelijk met andere adressen" hint="Ruimten in een complex waartoe meerdere adressen toegang hebben. Gedeeld door het aantal adressen en daarna door het aantal woonruimten op dit adres.">
            <Rows<ComplexRuimte> rows={invoer.complexRuimten} onChange={rows => set('complexRuimten', rows)} addLabel="Gemeenschappelijke ruimte toevoegen"
              nieuw={() => ({ id: nieuwId(), naam: 'Recreatieruimte', soort: 'vertrek', m2: 0, adressen: 2 })}
              columns={[naamKolom(), soortKolom(), m2Kolom(), delerKolom('Adressen', 'adressen', 'aantal adressen')]} />
            <div className="form-grid">
              <label>Parkeerplekken type I<Num value={invoer.parkeren.typeI || null} onChange={value => patch('parkeren', { typeI: value ?? 0 })} /></label>
              <label>Parkeerplekken type II<Num value={invoer.parkeren.typeII || null} onChange={value => patch('parkeren', { typeII: value ?? 0 })} /></label>
              <label>Parkeerplekken type III<Num value={invoer.parkeren.typeIII || null} onChange={value => patch('parkeren', { typeIII: value ?? 0 })} /></label>
              <label>…gedeeld door (adressen)<Num value={invoer.parkeren.adressen} min={1} onChange={value => patch('parkeren', { adressen: value ?? 1 })} /></label>
              <label>Laadpalen<Num value={invoer.parkeren.laadpalen || null} onChange={value => patch('parkeren', { laadpalen: value ?? 0 })} /></label>
              <label>…gedeeld door (adressen)<Num value={invoer.parkeren.laadpaalAdressen} min={1} onChange={value => patch('parkeren', { laadpaalAdressen: value ?? 1 })} /></label>
            </div>
          </Section>

          <Section title="WOZ-waarde van het adres" hint="De WOZ-waarde per m² van de hele woning wordt vergeleken met het gemiddelde in het COROP-gebied. Dat gemiddelde staat in de Uitvoeringsregeling huurprijzen woonruimte.">
            <div className="form-grid">
              <label>WOZ-waarde adres (€)<Num value={invoer.woz.waardeAdres} step={1000} onChange={value => patch('woz', { waardeAdres: value })} /></label>
              <label>Gebruiksoppervlakte adres (m²)<Num value={invoer.woz.gebruiksoppervlakteAdres} step={1} onChange={value => patch('woz', { gebruiksoppervlakteAdres: value })} placeholder="WOZ-waardeloket" /></label>
              <label>COROP-gebied<input value={invoer.woz.coropGebied} onChange={event => patch('woz', { coropGebied: event.target.value })} placeholder="bijv. Groot-Amsterdam" /></label>
              <label>COROP-gemiddelde per m² (€)<Num value={invoer.woz.coropGemiddeldePerM2} onChange={value => patch('woz', { coropGemiddeldePerM2: value })} placeholder="uit Uitvoeringsregeling" /></label>
            </div>
          </Section>

          <Section title="Bijzonder en aftrek" hint="De aftrek bij minder dan 8 m² vertrekken wordt automatisch bepaald.">
            <label className="check-label"><input type="checkbox" checked={invoer.bijzonder.zorgwoning} onChange={event => patch('bijzonder', { zorgwoning: event.target.checked })} /> Zorgwoning</label>
            <label className="check-label"><input type="checkbox" checked={invoer.bijzonder.aanbelfunctie} onChange={event => patch('bijzonder', { aanbelfunctie: event.target.checked })} /> Aanbelfunctie met video en audio, voordeur op afstand te openen</label>
            <label className="check-label"><input type="checkbox" checked={invoer.aftrek.alleenViaVertrekVerhuurder} onChange={event => patch('aftrek', { alleenViaVertrekVerhuurder: event.target.checked })} /> Kamer of sanitair alleen bereikbaar via een woon- of slaapvertrek van de inwonende verhuurder</label>
            <label className="check-label"><input type="checkbox" checked={invoer.aftrek.ruitOppervlakteKleiner} onChange={event => patch('aftrek', { ruitOppervlakteKleiner: event.target.checked })} /> Zichtbaar glas in het (hoofd)woonvertrek kleiner dan 0,75 m²</label>
            <label className="check-label"><input type="checkbox" checked={invoer.aftrek.kozijnTeHoog} onChange={event => patch('aftrek', { kozijnTeHoog: event.target.checked })} /> Laagste raamkozijn van het (hoofd)woonvertrek hoger dan 1,60 m</label>
          </Section>
        </div>
        {uitkomst ? <Uitkomst uitkomst={uitkomst} invoer={invoer} onHandmatig={setHandmatig} /> : <aside className="wws-result"><p className="muted">Geen regelset voor deze peildatum.</p></aside>}
      </div>
    </Modal>
  )
}

/* ---------- Module ---------- */

function RegelsetStatus() {
  const regelset = kiesWwsoRegelset(today())
  if (!regelset) return <p className="form-error">Er is geen WWSO-regelset die vandaag geldt.</p>
  const onderdelen = controleerWwsoRegelset(regelset)
  const geverifieerd = onderdelen.filter(item => item.status === 'geverifieerd').length
  return (
    <details className="panel wws-ruleset">
      <summary>
        <span><strong>{regelset.naam}</strong><small className="muted">{geverifieerd} van {onderdelen.length} onderdelen geverifieerd</small></span>
        <span className={geverifieerd === onderdelen.length ? 'status s-actief' : 'status tone-warn'}>{geverifieerd === onderdelen.length ? 'Geverifieerd' : 'Niet volledig geverifieerd'}</span>
      </summary>
      <p className="muted small-text">{regelset.bron}</p>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Onderdeel</th><th>Status</th><th>Bron en opmerking</th></tr></thead>
          <tbody>
            {onderdelen.map(item => (
              <tr key={item.naam}>
                <td>{item.naam}</td>
                <td><span className={regelStatus[item.status][0]}>{regelStatus[item.status][1]}</span></td>
                <td className="muted small-text">{item.bron}{item.opmerking && <><br />{item.opmerking}</>}{item.ontbrekend.length > 0 && <><br /><b>Ontbreekt:</b> {item.ontbrekend.join(', ')}</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function WwsoModule({ onCalculate, onOpen }: { onCalculate: () => void; onOpen: (record: WwsoCalculation) => void }) {
  const { records, removeRecord, confirm, notify } = useApp()
  const lijst = records.wwso
  const scored = lijst.filter(item => item.points !== undefined && item.points !== null)
  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + (item.points ?? 0), 0) / scored.length) : 0
  const remove = async (id: number) => {
    if (!(await confirm('Deze kamerwaardering wordt verwijderd.'))) return
    if (await removeRecord('wwso', id)) notify('Berekening verwijderd')
  }
  return (
    <>
      <PageHead eyebrow="WWSO" title="Kamers waarderen" description="Puntentelling voor onzelfstandige woonruimte, inclusief gedeelde ruimten en voorzieningen. Los van de WWS-berekening voor zelfstandige woningen.">
        <button type="button" className="button" onClick={onCalculate}><Icon name="calc" size={16} /> Kamer waarderen</button>
      </PageHead>
      <div className="stats-grid">
        <Stat label="Gewaardeerde kamers" value={String(lijst.length)} icon="users" />
        <Stat label="Gemiddeld aantal punten" value={average ? String(average) : '—'} trend={scored.length ? `Over ${scored.length} kamers` : 'Nog geen punten'} icon="check" tone="sage" />
        <Stat label="Onvolledig" value={String(lijst.filter(item => item.betrouwbaarheid === 'onvolledig').length)} trend="Ontbrekende gegevens" icon="alert" tone="gold" />
        <Stat label="Maximale huur" value="—" trend="Huurtabel nog in te voeren" icon="euro" tone="gold" />
      </div>
      <RegelsetStatus />
      <div className="panel">
        <PanelHeading title="Opgeslagen kamerwaarderingen" subtitle="Klik op een kamer om de berekening te openen" />
        {lijst.length === 0 ? (
          <EmptyState icon="users" title="Nog geen kamers gewaardeerd" text="Waardeer een kamer om de punten vast te leggen." action={<button type="button" className="button" onClick={onCalculate}>Kamer waarderen</button>} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Kamer</th><th>Pand</th><th>Peildatum</th><th>Punten</th><th>Uitkomst</th><th className="right">Max. huur</th><th /></tr></thead>
              <tbody>
                {lijst.map(item => (
                  <tr key={item.id}>
                    <td><button type="button" className="link-button strong" onClick={() => onOpen(item)}>{item.label}</button></td>
                    <td>{item.property || '—'}</td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.points ?? '—'}</td>
                    <td>{item.betrouwbaarheid && <Badge value={item.betrouwbaarheid} />}</td>
                    <td className="right">{item.rent ? <strong>{money(item.rent)}</strong> : '—'}</td>
                    <td className="right"><button type="button" className="icon-button danger-icon" aria-label="Verwijderen" onClick={() => remove(item.id)}><Icon name="trash" size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
