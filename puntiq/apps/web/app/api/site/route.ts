import { getSite } from '../../../lib/admin'
import { json } from '../../../lib/auth'

export const runtime = 'nodejs'

/** Publiek: alleen wat de login- en registratiepagina en de aankondigingsbalk nodig hebben. */
export async function GET() {
  const site = getSite()
  return json({ registrationOpen: site.registrationOpen, maintenance: site.maintenance, maintenanceMessage: site.maintenanceMessage, announcement: site.announcement, announcementTone: site.announcementTone })
}
