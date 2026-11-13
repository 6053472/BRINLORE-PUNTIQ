'use client'

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, Status } from './ui'
import { berekenWws, energielabels, kiesRegelset, legeInvoer, nieuweRuimte, type Betrouwbaarheid, type Energielabel, type WwsInvoer } from '../lib/wws'
import { BetrouwbaarheidBadge } from './Wws'
import { downloadCsv, money, resizeImage, today } from '../lib/format'
import type { Property } from '../lib/types'

export const propertyImages = (property: Property) => (property.images?.length ? property.images : property.image ? [property.image] : [])
export const propertyStatuses = ['Beschikbaar', 'Verhuurd', 'In onderhoud']

type Estimate = { points: number; rent: number; price: number; reliability: Betrouwbaarheid | null; missing: string[] }
const emptyEstimate: Estimate = { points: 0, rent: 0, price: 0, reliability: null, missing: [] }

/** Snelle WWS-schatting met dezelfde rekenmotor en regelset als de WWS-module. */
function estimate(data: FormData): Estimate {
  const area = Number(data.get('area')) || 0
  const type = String(data.get('type'))
  const regelset = kiesRegelset(today())
  if (!area || type === 'Bedrijfsruimte' || !regelset) return emptyEstimate
  const heated = Math.max(0, Number(data.get('heatingRooms')) || 0)
  const heatedOther = Math.max(0, Number(data.get('heatingOtherRooms')) || 0)
  const label = String(data.get('energyLabel') || '')
  const sanitair = String(data.get('bathroomPoints') ?? '')
  const invoer: WwsInvoer = {
    ...legeInvoer(today()),
    bouwjaar: Number(data.get('yearBuilt')) || null,
    // Eén vertrek draagt de oppervlakte; de overige tellen alleen mee voor verwarming.
    vertrekken: Array.from({ length: Math.max(1, heated) }, (_, index) => nieuweRuimte(`Vertrek ${index + 1}`, index === 0 ? area : 0, index < heated)),
    overigeRuimten: Array.from({ length: heatedOther }, (_, index) => nieuweRuimte(`Overige ruimte ${index + 1}`, 0, true)),
    energielabel: (energielabels as string[]).includes(label) ? (label as Energielabel) : null,
    keuken: { aanrechtLengteMeters: Number(data.get('counterLength')) || 0, voorzieningen: {}, extraPuntenHandmatig: 0 },
    buitenruimte: { priveM2: Number(data.get('outdoorArea')) || 0 },
    woz: { waarde: Number(data.get('woz')) || null, regioKenmerken: [] },
    handmatig: sanitair === '' ? {} : { sanitair: { punten: Number(sanitair) || 0, toelichting: 'Woningformulier' } },
  }
  const result = berekenWws(invoer, regelset)
  const missing = result.rubrieken.filter(item => item.punten === null).map(item => item.naam.toLowerCase())
  if (result.totaalPunten === null) return { ...emptyEstimate, reliability: result.betrouwbaarheid, missing }
  const rent = result.maximaleHuur ?? result.tabelHuur ?? 0
  return { points: result.totaalPunten, rent, price: Math.round((rent * 12) / 0.045 / 1000) * 1000, reliability: result.betrouwbaarheid, missing }
}

export function PropertyModal({ property, onClose }: { property?: Property; onClose: () => void }) {
  const { saveProperty, notify } = useApp()
  const [images, setImages] = useState<string[]>(propertyImages(property ?? ({} as Property)))
  const [suggestion, setSuggestion] = useState<Estimate>(emptyEstimate)
  const [rent, setRent] = useState(property?.rent ? String(property.rent) : '')
  const [price, setPrice] = useState(property?.price ? String(property.price) : '')
  const [points, setPoints] = useState(property?.points ? String(property.points) : '')
  const [busy, setBusy] = useState(false)

  const onFormChange = (form: HTMLFormElement | null) => form && setSuggestion(estimate(new FormData(form)))

  const chooseImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(file => file.type.startsWith('image/'))
    event.target.value = ''
    if (!files.length) return
    try {
      const resized = await Promise.all(files.map(file => resizeImage(file, 1600)))
      setImages(current => [...current, ...resized].slice(0, 12))
    } catch {
      notify('Een van de foto\'s kon niet worden verwerkt.', 'error')
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    const d = new FormData(event.currentTarget)
    const saved = await saveProperty(
      {
        name: String(d.get('name')),
        address: String(d.get('address')),
        type: String(d.get('type')),
        status: String(d.get('status')),
        points: Number(points) || 0,
        rent: Number(rent) || 0,
        price: Number(price) || undefined,
        images,
        image: images[0] ?? '',
        area: Number(d.get('area')) || undefined,
        rooms: Number(d.get('rooms')) || undefined,
        bedrooms: Number(d.get('bedrooms')) || undefined,
        yearBuilt: Number(d.get('yearBuilt')) || undefined,
        energyLabel: String(d.get('energyLabel') || ''),
        floor: String(d.get('floor') || ''),
        description: String(d.get('description') || ''),
      },
      property?.id,
    )
    if (saved) {
      notify(property ? 'Woning bijgewerkt' : 'Woning toegevoegd aan uw portefeuille')
      onClose()
    } else setBusy(false)
  }

  return (
    <Modal
      wide
      eyebrow="VASTGOEDBEHEER"
      title={property ? 'Woning bewerken' : 'Nieuwe woning'}
      subtitle="Voer de belangrijkste woninginformatie in."
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="button ghost" onClick={onClose}>Annuleren</button>
          <button className="button" disabled={busy}>{busy ? 'Bezig…' : property ? 'Opslaan' : 'Woning toevoegen'}</button>
        </>
      }
    >
      <div className="property-form-layout">
        <div className="property-upload">
          <div className="property-upload-preview">{images[0] ? <img src={images[0]} alt="Voorbeeld woning" /> : <Icon name="image" size={34} />}</div>
          <label className="dropzone">
            <Icon name="image" size={22} />
            <strong>{images.length ? 'Meer foto’s toevoegen' : 'Foto’s toevoegen'}</strong>
            <small>JPG, PNG of WEBP · automatisch verkleind</small>
            <input type="file" accept="image/*" multiple onChange={chooseImages} hidden />
          </label>
          {images.length > 0 && (
            <div className="property-upload-thumbnails">
              {images.map((image, index) => (
                <span key={`${index}-${image.length}`} className="thumb">
                  <img src={image} alt={`Foto ${index + 1}`} />
                  <button type="button" aria-label={`Foto ${index + 1} verwijderen`} onClick={() => setImages(current => current.filter((_, i) => i !== index))}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="property-fields">
          <PropertyFields property={property} onChange={onFormChange} rent={rent} price={price} setRent={setRent} setPrice={setPrice} setPoints={setPoints} suggestion={suggestion} />
        </div>
      </div>
    </Modal>
  )
}

function PropertyFields({ property, onChange, rent, price, setRent, setPrice, setPoints, suggestion }: {
  property?: Property
  onChange: (form: HTMLFormElement | null) => void
  rent: string
  price: string
  setRent: (value: string) => void
  setPrice: (value: string) => void
  setPoints: (value: string) => void
  suggestion: Estimate
}) {
  return (
    <fieldset className="plain" onChange={event => onChange((event.currentTarget as HTMLElement).closest('form'))}>
      <div className="form-grid">
        <label>Naam woning *<input name="name" defaultValue={property?.name} placeholder="bijv. Keizersgracht 12" required /></label>
        <label>Adres / postcode *<input name="address" defaultValue={property?.address} placeholder="1015 AA Amsterdam" required /></label>
        <label>Type
          <select name="type" defaultValue={property?.type ?? 'Zelfstandig'}><option>Zelfstandig</option><option>Onzelfstandig</option><option>Bedrijfsruimte</option></select>
        </label>
        <label>Status
          <select name="status" defaultValue={property?.status ?? 'Beschikbaar'}>{propertyStatuses.map(status => <option key={status}>{status}</option>)}</select>
        </label>
        <label>Oppervlakte (m²) *<input name="area" type="number" min="1" defaultValue={property?.area} placeholder="bijv. 78" required /></label>
        <label>Kamers *<input name="rooms" type="number" min="1" defaultValue={property?.rooms} placeholder="bijv. 3" required /></label>
        <label>Slaapkamers<input name="bedrooms" type="number" min="0" defaultValue={property?.bedrooms} placeholder="bijv. 2" /></label>
        <label>Bouwjaar<input name="yearBuilt" type="number" min="1800" max="2100" defaultValue={property?.yearBuilt} placeholder="bijv. 1924" /></label>
        <label>Woonlaag<input name="floor" defaultValue={property?.floor} placeholder="bijv. 2e verdieping" /></label>
        <label>Energielabel
          <select name="energyLabel" defaultValue={property?.energyLabel ?? ''}>
            <option value="">Onbekend</option>
            {['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="calc-box">
        <div className="calc-head">
          <strong>WWS-schatting <span className="muted">(optioneel)</span></strong>
          <small className="muted">Vul onderstaande gegevens in voor een indicatieve huurprijs en vraagprijs.</small>
        </div>
        <div className="form-grid">
          <label>WOZ-waarde (€)<input name="woz" type="number" min="0" step="1000" placeholder="bijv. 350000" /></label>
          <label>Privé-buitenruimte (m²)<input name="outdoorArea" type="number" min="0" placeholder="bijv. 8" /></label>
          <label>Verwarmde vertrekken<input name="heatingRooms" type="number" min="0" placeholder="bijv. 3" /></label>
          <label>Verwarmde overige ruimtes<input name="heatingOtherRooms" type="number" min="0" max="4" placeholder="bijv. 1" /></label>
          <label>Aanrechtlengte keuken (m)<input name="counterLength" type="number" min="0" step="0.1" placeholder="bijv. 2,4" /></label>
          <label>Sanitair (punten)<input name="bathroomPoints" type="number" min="0" step="0.25" placeholder="zelf vastgesteld" /></label>
        </div>
        <div className="calc-result">
          {suggestion.points ? (
            <>
              <span>{suggestion.reliability && <BetrouwbaarheidBadge value={suggestion.reliability} />} <b>{suggestion.points}</b> punten · max. huur <b>{money(suggestion.rent)}</b> · indicatieve waarde <b>{money(suggestion.price)}</b> (4,5% bruto)</span>
              <button type="button" className="button small" onClick={() => { setRent(String(suggestion.rent)); setPrice(String(suggestion.price)); setPoints(String(suggestion.points)) }}>Overnemen</button>
            </>
          ) : (
            <span className="muted">{suggestion.missing.length ? `Nog nodig voor een schatting: ${suggestion.missing.join(', ')}.` : 'Vul oppervlakte en WWS-gegevens in voor een schatting.'} Gebruik de WWS-module voor een berekening per ruimte.</span>
          )}
        </div>
      </div>
      <div className="form-grid">
        <label>Huurprijs per maand (€)<input type="number" min="0" step="0.01" value={rent} onChange={event => setRent(event.target.value)} placeholder="bijv. 1250" /></label>
        <label>Vraagprijs / waarde (€)<input type="number" min="0" step="1" value={price} onChange={event => setPrice(event.target.value)} placeholder="bijv. 385000" /></label>
        <label className="wide-field">Beschrijving<textarea name="description" rows={3} defaultValue={property?.description} placeholder="Bijzonderheden, voorzieningen en andere informatie…" /></label>
      </div>
    </fieldset>
  )
}

export function PropertyDetail({ property, onClose, onEdit }: { property: Property; onClose: () => void; onEdit: () => void }) {
  const { records, saveProperty, removeProperty, confirm, notify } = useApp()
  const images = propertyImages(property)
  const [active, setActive] = useState(0)
  const [touch, setTouch] = useState<number | null>(null)
  const step = (direction: number) => images.length > 1 && setActive(current => (current + direction + images.length) % images.length)
  const contract = records.contracts.find(item => item.property === property.name && item.status === 'Actief')
  const open = records.maintenance.filter(item => item.property === property.name && item.status !== 'Afgerond').length

  const changeStatus = async (status: string) => {
    if (await saveProperty({ ...property, status }, property.id)) notify(`Status: ${status}`)
  }
  const remove = async () => {
    if (!(await confirm(`Woning '${property.name}' wordt definitief verwijderd.`))) return
    if (await removeProperty(property.id)) {
      notify('Woning verwijderd')
      onClose()
    }
  }

  const facts: [string, string][] = [
    ['Type', property.type],
    ['Oppervlakte', property.area ? `${property.area} m²` : '—'],
    ['Kamers', property.rooms ? String(property.rooms) : '—'],
    ['Slaapkamers', property.bedrooms != null ? String(property.bedrooms) : '—'],
    ['Bouwjaar', property.yearBuilt ? String(property.yearBuilt) : '—'],
    ['Woonlaag', property.floor || '—'],
    ['Energielabel', property.energyLabel || 'Onbekend'],
    ['WWS-punten', property.points ? String(property.points) : '—'],
    ['Vraagprijs / waarde', property.price ? money(property.price) : '—'],
  ]

  return (
    <Modal wide eyebrow="WONINGDETAILS" title={property.name} subtitle={property.address} onClose={onClose}
      actions={
        <>
          <button type="button" className="button danger ghost" onClick={remove}><Icon name="trash" size={16} /> Verwijderen</button>
          <button type="button" className="button ghost" onClick={onEdit}><Icon name="edit" size={16} /> Bewerken</button>
          <button type="button" className="button" onClick={onClose}>Sluiten</button>
        </>
      }
    >
      {images.length > 0 && (
        <div className="gallery" onTouchStart={event => setTouch(event.touches[0]?.clientX ?? null)} onTouchEnd={event => {
          if (touch === null) return
          const distance = (event.changedTouches[0]?.clientX ?? touch) - touch
          if (Math.abs(distance) > 40) step(distance < 0 ? 1 : -1)
          setTouch(null)
        }}>
          <img src={images[Math.min(active, images.length - 1)]} alt={`${property.name}, foto ${active + 1} van ${images.length}`} />
          {images.length > 1 && (
            <>
              <button type="button" className="gallery-arrow prev" aria-label="Vorige foto" onClick={() => step(-1)}>‹</button>
              <button type="button" className="gallery-arrow next" aria-label="Volgende foto" onClick={() => step(1)}>›</button>
              <span className="gallery-counter">{active + 1} / {images.length}</span>
            </>
          )}
        </div>
      )}
      <div className="rent-highlight">
        <div><small>Huurprijs per maand</small><strong>{property.rent ? money(property.rent) : 'Niet ingevuld'}</strong></div>
        <label className="status-picker">Status
          <select value={property.status} onChange={event => changeStatus(event.target.value)}>{propertyStatuses.map(status => <option key={status}>{status}</option>)}</select>
        </label>
      </div>
      <dl className="facts">
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="linked">
        <span><Icon name="file" size={15} /> {contract ? <>Actief contract: <b>{contract.tenant}</b></> : 'Geen actief contract'}</span>
        <span><Icon name="wrench" size={15} /> {open ? `${open} open onderhoudsverzoek${open > 1 ? 'en' : ''}` : 'Geen open onderhoud'}</span>
      </div>
      {property.description && <div className="description"><small>Beschrijving</small><p>{property.description}</p></div>}
    </Modal>
  )
}

export function PropertiesModule({ onSelect, onAdd }: { onSelect: (property: Property) => void; onAdd: () => void }) {
  const { properties, loading } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return properties.filter(property => (!status || property.status === status) && (!needle || `${property.name} ${property.address} ${property.type} ${property.description ?? ''}`.toLowerCase().includes(needle)))
  }, [properties, query, status])

  return (
    <>
      <PageHead eyebrow="VASTGOED" title="Vastgoed" description="Beheer en organiseer uw volledige vastgoedportefeuille.">
        <button type="button" className="button" onClick={onAdd}><Icon name="plus" size={16} /> Nieuwe woning</button>
      </PageHead>
      <div className="panel">
        <div className="table-tools">
          <div className="search"><Icon name="search" size={16} /><input className="global-search" aria-label="Zoek in vastgoed" placeholder="Zoek op naam, adres of type…" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <select className="filter-select" aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">Status: alle</option>
            {propertyStatuses.map(item => <option key={item}>{item}</option>)}
          </select>
          <div className="segmented" role="group" aria-label="Weergave">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Kaarten</button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Tabel</button>
          </div>
          <button type="button" className="button ghost small" disabled={!visible.length} onClick={() => downloadCsv('vastgoed.csv', [['Naam', 'Adres', 'Type', 'Status', 'm²', 'Kamers', 'Energielabel', 'WWS-punten', 'Huur', 'Waarde'], ...visible.map(p => [p.name, p.address, p.type, p.status, p.area, p.rooms, p.energyLabel, p.points, p.rent, p.price])])}>
            <Icon name="download" size={15} /> Exporteren
          </button>
        </div>
        {loading ? <p className="muted pad">Laden…</p> : properties.length === 0 ? (
          <EmptyState icon="building" title="Uw portefeuille is nog leeg" text="Voeg uw eerste woning toe om te beginnen met beheren." action={<button type="button" className="button" onClick={onAdd}><Icon name="plus" size={16} /> Nieuwe woning</button>} />
        ) : visible.length === 0 ? <EmptyState icon="search" title="Geen resultaten" text="Pas uw zoekopdracht of filter aan." />
        : view === 'grid' ? <PropertyGrid properties={visible} onSelect={onSelect} /> : <PropertyTable properties={visible} onSelect={onSelect} />}
      </div>
    </>
  )
}

export function PropertyGrid({ properties, onSelect }: { properties: Property[]; onSelect: (property: Property) => void }) {
  return (
    <div className="property-grid">
      {properties.map(property => {
        const image = propertyImages(property)[0]
        return (
          <button type="button" className="property-card" key={property.id} onClick={() => onSelect(property)}>
            <div className="property-card-image">
              {image ? <img src={image} alt={`Foto van ${property.name}`} loading="lazy" /> : <Icon name="building" size={40} />}
              <Status value={property.status} />
            </div>
            <div className="property-card-content">
              <div className="property-card-heading">
                <div><h3>{property.name}</h3><p>{property.address}</p></div>
                <strong>{property.rent ? money(property.rent) : '—'}<small>/ maand</small></strong>
              </div>
              <p className="property-card-meta">{[property.area && `${property.area} m²`, property.rooms && `${property.rooms} kamers`, property.energyLabel && `Label ${property.energyLabel}`].filter(Boolean).join(' · ') || property.type}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function PropertyTable({ properties, onSelect }: { properties: Property[]; onSelect: (property: Property) => void }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Object</th><th>Type</th><th>Status</th><th>WWS-punten</th><th className="right">Huurprijs</th></tr></thead>
        <tbody>
          {properties.map(property => (
            <tr key={property.id} className="clickable" tabIndex={0} onClick={() => onSelect(property)} onKeyDown={event => event.key === 'Enter' && onSelect(property)}>
              <td><strong>{property.name}</strong><span className="sub">{property.address}</span></td>
              <td>{property.type}</td>
              <td><Status value={property.status} /></td>
              <td>{property.points ? `${property.points} pt` : '—'}</td>
              <td className="right"><strong>{property.rent ? money(property.rent) : '—'}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
