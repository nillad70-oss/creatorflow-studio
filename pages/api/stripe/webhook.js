import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = {
  api: {
    bodyParser: false,
  },
}

async function buffer(readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata.userId

    await supabase
      .from('users')
      .update({
        subscription_tier: 'pro',
        stripe_customer_id: session.customer,
        subscription_status: 'active'
      })
      .eq('id', userId)
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    
    await supabase
      .from('users')
      .update({
        subscription_tier: 'free',
        subscription_status: 'cancelled'
      })
      .eq('stripe_customer_id', subscription.customer)
  }

  res.status(200).json({ received: true })
}