import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { MAX_BACKUP_BYTES, parseBackup, restoreBackup } from '../../../../lib/backup'
import { logAudit } from '../../../../lib/admin'

export const runtime = 'nodejs'

/** Zet een back-up terug. Vervangt alle bestaande woningen en gegevens van dit account. */
export async function POST(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const text = await request.text()
  if (text.length > MAX_BACKUP_BYTES) return json({ error: 'Het back-upbestand is te groot.' }, 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'Het bestand is geen geldige JSON.' }, 400)
  }
  const { backup, error } = parseBackup(body)
  if (!backup) return json({ error }, 400)
  try {
    const result = restoreBackup(user.id, backup)
    logAudit({ id: user.id, name: user.username }, 'account.restore', user.username, `${result.properties} woningen, ${result.records} items`)
    return json({ ok: true, ...result })
  } catch {
    return json({ error: 'Terugzetten is mislukt; uw bestaande gegevens zijn ongewijzigd.' }, 500)
  }
}
