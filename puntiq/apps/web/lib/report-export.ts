/**
 * Export van een ReportDocument naar Excel (.xlsx) en PDF.
 * De bibliotheken worden pas geladen bij een export (dynamische import), zodat ze de app niet vertragen.
 * `buildXlsx` en `buildPdf` werken zowel in de browser als in Node (voor tests).
 */
import { formatCell, reportFileName, type Cell, type ColumnType, type ReportDocument } from './reports'

const NAVY: [number, number, number] = [20, 43, 59]
const GOLD: [number, number, number] = [185, 154, 97]
const SAND: [number, number, number] = [247, 242, 233]
const MUTED: [number, number, number] = [62, 83, 99]

const periodText = (doc: ReportDocument) => (doc.period ? `Periode ${formatCell(doc.period.from, 'date')} t/m ${formatCell(doc.period.to, 'date')}` : '')
const generatedText = (doc: ReportDocument) => `Gegenereerd op ${formatCell(doc.generatedAt, 'date')}${doc.generatedBy ? ` door ${doc.generatedBy}` : ''}`

/* ---------- Excel ---------- */

const EXCEL_FORMATS: Partial<Record<ColumnType, string>> = {
  money: '"€" #,##0.00;[Red]-"€" #,##0.00',
  percent: '0.0%',
  number: '#,##0.##',
  date: 'dd-mm-yyyy',
}

type XlsxCell = { value?: string | number | Date; type?: StringConstructor | NumberConstructor | DateConstructor; format?: string; fontWeight?: 'bold'; backgroundColor?: string; color?: string; wrap?: boolean } | null

function xlsxCell(value: Cell, type: ColumnType, style: Partial<NonNullable<XlsxCell>> = {}): XlsxCell {
  if (value === null || value === '') return Object.keys(style).length ? { ...style } : null
  if (type === 'date' && typeof value === 'string') {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) return { value: date, type: Date, format: EXCEL_FORMATS.date, ...style }
  }
  if (typeof value === 'number' && type !== 'text') return { value, type: Number, format: EXCEL_FORMATS[type], ...style }
  return { value: String(value), type: String, ...style }
}

/** Geldige, unieke Excel-tabbladnaam (max. 31 tekens, zonder []:*?/\). */
function sheetName(title: string, used: Set<string>) {
  const base = title.replace(/[[\]:*?/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Blad'
  let name = base
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`
  used.add(name.toLowerCase())
  return name
}

export function xlsxSheets(doc: ReportDocument) {
  const used = new Set<string>()
  const header = { fontWeight: 'bold' as const, backgroundColor: '#142B3B', color: '#FFFFFF' }
  const bold = { fontWeight: 'bold' as const }

  // Tabblad 1: titel, metadata en alle kerncijfers.
  const summary: XlsxCell[][] = [
    [{ value: doc.title, type: String, fontWeight: 'bold' }],
    [xlsxCell(doc.company, 'text')],
    ...(doc.period ? [[xlsxCell(periodText(doc), 'text')]] : []),
    ...doc.filters.map(filter => [xlsxCell(filter, 'text')]),
    [xlsxCell(generatedText(doc), 'text')],
    [],
  ]
  for (const section of doc.sections.filter(item => item.kpis?.length)) {
    summary.push([{ value: section.title, type: String, ...bold }])
    for (const kpi of section.kpis!) summary.push([xlsxCell(kpi.label, 'text'), xlsxCell(kpi.value, kpi.type)])
    summary.push([])
  }
  if (doc.disclaimer) summary.push([{ value: doc.disclaimer, type: String, wrap: true }])
  const sheets = [{ sheet: sheetName('Samenvatting', used), data: summary, columns: [{ width: 42 }, { width: 22 }] }]

  // Per tabel een eigen tabblad, met echte getallen en datums zodat er in Excel mee gerekend kan worden.
  for (const section of doc.sections.filter(item => item.table)) {
    const { columns, rows, totals } = section.table!
    const data: XlsxCell[][] = [
      columns.map(column => ({ value: column.label, type: String, ...header })),
      ...rows.map(row => columns.map(column => xlsxCell(row[column.key] ?? null, column.type))),
    ]
    if (totals && rows.length) data.push(columns.map(column => xlsxCell(totals[column.key] ?? null, column.type, bold)))
    if (!rows.length) data.push([xlsxCell(section.empty ?? 'Geen gegevens.', 'text')])
    sheets.push({
      sheet: sheetName(section.title, used),
      data,
      columns: columns.map(column => ({ width: column.width ?? Math.max(12, column.label.length + 2) })),
      ...({ stickyRowsCount: 1 } as object),
    } as (typeof sheets)[number])
  }
  return sheets
}

export async function buildXlsx(doc: ReportDocument): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal')
  return (writeXlsxFile as unknown as (sheets: unknown[]) => { toBlob: () => Promise<Blob> })(xlsxSheets(doc)).toBlob()
}

/* ---------- PDF ---------- */

export async function buildPdf(doc: ReportDocument) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const margin = 14
  let y = margin

  pdf.setProperties({ title: `${doc.title} — ${doc.company}`, author: doc.generatedBy || doc.company, creator: 'BRINLORE PUNTIQ' })

  // Kop
  pdf.setFillColor(...NAVY).rect(0, 0, width, 30, 'F')
  pdf.setFillColor(...GOLD).rect(0, 30, width, 1.2, 'F')
  pdf.setTextColor(...GOLD).setFont('helvetica', 'bold').setFontSize(8).text('BRINLORE PUNTIQ · RAPPORTAGE', margin, 10)
  pdf.setTextColor(255, 255, 255).setFont('times', 'normal').setFontSize(20).text(doc.title, margin, 20)
  pdf.setFont('helvetica', 'normal').setFontSize(9).text(doc.company, width - margin, 12, { align: 'right' })
  pdf.text([periodText(doc), ...doc.filters].filter(Boolean).join('  ·  '), width - margin, 20, { align: 'right' })
  y = 40

  const ensureSpace = (needed: number) => {
    if (y + needed > height - 18) {
      pdf.addPage()
      y = margin + 4
    }
  }

  for (const section of doc.sections) {
    ensureSpace(24)
    pdf.setTextColor(...NAVY).setFont('times', 'normal').setFontSize(14).text(section.title, margin, y)
    y += 2
    pdf.setDrawColor(...GOLD).setLineWidth(0.4).line(margin, y, margin + 20, y)
    y += 5
    if (section.description) {
      pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
      const lines = pdf.splitTextToSize(section.description, width - margin * 2)
      pdf.text(lines, margin, y)
      y += lines.length * 4 + 2
    }

    if (section.kpis?.length) {
      const gap = 4
      const perRow = Math.min(section.kpis.length, 5)
      const boxWidth = (width - margin * 2 - gap * (perRow - 1)) / perRow
      section.kpis.forEach((kpi, index) => {
        const column = index % perRow
        if (column === 0 && index > 0) y += 20
        if (column === 0) ensureSpace(20)
        const x = margin + column * (boxWidth + gap)
        pdf.setFillColor(...SAND).rect(x, y, boxWidth, 16, 'F')
        pdf.setFillColor(...GOLD).rect(x, y, 1, 16, 'F')
        pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(kpi.label.toUpperCase(), x + 4, y + 5.5)
        pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY).text(formatCell(kpi.value, kpi.type), x + 4, y + 12.5)
      })
      y += 24
    }

    if (section.table) {
      const { columns, rows, totals } = section.table
      if (!rows.length) {
        pdf.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...MUTED).text(section.empty ?? 'Geen gegevens.', margin, y)
        y += 10
        continue
      }
      const numeric = (type: ColumnType) => type === 'money' || type === 'number' || type === 'percent'
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin, top: margin + 4, bottom: 18 },
        head: [columns.map(column => column.label)],
        body: rows.map(row => columns.map(column => formatCell(row[column.key] ?? null, column.type))),
        foot: totals ? [columns.map(column => (totals[column.key] === undefined ? '' : formatCell(totals[column.key], column.type)))] : undefined,
        showFoot: 'lastPage',
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: NAVY, lineColor: [221, 216, 205], lineWidth: { bottom: 0.1 } as never, overflow: 'linebreak' },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        footStyles: { fillColor: SAND, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [251, 249, 245] },
        columnStyles: Object.fromEntries(columns.map((column, index) => [index, { halign: numeric(column.type) ? 'right' : 'left' }])),
        didParseCell: data => {
          if ((data.section === 'head' || data.section === 'foot') && numeric(columns[data.column.index].type)) data.cell.styles.halign = 'right'
        },
      })
      y = ((pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 10
    }
  }

  if (doc.disclaimer) {
    const lines = pdf.splitTextToSize(doc.disclaimer, width - margin * 2)
    ensureSpace(lines.length * 4 + 6)
    pdf.setFont('helvetica', 'italic').setFontSize(8).setTextColor(...MUTED).text(lines, margin, y)
  }

  // Voettekst op elke pagina (achteraf, zodat het totaal aantal pagina's bekend is).
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor(...GOLD).setLineWidth(0.3).line(margin, height - 11, width - margin, height - 11)
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    pdf.text(`${doc.company} · ${doc.title} · ${generatedText(doc)}`, margin, height - 7)
    pdf.text(`Pagina ${page} van ${pages}`, width - margin, height - 7, { align: 'right' })
  }
  return pdf
}

/* ---------- Downloaden (alleen browser) ---------- */

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadReport(doc: ReportDocument, format: 'pdf' | 'xlsx') {
  const name = reportFileName(doc)
  if (format === 'xlsx') download(await buildXlsx(doc), `${name}.xlsx`)
  else download((await buildPdf(doc)).output('blob'), `${name}.pdf`)
}
