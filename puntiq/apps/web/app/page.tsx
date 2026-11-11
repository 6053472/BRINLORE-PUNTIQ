import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { userFromToken } from '../lib/auth'
import { SESSION_COOKIE } from '../lib/session'
import { AppProvider } from '../components/AppProvider'
import { Shell } from '../components/Shell'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const store = await cookies()
  const user = userFromToken(store.get(SESSION_COOKIE)?.value)
  if (!user) redirect('/login')
  return (
    <AppProvider initialUser={user}>
      <Shell />
    </AppProvider>
  )
}
