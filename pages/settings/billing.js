import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Billing() {
  const router = useRouter()

  const handleCheckout = async (priceId) => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl text-primary text-center mb-12">
          Upgrade to Pro
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl text-primary mb-2">Monthly</h2>
            <p className="text-4xl text-primary font-bold mb-1">$17</p>
            <p className="text-secondary text-sm mb-6">/month • 3-day free trial</p>
            <ul className="space-y-2 mb-8">
              {['Unlimited AI scripts','Unlimited teleprompter','30-day content calendar','AI captions export','Priority support'].map(f => (
                <li key={f} className="text-secondary text-sm flex items-center gap-2">
                  <span className="text-electric">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID)}
              className="btn-electric w-full py-3 rounded-xl text-sm"
            >
              Start Free Trial
            </button>
          </div>

          <div className="glass rounded-2xl p-8 border border-electric/30">
            <h2 className="text-xl text-primary mb-2">Annual</h2>
            <p className="text-4xl text-primary font-bold mb-1">$144</p>
            <p className="text-secondary text-sm mb-6">/year • Save $60 • 3-day free trial</p>
            <ul className="space-y-2 mb-8">
              {['Unlimited AI scripts','Unlimited teleprompter','30-day content calendar','AI captions export','Priority support'].map(f => (
                <li key={f} className="text-secondary text-sm flex items-center gap-2">
                  <span className="text-electric">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID)}
              className="btn-electric w-full py-3 rounded-xl text-sm"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}