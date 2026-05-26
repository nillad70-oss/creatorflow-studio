import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase/client'
import Link from 'next/link'

export default function Billing() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isExpired = router.query.expired === 'true'

  const handleCheckout = async (priceId) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Error: ' + data.error)
    } catch (err) {
      alert('Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {isExpired && (
        <div style={{background:'#ef4444',color:'white',padding:'12px 24px',textAlign:'center',fontSize:'14px',fontWeight:'600'}}>
          ⚠️ Your 3-day trial has ended. Subscribe to continue using NillaFlow Studio™..
        </div>
      )}
      <nav style={{ background: '#111', borderBottom: '1px solid #222', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#666', fontSize: '14px', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: 'white', fontSize: '14px' }}>Upgrade to Pro</span>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '700px' }}>
          <h1 style={{ color: 'white', textAlign: 'center', fontSize: '32px', fontWeight: '300', marginBottom: '40px' }}>
            Choose Your Plan
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '20px', padding: '32px' }}>
              <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '8px' }}>Monthly</h2>
              <p style={{ color: '#3b82f6', fontSize: '40px', fontWeight: 'bold', marginBottom: '4px' }}>$17</p>
              <p style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>/month</p>
              <p style={{ color: '#3b82f6', fontSize: '12px', marginBottom: '24px' }}>3-day free trial</p>
              {['Unlimited AI scripts', 'Unlimited teleprompter', '30-day content calendar', 'AI captions export', 'Priority support'].map(f => (
                <p key={f} style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>✓ {f}</p>
              ))}
              <button
                onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID)}
                disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#1a1a1a', border: '1px solid #333', color: 'white', fontSize: '14px', cursor: 'pointer', marginTop: '24px' }}
              >
                {loading ? 'Loading...' : 'Subscribe Now'}
              </button>
            </div>

            <div style={{ background: '#111', border: '2px solid #3b82f6', borderRadius: '20px', padding: '32px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: 'white', fontSize: '11px', padding: '4px 12px', borderRadius: '20px' }}>Most Popular</div>
              <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '8px' }}>Annual</h2>
              <p style={{ color: '#3b82f6', fontSize: '40px', fontWeight: 'bold', marginBottom: '4px' }}>$144</p>
              <p style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>/year</p>
              <p style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>Just $12/mo — save $60</p>
              <p style={{ color: '#3b82f6', fontSize: '12px', marginBottom: '24px' }}>3-day free trial</p>
              {['Unlimited AI scripts', 'Unlimited teleprompter', '30-day content calendar', 'AI captions export', 'Priority support'].map(f => (
                <p key={f} style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>✓ {f}</p>
              ))}
              <button
                onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID)}
                disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#3b82f6', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', marginTop: '24px', fontWeight: '600' }}
              >
                {loading ? 'Loading...' : 'Subscribe Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
