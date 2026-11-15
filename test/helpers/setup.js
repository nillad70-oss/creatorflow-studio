// Global test setup: every external service is replaced with a local fake.
// - Supabase  -> in-memory fake (test/helpers/fakeSupabase.js)
// - Stripe    -> real library for signature checks, network methods stubbed
// - Anthropic -> global fetch stub that returns a canned JSON reply
import { vi, beforeEach } from 'vitest'
import { makeClient, resetState } from './fakeSupabase'
import { resetRateLimits } from '../../lib/server/guard'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test'
process.env.ANTHROPIC_API_KEY = 'anthropic-test'
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID = 'price_monthly_test'
process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID = 'price_yearly_test'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => makeClient()) }))

export const stripeCalls = { checkout: [], portal: [] }
export const stripeSubscriptions = {}

vi.mock('stripe', async (importOriginal) => {
  const RealStripe = (await importOriginal()).default
  function FakeStripe(key, opts) {
    const real = new RealStripe(key, opts)
    real.checkout = {
      sessions: {
        create: async (params) => {
          stripeCalls.checkout.push(params)
          return { id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' }
        },
      },
    }
    real.billingPortal = {
      sessions: {
        create: async (params) => {
          stripeCalls.portal.push(params)
          return { url: 'https://billing.stripe.test/session' }
        },
      },
    }
    real.subscriptions = {
      retrieve: async (id) => stripeSubscriptions[id] || { id, status: 'active', customer: 'cus_x', trial_end: null },
    }
    return real
  }
  FakeStripe.webhooks = RealStripe.webhooks
  return { default: FakeStripe }
})

export const ai = { reply: {}, calls: [] }

beforeEach(() => {
  resetState()
  resetRateLimits()
  stripeCalls.checkout.length = 0
  stripeCalls.portal.length = 0
  for (const k of Object.keys(stripeSubscriptions)) delete stripeSubscriptions[k]
  ai.reply = {}
  ai.calls = []
  global.fetch = vi.fn(async (url, init) => {
    if (String(url).startsWith('https://api.anthropic.com')) {
      ai.calls.push(JSON.parse(init.body))
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: JSON.stringify(ai.reply) }] }),
      }
    }
    if (String(url).startsWith('https://signed.test/')) {
      return { ok: true, arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer }
    }
    throw new Error(`Unexpected network call in test: ${url}`)
  })
})
