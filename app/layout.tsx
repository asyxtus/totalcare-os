// app/layout.tsx
import './globals.css'
import { plexSans, plexMono } from '@/lib/fonts'

export const metadata = {
  title: 'TotalCare OS',
  description: 'Hospital management built for how a clinic actually runs.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TotalCare',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

// Without this, mobile browsers render the page at a desktop width
// (~980px) and zoom out to fit — every media query in the app is
// silently ignored until this is set. This is the single highest-
// leverage fix for mobile: nothing else here matters without it.
// maximumScale/userScalable stay at defaults (unset) so people can
// still pinch-zoom — clinical staff reading small lab values need that.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16211E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint — without this, a
            user who chose light on a dark-OS machine sees a dark flash
            on every page load. Runs before React hydrates; absent or
            invalid localStorage value = follow the OS (no attribute). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tc-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`,
          }}
        />
        {/* Service worker registration — deliberately deferred and silent
            on failure. This is what makes "Add to Home Screen"/install
            prompts available; it is NOT relied on for any actual data
            caching (see public/sw.js for why). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
