import Stripe from 'stripe'
import { getServiceClient } from '../../../lib/server/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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

// Stripe subscription status -> NillaFlow entitlement.
// Entitlements are preserved exactly as before Phase 0: a subscriber is Pro from
// checkout onward (including the 3-day trial). past_due keeps Pro during
// Stripe's retry window; the account drops to free only when Stripe gives up
// (canceled / unpaid / incomplete_expired).
export function tierForStatus(status) {
  if (['active', 'trialing', 'past_due'].includes(status)) return 'pro'
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) return 'free'
  return null // 'incomplete', 'paused', unknown: leave the tier unchanged
}

const toIso = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null)

// Writes to public.users. subscription_status is written by the original
// webhook but is not in the repo's SQL files (schema drift, see the Phase 0
// report); if the live column is missing, retry without it rather than losing
// the entitlement update.
async function updateUser(match, values) {
  const supabase = getServiceClient()
  const [col, val] = match
  let { data, error } = await supabase.from('users').update(values).eq(col, val).select('id')
  if (error && /subscription_status/.test(error.message || '') && 'subscription_status' in values) {
    const { subscription_status, ...rest } = values
    ;({ data, error } = await supabase.from('users').update(rest).eq(col, val).select('id'))
  }
  if (error) throw new Error(`users update failed: ${error.message}`)
  return data || []
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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId || session.client_reference_id
        if (!userId) {
          console.error('checkout.session.completed without userId', session.id)
          break
        }
        let status = 'active'
        let trialEnd = null
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          status = sub.status || status
          trialEnd = toIso(sub.trial_end)
        }
        await updateUser(['id', userId], {
          subscription_tier: 'pro',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription || null,
          subscription_status: status,
          trial_ends_at: trialEnd,
        })
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const values = {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          trial_ends_at: toIso(sub.trial_end),
        }
        const tier = tierForStatus(sub.status)
        if (tier) values.subscription_tier = tier
        await updateUser(['stripe_customer_id', sub.customer], values)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await updateUser(['stripe_customer_id', sub.customer], {
          subscription_tier: 'free',
          subscription_status: 'cancelled',
        })
        break
      }

      case 'invoice.payment_failed': {
        // Card declined on renewal. Keep access during Stripe's retries; the
        // subscription.updated / deleted events decide when access ends.
        const invoice = event.data.object
        await updateUser(['stripe_customer_id', invoice.customer], { subscription_status: 'past_due' })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        if (invoice.subscription) {
          await updateUser(['stripe_customer_id', invoice.customer], { subscription_status: 'active' })
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    // A 500 makes Stripe retry delivery, so an entitlement change is never
    // silently lost (the original handler always answered 200).
    console.error(`Webhook handling failed for ${event.type}:`, err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  res.status(200).json({ received: true })
}
