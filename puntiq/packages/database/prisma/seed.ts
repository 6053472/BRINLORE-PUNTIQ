/**
 * Demodata voor lokale ontwikkeling. Idempotent: verwijdert eerst het demobedrijf en de demogebruiker.
 * Inloggen: demo / demo12345
 */
import { randomBytes, scryptSync } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Zelfde formaat als apps/web/lib/db.ts (salt:hash), zodat bestaande wachtwoorden migreerbaar zijn.
function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const money = (value: number) => new Prisma.Decimal(value.toFixed(2))

async function main() {
  await prisma.company.deleteMany({ where: { kvkNumber: '90000001' } })
  await prisma.user.deleteMany({ where: { username: 'demo' } })

  const user = await prisma.user.create({
    data: {
      email: 'demo@puntiq.local',
      username: 'demo',
      passwordHash: hashPassword('demo12345'),
      firstName: 'Demi',
      lastName: 'de Vries',
      jobTitle: 'Vastgoedbeheerder',
      preferences: { create: {} },
    },
  })

  const company = await prisma.company.create({
    data: {
      name: 'Demo Vastgoed B.V.',
      kvkNumber: '90000001',
      vatNumber: 'NL900000001B01',
      iban: 'NL91 ABNA 0417 1643 00',
      street: 'Singel',
      houseNumber: '229',
      postcode: '1012 WP',
      city: 'Amsterdam',
      memberships: { create: { userId: user.id, role: 'OWNER' } },
    },
  })
  await prisma.userPreference.update({ where: { userId: user.id }, data: { activeCompanyId: company.id } })

  const building = await prisma.building.create({
    data: { companyId: company.id, name: 'Singelhof', street: 'Singel', houseNumber: '229', postcode: '1012 WP', city: 'Amsterdam', yearBuilt: 1928, energyLabel: 'C', heritageStatus: 'RIJKSMONUMENT' },
  })

  const [unitA, unitB] = await Promise.all(
    [
      { name: 'Singel 229-1', addition: '1', area: 68, rooms: 3, bedrooms: 2, status: 'RENTED' as const },
      { name: 'Singel 229-2', addition: '2', area: 54, rooms: 2, bedrooms: 1, status: 'AVAILABLE' as const },
    ].map(unit =>
      prisma.unit.create({
        data: {
          companyId: company.id, buildingId: building.id, name: unit.name, street: 'Singel', houseNumber: 229, houseNumberAddition: unit.addition,
          postcode: '1012 WP', city: 'Amsterdam', livingArea: unit.area, rooms: unit.rooms, bedrooms: unit.bedrooms, status: unit.status, energyLabel: 'C', yearBuilt: 1928,
        },
      }),
    ),
  )

  const calculation = await prisma.wwsCalculation.create({
    data: {
      companyId: company.id, unitId: unitA.id, createdById: user.id, label: 'Puntentelling 2026', referenceDate: d('2026-07-01'), rulesVersion: '2026-07',
      input: { m2Vertrekken: 58, m2OverigeRuimten: 10, energielabel: 'C', bouwjaar: 1928 }, result: { totaal: 168 },
      totalPoints: 168, maxRent: money(1131.18), segment: 'MIDDLE',
    },
  })
  await prisma.unit.update({ where: { id: unitA.id }, data: { wwsPoints: calculation.totalPoints, maxRent: calculation.maxRent, rentalSegment: 'MIDDLE' } })

  const [anna, bas] = await Promise.all([
    prisma.tenant.create({ data: { companyId: company.id, firstName: 'Anna', lastName: 'Jansen', displayName: 'Anna Jansen', email: 'anna@example.com', status: 'ACTIVE' } }),
    prisma.tenant.create({ data: { companyId: company.id, firstName: 'Bas', lastName: 'Jansen', displayName: 'Bas Jansen', status: 'ACTIVE' } }),
  ])

  const contract = await prisma.contract.create({
    data: {
      companyId: company.id, unitId: unitA.id, contractNumber: 'HC-2025-001', status: 'ACTIVE', contractType: 'INDEFINITE',
      startDate: d('2025-02-01'), baseRent: money(1095), serviceCharges: money(65), depositAmount: money(2190), indexationPercentage: 3.5, nextIndexationDate: d('2027-02-01'),
      signedAt: new Date('2025-01-15T10:00:00Z'),
      // companyId volgt automatisch uit de samengestelde foreign key naar het contract.
      tenants: { create: [{ tenantId: anna.id, isPrimary: true }, { tenantId: bas.id }] },
      rentChanges: { create: { reason: 'INDEXATION', effectiveDate: d('2026-02-01'), previousRent: money(1058), newRent: money(1095), percentage: 3.5 } },
    },
  })

  const invoice = await prisma.invoice.create({
    data: {
      companyId: company.id, contractId: contract.id, tenantId: anna.id, invoiceNumber: 'F2026-0001', kind: 'RENT', status: 'PAID', paidAt: new Date('2026-11-01T09:12:00Z'),
      issueDate: d('2026-10-20'), dueDate: d('2026-11-01'), periodStart: d('2026-11-01'), periodEnd: d('2026-11-30'),
      subtotal: money(1160), vatAmount: money(0), total: money(1160),
      lines: {
        create: [
          { position: 1, lineType: 'RENT', description: 'Kale huur november 2026', unitPrice: money(1095), amount: money(1095) },
          { position: 2, lineType: 'SERVICE_CHARGES', description: 'Servicekosten november 2026', unitPrice: money(65), amount: money(65) },
        ],
      },
    },
  })
  await prisma.company.update({ where: { id: company.id }, data: { nextInvoiceNumber: 2 } })

  await prisma.payment.create({
    data: {
      companyId: company.id, tenantId: anna.id, amount: money(1160), receivedOn: d('2026-11-01'), reference: 'Huur nov Singel 229-1', bankTransactionId: 'DEMO-0001',
      allocations: { create: { invoiceId: invoice.id, amount: money(1160) } },
    },
  })

  const contractor = await prisma.contractor.create({ data: { companyId: company.id, name: 'Loodgietersbedrijf Kraan', trade: 'Loodgieter', phone: '020 123 4567' } })
  const repair = await prisma.maintenanceRequest.create({
    data: {
      companyId: company.id, unitId: unitA.id, buildingId: building.id, reportedByTenantId: anna.id, contractorId: contractor.id, assignedToId: user.id, createdById: user.id,
      title: 'Lekkage onder keukenkastje', category: 'PLUMBING', priority: 'HIGH', status: 'SCHEDULED', scheduledFor: d('2026-11-18'), estimatedCost: money(240),
    },
  })
  await prisma.expense.create({
    data: { companyId: company.id, buildingId: building.id, category: 'INSURANCE', description: 'Opstalverzekering 2026', amount: money(1840), incurredOn: d('2026-01-05'), paidOn: d('2026-01-20') },
  })

  await prisma.document.create({
    data: {
      companyId: company.id, uploadedById: user.id, title: 'Huurovereenkomst Singel 229-1', category: 'CONTRACT', fileName: 'huurovereenkomst.pdf', mimeType: 'application/pdf',
      sizeBytes: 182_344n, storageKey: `${company.id}/documents/huurovereenkomst-hc-2025-001.pdf`, contractId: contract.id, unitId: unitA.id, tenantId: anna.id,
    },
  })

  await prisma.auditLog.create({ data: { companyId: company.id, actorId: user.id, actorLabel: 'demo', action: 'seed.run', entityType: 'company', entityId: company.id } })

  console.log(`Demodata aangemaakt: ${company.name} — 1 gebouw, 2 woningen (${unitB.name} beschikbaar), 2 huurders, 1 contract, onderhoud ${repair.title}.`)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
