import { currentUser, json, unauthorized } from '../../../lib/auth'
import { listRecords, migrateLegacyPaymentsSafely, schemas, type RecordKind } from '../../../lib/records'

export const runtime = 'nodejs'

/** Alle records van de ingelogde gebruiker in één request. */
export async function GET(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  migrateLegacyPaymentsSafely(user.id)
  const result: Record<string, unknown[]> = {}
  for (const kind of Object.keys(schemas) as RecordKind[]) result[kind] = listRecords(user.id, kind)
  return json(result)
}
