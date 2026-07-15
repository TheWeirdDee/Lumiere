import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LUMIÈRE — Feel the World Cup',
  description:
    'The market intelligence layer for World Cup codes. Live odds shocks in plain English, an edge score on every shared betting code, and live tracking your group chat can follow.',
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
