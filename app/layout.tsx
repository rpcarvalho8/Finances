import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Finance OS',
  description: 'Gestão financeira familiar — Rui & Ana',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <div style={{display:'flex',minHeight:'100vh'}}>
          <Sidebar />
          <main style={{flex:1,marginLeft:'220px',padding:'32px 32px 64px',maxWidth:'1100px'}}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
