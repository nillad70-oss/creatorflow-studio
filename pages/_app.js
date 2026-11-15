import '../styles/globals.css'
import Script from 'next/script'
import AuthGate from '../lib/AuthGate'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        src="https://connect.facebook.net/en_US/fbevents.js"
      />
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            fbq('init', '983859764502251');
            fbq('track', 'PageView');
          `,
        }}
      />
      <AuthGate>
        <Component {...pageProps} />
      </AuthGate>
    </>
  )
}
