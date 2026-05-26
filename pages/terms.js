import Head from 'next/head'
import Link from 'next/link'

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — NillaFlow Studio™.</title>
      </Head>
      <div style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: '40px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>← Back to Home</Link>
          <h1 style={{ fontSize: '32px', fontWeight: '300', margin: '32px 0 8px' }}>Terms of Service</h1>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '40px' }}>Last updated: May 2026</p>

          <div style={{ lineHeight: '1.8', color: '#ccc', fontSize: '15px' }}>
            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>1. Acceptance of Terms</h2>
            <p>By using NillaFlow Studio™., you agree to these terms. If you do not agree, please do not use our service.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>2. Description of Service</h2>
            <p>NillaFlow Studio™. is an AI-powered creator workflow platform that helps users generate content ideas, scripts, and record videos using our Flow Teleprompter™.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>3. Subscription and Billing</h2>
            <p>We offer a 3-day free trial followed by a paid subscription of $17/month or $144/year. You may cancel at any time before the trial ends to avoid charges.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>4. User Content</h2>
            <p>You retain ownership of all content you create using NillaFlow Studio™.. We do not claim ownership of your scripts, videos, or ideas.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>5. Acceptable Use</h2>
            <p>You agree not to use NillaFlow Studio™. to create harmful, illegal, or misleading content.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>6. Termination</h2>
            <p>We reserve the right to terminate accounts that violate these terms.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>7. Contact</h2>
            <p>For questions about these terms, contact us at support@creatorflowstudio.app</p>
          </div>
        </div>
      </div>
    </>
  )
}
