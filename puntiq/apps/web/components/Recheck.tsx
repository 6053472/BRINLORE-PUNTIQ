'use client'

import { Modal, Pagination, usePagination } from './ui'
import { formatDate, money } from '../lib/format'
import { controleLabel, type Controle, type ControleStatus } from '../lib/recheck'

export type RecheckRow = { id: number; label: string; date?: string; points?: number; rent?: number; controle: Controle }

const tone: Record<ControleStatus, string> = {
  ongewijzigd: 'status s-actief',
  afwijkend: 'status tone-bad',
  nieuwe_regelset: 'status tone-warn',
  geen_invoer: 'status tone-neutral',
  regelset_onbekend: 'status tone-bad',
}
const order: Record<ControleStatus, number> = { afwijkend: 0, regelset_onbekend: 1, nieuwe_regelset: 2, geen_invoer: 3, ongewijzigd: 4 }
const fmtPoints = (value: number | null | undefined) => (value == null ? '—' : String(value))
const fmtRent = (value: number | null | undefined) => (value ? money(value) : '—')

/** Toont per opgeslagen berekening of een nieuwe doorrekening hetzelfde uitkomt. */
export function RecheckModal({ title, rows, onOpen, onClose }: { title: string; rows: RecheckRow[]; onOpen: (id: number) => void; onClose: () => void }) {
  const sorted = [...rows].sort((a, b) => order[a.controle.status] - order[b.controle.status])
  const pager = usePagination(sorted, 25)
  const count = (status: ControleStatus) => rows.filter(row => row.controle.status === status).length
  const problems = rows.length - count('ongewijzigd')

  return (
    <Modal
      wide
      eyebrow="CONTROLE"
      title={title}
      subtitle="Elke berekening wordt opnieuw doorgerekend met de bewaarde invoer en regelset en vergeleken met het opgeslagen resultaat."
      onClose={onClose}
      actions={<button type="button" className="button" onClick={onClose}>Sluiten</button>}
    >
      <div className="import-summary">
        <span className="status s-actief">{count('ongewijzigd')} kloppen</span>
        {count('afwijkend') > 0 && <span className="status tone-bad">{count('afwijkend')} afwijkend</span>}
        {count('nieuwe_regelset') > 0 && <span className="status tone-warn">{count('nieuwe_regelset')} met nieuwere regelset</span>}
        {count('regelset_onbekend') > 0 && <span className="status tone-bad">{count('regelset_onbekend')} regelset onbekend</span>}
        {count('geen_invoer') > 0 && <span className="status tone-neutral">{count('geen_invoer')} zonder invoer</span>}
      </div>
      {rows.length === 0 ? <p className="muted">Er zijn nog geen berekeningen om te controleren.</p> : (
        <>
          {problems === 0 && <p className="muted">Alle berekeningen komen overeen met een nieuwe doorrekening.</p>}
          <div className="table-scroll">
            <table>
              <thead><tr><th>Berekening</th><th>Datum</th><th>Opgeslagen</th><th>Nu berekend</th><th>Controle</th><th /></tr></thead>
              <tbody>
                {pager.slice.map(row => {
                  const { controle } = row
                  const nieuwe = controle.nieuweRegelset
                  return (
                    <tr key={row.id}>
                      <td><strong>{row.label}</strong></td>
                      <td>{formatDate(row.date)}</td>
                      <td>{fmtPoints(row.points)} pt · {fmtRent(row.rent)}</td>
                      <td>
                        {controle.status === 'geen_invoer' || controle.status === 'regelset_onbekend' ? '—' : `${fmtPoints(controle.punten)} pt · ${fmtRent(controle.huur)}`}
                        {nieuwe && <small className="sub">Met {nieuwe.naam}: {fmtPoints(nieuwe.punten)} pt · {fmtRent(nieuwe.huur)}</small>}
                      </td>
                      <td><span className={tone[controle.status]}>{controleLabel[controle.status]}</span></td>
                      <td className="right">{controle.status !== 'geen_invoer' && <button type="button" className="link-button" onClick={() => onOpen(row.id)}>Openen</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination pager={pager} noun="berekeningen" />
        </>
      )}
    </Modal>
  )
}
