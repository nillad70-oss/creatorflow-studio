import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const token = req.cookies['sb-ndcwggugyuixpnzeyfmg-auth-token']
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const parsed = JSON.parse(token)
    const accessToken = parsed[0]

    const { data: { user } } = await supabase.auth.getUser(accessToken)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

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
