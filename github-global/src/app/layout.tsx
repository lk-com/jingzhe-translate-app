import type { Metadata } from 'next'
import './globals.css'
import { HtmlProvider } from './html-provider'

export const metadata: Metadata = {
  title: 'GitHub Global - AI Documentation Translation',
  description: 'Automatically translate your GitHub documentation to multiple languages using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <HtmlProvider>
          {children}
        </HtmlProvider>
      </body>
    </html>
  )
}
