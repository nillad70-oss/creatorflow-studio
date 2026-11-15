import Stripe from 'stripe'
import { requireUser } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'
import { isAllowedPrice, LEGACY_SIGNUP_PRICE_ID, TRIAL_DAYS } from '../../../lib/server/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Starts the post-signup checkout. The Stripe customer email and the userId in
// metadata come ONLY from the verified session, so a checkout can never be
// attached to someone else's account.
export default async function handler(req, res) {
  // The old GET flow took userId/email from the URL. It no longer creates a
  // checkout: anyone landing here via an old link is sent to the billing page,
  // which starts checkout from their signed-in session.
  if (req.method === 'GET') {
    return res.redirect(303, '/settings/billing')
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `checkout:${user.id}`, limit: 10 })) return

  const priceId = req.body?.priceId || LEGACY_SIGNUP_PRICE_ID
  if (!isAllowedPrice(priceId)) {
    return res.status(400).json({ error: 'Unknown plan.' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/signup`,
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { userId: user.id } },
      client_reference_id: user.id,
      metadata: { userId: user.id },
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout signup error:', err)
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' })
  }
}
