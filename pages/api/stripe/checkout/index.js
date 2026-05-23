import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    // Get auth token from any supabase cookie
    const cookies = req.cookies
    const cookieKey = Object.keys(cookies).find(k => k.includes('auth-token'))
    
    if (!cookieKey) {
      return res.status(401).json({ error: 'Not logged in' })
    }

    let accessToken
    try {
      const parsed = JSON.parse(cookies[cookieKey])
      accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token
    } catch {
      accessToken = cookies[cookieKey]
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const { priceId } = req.body
    if (!priceId) return res.status(400).json({ error: 'Price ID required' })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?cancelled=true`,
      metadata: { userId: user.id },
      subscription_data: { trial_period_days: 3 },
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: err.message })
  }
}
