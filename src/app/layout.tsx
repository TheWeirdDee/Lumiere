import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LUMIÈRE — Feel the World Cup',
  description:
    'Follow or Fade live World Cup market shocks, resolve calls from TxLINE odds, build Market IQ, and share verified Match Winner codes.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      {/* suppressHydrationWarning on body: browser extensions (Grammarly etc)
          inject attributes before React hydrates — a known false-positive. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
