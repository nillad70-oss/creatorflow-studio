import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  try {
    const { priceId } = req.query

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/signup`,
      subscription_data: { trial_period_days: 3 },
    })

    res.redirect(303, session.url)
  } catch (err) {
    console.error('Checkout signup error:', err)
    res.redirect(303, '/onboarding')
  }
}
