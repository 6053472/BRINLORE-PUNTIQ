import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { createRecord, invoiceNumberError, isKind, listRecords, migrateLegacyPaymentsSafely, validate } from '../../../../lib/records'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const { kind } = await context.params
  if (!isKind(kind)) return json({ error: 'Onbekend type.' }, 404)
  if (kind === 'invoices' || kind === 'payments') migrateLegacyPaymentsSafely(user.id)
  return json({ records: listRecords(user.id, kind) })
}

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const { kind } = await context.params
  if (!isKind(kind)) return json({ error: 'Onbekend type.' }, 404)
  const { data, error } = validate(kind, await request.json().catch(() => null))
  if (!data) return json({ error }, 400)
  const numberError = kind === 'invoices' ? invoiceNumberError(user.id, data.number) : null
  if (numberError) return json({ error: numberError }, 400)
  return json({ record: createRecord(user.id, kind, data) }, 201)
}
