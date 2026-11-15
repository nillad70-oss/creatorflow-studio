import Stripe from 'stripe'
import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Opens Stripe's hosted billing page (update card, view invoices, cancel) for
// the signed-in user's own Stripe customer record. Requires the Customer Portal
// to be switched on in the Stripe dashboard; no prices or products change.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `portal:${user.id}`, limit: 10 })) return

  const { data: row } = await getServiceClient()
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!row?.stripe_customer_id) {
    return res.status(404).json({ error: 'No billing account found yet. Start a plan first.' })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Billing portal error:', err)
    return res.status(500).json({ error: 'Could not open billing management. Please try again.' })
  }
}
