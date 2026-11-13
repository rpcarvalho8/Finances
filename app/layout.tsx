import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Finance OS',
  description: 'Gestão financeira familiar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
