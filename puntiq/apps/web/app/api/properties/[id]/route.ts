import { getUser } from '../../../../lib/db'
import { deleteProperty } from '../../../../lib/properties'

export const runtime = 'nodejs'

function sessionUserId(request: Request) {
  const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)puntiq_session=([^;]+)/)?.[1]
  const id = Number(decodeURIComponent(raw ?? '').split(':')[0])
  return Number.isInteger(id) && getUser(id) ? id : null
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = sessionUserId(request)
  if (!userId) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 })
  const { id } = await context.params
  const deleted = deleteProperty(userId, Number(id))
  if (!deleted) return Response.json({ error: 'Woning niet gevonden.' }, { status: 404 })
  return Response.json({ ok: true })
}
