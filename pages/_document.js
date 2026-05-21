import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#080A0E" />
        <link rel="icon" href="/favicon.ico" />
        {/* Fonts are loaded via globals.css @import */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
