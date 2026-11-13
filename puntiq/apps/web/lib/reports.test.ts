/** Tests voor rapportages en de PDF-/Excel-export.  npm test */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildReport, formatCell, reportFileName, type ReportData, type ReportDocument } from './reports'
import { buildPdf, buildXlsx, xlsxSheets } from './report-export'

const c = '2026-01-01T00:00:00Z'
const data: ReportData = {
  properties: [
    { id: 1, name: 'Singel 229-1', address: 'Singel 229', type: 'Appartement', status: 'Verhuurd', points: 168, rent: 1095, area: 68, energyLabel: 'C' },
    { id: 2, name: 'Herengracht 12', address: 'Herengracht 12', type: 'Studio', status: 'Beschikbaar', points: 0, rent: 0, area: 31 },
    { id: 3, name: 'Kantoor', address: 'Dam 1', type: 'Bedrijfsruimte', status: 'Verhuurd', points: 0, rent: 2500 },
  ],
  tenants: [{ id: 5, createdAt: c, name: 'Eva Jansen', status: 'Actief' }, { id: 6, createdAt: c, name: 'Bas de Boer', status: 'Vertrokken' }],
  contracts: [{ id: 9, createdAt: c, property: 'Singel 229-1', propertyId: 1, tenant: 'Eva Jansen', tenantId: 5, start: '2025-02-01', status: 'Actief', rent: 1095 }],
  invoices: [
    { id: 20, createdAt: c, number: 'F2026-0001', description: 'Huur sep', type: 'Huur', tenant: 'Eva Jansen', tenantId: 5, property: 'Singel 229-1', propertyId: 1, amount: 1095, issueDate: '2026-09-01', dueDate: '2026-09-15', status: 'Open' },
    { id: 21, createdAt: c, number: 'F2026-0002', description: 'Huur okt', type: 'Huur', tenant: 'Eva Jansen', tenantId: 5, property: 'Singel 229-1', propertyId: 1, amount: 1095, issueDate: '2026-10-01', dueDate: '2026-10-15', status: 'Open' },
    { id: 22, createdAt: c, number: 'F2025-0009', description: 'Oud', type: 'Overig', amount: 50, issueDate: '2025-06-01', dueDate: '2025-06-15', status: 'Geannuleerd' },
  ],
  payments: [{ id: 30, createdAt: c, amount: 1095, receivedOn: '2026-09-12', method: 'Overboeking', invoiceId: 20, tenant: 'Eva Jansen', tenantId: 5, property: 'Singel 229-1', propertyId: 1 }],
  maintenance: [
    { id: 40, createdAt: c, title: 'Lekkage', property: 'Singel 229-1', priority: 'Hoog', status: 'Open', date: '2026-10-03', cost: 240.5 },
    { id: 41, createdAt: c, title: 'Schilderwerk', property: 'Herengracht 12', priority: 'Laag', status: 'Afgerond', date: '2025-05-01', cost: 900 },
  ],
  wws: [{ id: 50, createdAt: c, label: 'Singel 229-1', property: 'Singel 229-1', date: '2026-06-01', points: 168, rent: 1104.5, segment: 'Middenhuur', betrouwbaarheid: 'indicatief' }],
  wwso: [],
}
const options = { from: '2026-01-01', to: '2026-12-31', company: 'Demo Vastgoed B.V.', generatedBy: 'Demi', now: '2026-11-13', contractReminderDays: 90 }
const kpi = (doc: ReportDocument, label: string) => doc.sections[0].kpis!.find(item => item.label.startsWith(label))?.value
const table = (doc: ReportDocument, title: string) => doc.sections.find(section => section.title === title)!.table!

describe('rapportinhoud', () => {
  test('vastgoed: bezetting en objectenlijst met huurder uit het actieve contract', () => {
    const doc = buildReport('vastgoed', data, options)
    assert.equal(kpi(doc, 'Objecten'), 3)
    assert.equal(kpi(doc, 'Bezettingsgraad'), 0.67)
    const singel = table(doc, 'Objecten').rows.find(row => row.name === 'Singel 229-1')!
    assert.equal(singel.tenant, 'Eva Jansen')
  })

  test('huurders: achterstand per huurder vanuit de facturen', () => {
    const doc = buildReport('huurders', data, options)
    const eva = table(doc, 'Huurders').rows.find(row => row.name === 'Eva Jansen')!
    assert.equal(eva.overdue, 1095)
    assert.equal(kpi(doc, 'Met achterstand'), 1)
  })

  test('huurinkomsten: periode, geannuleerde facturen tellen niet mee', () => {
    const doc = buildReport('inkomsten', data, options)
    assert.equal(kpi(doc, 'Gefactureerd'), 2190)
    assert.equal(kpi(doc, 'Ontvangen'), 1095)
    assert.equal(kpi(doc, 'Ontvangen / gefactureerd'), 0.5)
    assert.equal(table(doc, 'Per maand').rows.length, 12)
    assert.equal(table(doc, 'Openstaande facturen').rows.length, 1)
  })

  test('onderhoud: alleen binnen de periode', () => {
    const doc = buildReport('onderhoud', data, options)
    assert.equal(kpi(doc, 'Verzoeken'), 1)
    assert.equal(kpi(doc, 'Totale kosten'), 240.5)
  })

  test('WWS: betrouwbaarheid en woningen zonder berekening (geen bedrijfsruimte)', () => {
    const doc = buildReport('wws', data, options)
    assert.equal(table(doc, 'WWS — zelfstandige woonruimte').rows[0].reliability, 'Indicatief')
    assert.deepEqual(table(doc, 'Woningen zonder berekening').rows.map(row => row.name), ['Herengracht 12'])
    assert.ok(doc.disclaimer)
  })

  test('filter op één woning', () => {
    const doc = buildReport('inkomsten', data, { ...options, propertyId: 2 })
    assert.equal(kpi(doc, 'Gefactureerd'), 0)
    assert.match(doc.filters[0], /Herengracht 12/)
  })
})

describe('opmaak', () => {
  test('bedragen, percentages en datums in Nederlandse notatie', () => {
    assert.equal(formatCell(1095, 'money').replace(/\s/g, ' '), '€ 1.095,00')
    assert.equal(formatCell(0.675, 'percent'), '67,5%')
    assert.equal(formatCell('2026-10-15', 'date'), '15-10-2026')
    assert.equal(formatCell(null, 'money'), '—')
  })

  test('bestandsnaam zonder accenten of spaties', () => {
    assert.equal(reportFileName(buildReport('wws', data, options)), 'wws-en-wwso-berekeningen-2026-01-01-tm-2026-12-31')
  })
})

describe('export', () => {
  test('Excel: samenvatting plus een tabblad per tabel, met echte getallen en datums', () => {
    const sheets = xlsxSheets(buildReport('inkomsten', data, options))
    assert.deepEqual(sheets.map(sheet => sheet.sheet), ['Samenvatting', 'Per maand', 'Per woning', 'Per huurder', 'Ouderdom achterstanden', 'Openstaande facturen'])
    const open = sheets.find(sheet => sheet.sheet === 'Openstaande facturen')!.data
    const [, firstRow] = open
    assert.ok(firstRow![4]!.value instanceof Date) // vervaldatum
    assert.equal(firstRow![6]!.type, Number) // openstaand bedrag
    assert.match(String(firstRow![6]!.format), /€/)
  })

  test('Excel: tabbladnamen zijn geldig en uniek', () => {
    const doc = buildReport('vastgoed', data, options)
    doc.sections.push({ title: 'Objecten', table: { columns: [], rows: [] } }, { title: 'Een veel te lange titel: met [verboden] tekens?', table: { columns: [], rows: [] } })
    const names = xlsxSheets(doc).map(sheet => sheet.sheet)
    assert.equal(new Set(names.map(name => name.toLowerCase())).size, names.length)
    for (const name of names) assert.ok(name.length <= 31 && !/[[\]:*?/\\]/.test(name), name)
  })

  test('Excel: geldig .xlsx-bestand (zip)', async () => {
    const bytes = new Uint8Array(await (await buildXlsx(buildReport('onderhoud', data, options))).arrayBuffer())
    assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK')
    assert.ok(bytes.length > 2000)
  })

  test('PDF: geldig bestand met paginanummering', async () => {
    const pdf = await buildPdf(buildReport('inkomsten', data, options))
    const output = pdf.output()
    assert.ok(output.startsWith('%PDF-'))
    assert.ok(pdf.getNumberOfPages() >= 1)
    assert.match(output, /Pagina 1 van \d/)
  })
})
