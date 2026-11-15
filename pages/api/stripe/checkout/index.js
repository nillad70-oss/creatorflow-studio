import Stripe from 'stripe'
import { requireUser } from '../../../../lib/server/auth'
import { rateLimit } from '../../../../lib/server/guard'
import { isAllowedPrice, TRIAL_DAYS } from '../../../../lib/server/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `checkout:${user.id}`, limit: 10 })) return

  const { priceId } = req.body || {}
  if (!priceId) return res.status(400).json({ error: 'Price ID required' })
  if (!isAllowedPrice(priceId)) return res.status(400).json({ error: 'Unknown plan.' })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?cancelled=true`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { userId: user.id } },
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: 'Could not start checkout. Please try again.' })
  }
}
