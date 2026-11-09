import { getUser } from '../../../lib/db'
import { createProperty, listProperties } from '../../../lib/properties'

export const runtime = 'nodejs'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function sessionUserId(request: Request) {
  const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)puntiq_session=([^;]+)/)?.[1]
  const id = Number(decodeURIComponent(raw ?? '').split(':')[0])
  return Number.isInteger(id) && getUser(id) ? id : null
}

export async function GET(request: Request) {
  const userId = sessionUserId(request)
  if (!userId) return json({ error: 'Niet ingelogd.' }, 401)
  return json({ properties: listProperties(userId) })
}

export async function POST(request: Request) {
  const userId = sessionUserId(request)
  if (!userId) return json({ error: 'Niet ingelogd.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || typeof body.address !== 'string') {
    return json({ error: 'Naam en adres zijn verplicht.' }, 400)
  }
  const property = createProperty(userId, {
    name: body.name,
    address: body.address,
    type: typeof body.type === 'string' ? body.type : 'Zelfstandig',
    status: 'Beschikbaar',
    points: Number(body.points) || 0,
    rent: Number(body.rent) || 0,
    image: typeof body.image === 'string' ? body.image : '',
    images: Array.isArray(body.images) ? body.images.filter((image: unknown): image is string => typeof image === 'string') : [],
    area: Number(body.area) || undefined,
    rooms: Number(body.rooms) || undefined,
    bedrooms: Number(body.bedrooms) || undefined,
    yearBuilt: Number(body.yearBuilt) || undefined,
    energyLabel: typeof body.energyLabel === 'string' ? body.energyLabel : '',
    floor: typeof body.floor === 'string' ? body.floor : '',
    price: Number(body.price) || undefined,
    description: typeof body.description === 'string' ? body.description : '',
  })
  return json({ property }, 201)
}
