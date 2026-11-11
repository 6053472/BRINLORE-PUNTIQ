import { currentUser, unauthorized } from '../../../../lib/auth'
import { listProperties } from '../../../../lib/properties'
import { listRecords, schemas, type RecordKind } from '../../../../lib/records'

export const runtime = 'nodejs'

/** Volledige data-export (AVG: recht op dataportabiliteit), zonder foto's en bestandsinhoud. */
export async function GET(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const records: Record<string, unknown[]> = {}
  for (const kind of Object.keys(schemas) as RecordKind[]) records[kind] = listRecords(user.id, kind)
  const body = {
    exportedAt: new Date().toISOString(),
    account: { ...user, avatar: user.avatar ? '(profielfoto)' : '' },
    properties: listProperties(user.id).map(p => ({ ...p, image: undefined, images: p.images?.length ?? 0 })),
    ...records,
  }
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="puntiq-export.json"', 'Cache-Control': 'no-store' },
  })
}
