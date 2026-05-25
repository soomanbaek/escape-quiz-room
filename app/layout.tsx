import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
}

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  title: 'Escape Room - Workshop',
  description: '워크샵용 방탈출 게임. 팀별로 문제를 풀고 가장 빨리 탈출하세요!',
  generator: 'v0.app',
  openGraph: {
    title: '방탈출 게임 - Workshop',
    description: '팀별 문제를 풀고 가장 빨리 탈출하세요!',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '방탈출 게임 - Workshop',
    description: '팀별 문제를 풀고 가장 빨리 탈출하세요!',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased bg-background">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
