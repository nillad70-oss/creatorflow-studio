import Stripe from 'stripe'
import { requireUser } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'
import { getBalance, getRecentLedger, creditPacks, findPack } from '../../../lib/server/credits'
import { requireTwinEnabled } from '../../../lib/server/twin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// GET  /api/credits                     -> balance, recent activity, available packs
// POST /api/credits  { pack: 'starter' } -> Stripe Checkout (one-time payment) for a pack
// Credits are added only by the Stripe webhook after payment succeeds.
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `credits:${user.id}`, limit: 30 })) return

  if (req.method === 'GET') {
    const [balance, activity] = await Promise.all([getBalance(user.id), getRecentLedger(user.id)])
    return res.status(200).json({
      balance,
      activity,
      packs: creditPacks().map(({ id, credits }) => ({ id, credits })),
    })
  }

  const pack = findPack(req.body?.pack)
  if (!pack) return res.status(400).json({ error: 'Credit packs are not available yet.' })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: pack.price_id, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/twin?credits=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/twin?credits=cancelled`,
      client_reference_id: user.id,
      metadata: { userId: user.id, credit_pack: pack.id, credits: String(pack.credits) },
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Credit checkout error:', err)
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' })
  }
}
