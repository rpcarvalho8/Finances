'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'

export type Me = { name: string; email: string; role: string }

/** Hides the chrome on /login and sends expired sessions back to /login. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const isLogin = path === '/login'

  useEffect(() => {
    if (isLogin) return
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          router.replace('/login')
          return null
        }
        return r.ok ? r.json() : null
      })
      .then((j) => j && setMe(j))
      .catch(() => {})
  }, [isLogin, path, router])

  if (isLogin) return <main style={{ minHeight: '100vh' }}>{children}</main>
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar me={me} />
      <main style={{ flex: 1, marginLeft: '220px', padding: '32px 32px 64px', maxWidth: '1100px' }}>{children}</main>
    </div>
  )
}
