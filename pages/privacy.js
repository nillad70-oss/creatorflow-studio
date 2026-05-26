import Head from 'next/head'
import Link from 'next/link'

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — NillaFlow Studio™.</title>
      </Head>
      <div style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: '40px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>← Back to Home</Link>
          <h1 style={{ fontSize: '32px', fontWeight: '300', margin: '32px 0 8px' }}>Privacy Policy</h1>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '40px' }}>Last updated: May 2026</p>

          <div style={{ lineHeight: '1.8', color: '#ccc', fontSize: '15px' }}>
            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>1. Information We Collect</h2>
            <p>We collect your email address, content preferences, and usage data to provide our service.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>2. How We Use Your Information</h2>
            <p>We use your information to personalize your experience, generate AI content, and process payments.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>3. Data Storage</h2>
            <p>Your data is stored securely using Supabase. We do not sell your personal information to third parties.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>4. Payments</h2>
            <p>Payment processing is handled by Stripe. We do not store your credit card information.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>5. Cookies</h2>
            <p>We use cookies for authentication and to improve your experience.</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>6. Your Rights</h2>
            <p>You may request deletion of your account and data at any time by contacting support@NillaFlowstudio.app</p>

            <h2 style={{ color: 'white', fontSize: '20px', marginTop: '32px' }}>7. Contact</h2>
            <p>For privacy concerns, contact us at support@NillaFlowstudio.app</p>
          </div>
        </div>
      </div>
    </>
  )
}
