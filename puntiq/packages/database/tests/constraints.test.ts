/**
 * Integratietests voor de database-constraints. Vereist een gemigreerde database (DATABASE_URL).
 * Elke test draait in een transactie die altijd wordt teruggedraaid: de database blijft schoon.
 *   npm test
 */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
after(() => prisma.$disconnect())

type Tx = Prisma.TransactionClient
class Rollback extends Error {}

async function inRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await prisma.$transaction(async tx => {
      await fn(tx)
      throw new Rollback()
    }, { timeout: 20_000 })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }
}

/** Verwacht dat `fn` faalt op de genoemde constraint. Gebruikt een savepoint zodat de transactie bruikbaar blijft. */
async function expectViolation(tx: Tx, constraint: string, fn: () => Promise<unknown>) {
  await tx.$executeRawUnsafe('SAVEPOINT expect_violation')
  try {
    await fn()
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT expect_violation')
    const text = `${(error as Error).message} ${JSON.stringify((error as { meta?: unknown }).meta ?? {})}`
    assert.match(text, new RegExp(constraint), `Verwacht constraint ${constraint}, kreeg: ${text.slice(0, 400)}`)
    return
  }
  assert.fail(`Verwacht dat ${constraint} de bewerking blokkeert, maar die slaagde.`)
}

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
let sequence = 0

async function fixture(tx: Tx) {
  sequence += 1
  const company = await tx.company.create({ data: { name: `Test ${sequence}` } })
  const building = await tx.building.create({ data: { companyId: company.id, name: 'Testgebouw', street: 'Teststraat', postcode: '1234 AB', city: 'Utrecht' } })
  const unit = await tx.unit.create({ data: { companyId: company.id, buildingId: building.id, name: 'Teststraat 1', street: 'Teststraat', houseNumber: 1, postcode: '1234 AB', city: 'Utrecht' } })
  const tenant = await tx.tenant.create({ data: { companyId: company.id, displayName: 'Test Huurder' } })
  const contract = await tx.contract.create({
    data: { companyId: company.id, unitId: unit.id, contractNumber: 'C-1', status: 'ACTIVE', startDate: d('2026-01-01'), baseRent: 1000, tenants: { create: { tenantId: tenant.id, isPrimary: true } } },
  })
  return { company, building, unit, tenant, contract }
}

describe('tenant-isolatie', () => {
  test('een cross-tenant contract wordt bij COMMIT geweigerd', async () => {
    const ids = await prisma.$transaction(async tx => {
      const a = await fixture(tx)
      const b = await fixture(tx)
      return { a: a.company.id, b: b.company.id, unit: a.unit.id }
    })
    try {
      await assert.rejects(
        prisma.$transaction(tx => tx.contract.create({ data: { companyId: ids.b, unitId: ids.unit, contractNumber: 'X', startDate: d('2026-01-01'), baseRent: 1 } })),
        /contracts_company_id_unit_id_fkey/,
      )
    } finally {
      await prisma.company.deleteMany({ where: { id: { in: [ids.a, ids.b] } } })
    }
  })

  test('een contract kan niet naar een woning van een ander bedrijf wijzen', () => inRollback(async tx => {
    const a = await fixture(tx)
    const b = await fixture(tx)
    // Deze FK is DEFERRABLE INITIALLY DEFERRED: forceer de controle die anders bij COMMIT plaatsvindt.
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')
    await expectViolation(tx, 'contracts_company_id_unit_id_fkey', () =>
      tx.contract.create({ data: { companyId: b.company.id, unitId: a.unit.id, contractNumber: 'X', startDate: d('2026-01-01'), baseRent: 1 } }))
  }))

  test('een woning kan niet in een gebouw van een ander bedrijf staan', () => inRollback(async tx => {
    const a = await fixture(tx)
    const b = await fixture(tx)
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')
    await expectViolation(tx, 'units_company_id_building_id_fkey', () =>
      tx.unit.create({ data: { companyId: b.company.id, buildingId: a.building.id, name: 'X', street: 'X', houseNumber: 9, postcode: '1234 AB', city: 'X' } }))
  }))
})

describe('contracten', () => {
  test('geen twee overlappende actieve contracten op één woning', () => inRollback(async tx => {
    const { company, unit } = await fixture(tx)
    await expectViolation(tx, 'contracts_no_overlapping_active', () =>
      tx.contract.create({ data: { companyId: company.id, unitId: unit.id, contractNumber: 'C-2', status: 'ACTIVE', startDate: d('2026-06-01'), baseRent: 900 } }))
  }))

  test('een concept naast een actief contract mag wel', () => inRollback(async tx => {
    const { company, unit } = await fixture(tx)
    await tx.contract.create({ data: { companyId: company.id, unitId: unit.id, contractNumber: 'C-2', status: 'DRAFT', startDate: d('2026-06-01'), baseRent: 900 } })
  }))

  test('opeenvolgende contracten (einddatum = startdatum volgende) mogen', () => inRollback(async tx => {
    const { company, unit, contract } = await fixture(tx)
    await tx.contract.update({ where: { id: contract.id }, data: { endDate: d('2026-07-01') } })
    await tx.contract.create({ data: { companyId: company.id, unitId: unit.id, contractNumber: 'C-2', status: 'ACTIVE', startDate: d('2026-07-01'), baseRent: 900 } })
  }))

  test('einddatum moet na de startdatum liggen', () => inRollback(async tx => {
    const { contract } = await fixture(tx)
    await expectViolation(tx, 'contracts_end_after_start', () => tx.contract.update({ where: { id: contract.id }, data: { endDate: d('2025-12-31') } }))
  }))

  test('maximaal één hoofdhuurder per contract', () => inRollback(async tx => {
    const { company, contract } = await fixture(tx)
    const other = await tx.tenant.create({ data: { companyId: company.id, displayName: 'Tweede' } })
    await expectViolation(tx, 'contract_tenants_one_primary', () => tx.contractTenant.create({ data: { companyId: company.id, contractId: contract.id, tenantId: other.id, isPrimary: true } }))
  }))

  test('een huurder met een contract kan niet los worden verwijderd', () => inRollback(async tx => {
    const { tenant } = await fixture(tx)
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')
    await expectViolation(tx, 'contract_tenants_company_id_tenant_id_fkey', () => tx.tenant.delete({ where: { id: tenant.id } }))
  }))
})

describe('financiën', () => {
  test('dezelfde huurperiode wordt niet twee keer gefactureerd; na annulering wel opnieuw', () => inRollback(async tx => {
    const { company, contract } = await fixture(tx)
    const rent = (invoiceNumber: string) => ({ companyId: company.id, contractId: contract.id, invoiceNumber, kind: 'RENT' as const, status: 'OPEN' as const, issueDate: d('2026-10-20'), dueDate: d('2026-11-01'), periodStart: d('2026-11-01'), subtotal: 1000, total: 1000 })
    const first = await tx.invoice.create({ data: rent('F-1') })
    await expectViolation(tx, 'invoices_one_rent_per_period', () => tx.invoice.create({ data: rent('F-2') }))
    await tx.invoice.update({ where: { id: first.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
    await tx.invoice.create({ data: rent('F-3') })
  }))

  test('factuurtotaal moet gelijk zijn aan subtotaal + btw', () => inRollback(async tx => {
    const { company } = await fixture(tx)
    await expectViolation(tx, 'invoices_total_consistent', () =>
      tx.invoice.create({ data: { companyId: company.id, invoiceNumber: 'F-1', issueDate: d('2026-11-01'), dueDate: d('2026-11-15'), subtotal: 100, vatAmount: 21, total: 100 } }))
  }))

  test('factuurnummer is uniek per bedrijf, niet globaal', () => inRollback(async tx => {
    const a = await fixture(tx)
    const b = await fixture(tx)
    const data = (companyId: string) => ({ companyId, invoiceNumber: 'F-1', issueDate: d('2026-11-01'), dueDate: d('2026-11-15') })
    await tx.invoice.create({ data: data(a.company.id) })
    await tx.invoice.create({ data: data(b.company.id) })
    await expectViolation(tx, 'invoice_number', () => tx.invoice.create({ data: data(a.company.id) }))
  }))

  test('betalingen zijn altijd positief', () => inRollback(async tx => {
    const { company } = await fixture(tx)
    await expectViolation(tx, 'payments_amount_positive', () => tx.payment.create({ data: { companyId: company.id, amount: 0, receivedOn: d('2026-11-01') } }))
  }))
})

describe('overig', () => {
  test('onderhoud hoort bij een woning of een gebouw', () => inRollback(async tx => {
    const { company } = await fixture(tx)
    await expectViolation(tx, 'maintenance_requests_has_location', () => tx.maintenanceRequest.create({ data: { companyId: company.id, title: 'Zwevend verzoek' } }))
  }))

  test('e-mailadressen zijn hoofdletterongevoelig uniek (citext)', () => inRollback(async tx => {
    await tx.user.create({ data: { email: 'Test.Uniek@Example.com', username: 'test_uniek_1', passwordHash: 'x' } })
    await expectViolation(tx, 'email', () => tx.user.create({ data: { email: 'test.uniek@example.com', username: 'test_uniek_2', passwordHash: 'x' } }))
  }))

  test('een adres komt maar één keer voor per bedrijf', () => inRollback(async tx => {
    const { company, building } = await fixture(tx)
    await expectViolation(tx, 'postcode_house_number', () =>
      tx.unit.create({ data: { companyId: company.id, buildingId: building.id, name: 'Dubbel', street: 'Teststraat', houseNumber: 1, postcode: '1234 AB', city: 'Utrecht' } }))
  }))

  test('een bedrijf verwijderen ruimt alle bedrijfsdata op', () => inRollback(async tx => {
    const { company, contract } = await fixture(tx)
    await tx.invoice.create({ data: { companyId: company.id, contractId: contract.id, invoiceNumber: 'F-1', issueDate: d('2026-11-01'), dueDate: d('2026-11-15') } })
    await tx.company.delete({ where: { id: company.id } })
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')
    assert.equal(await tx.contract.count({ where: { companyId: company.id } }), 0)
    assert.equal(await tx.unit.count({ where: { companyId: company.id } }), 0)
  }))
})
