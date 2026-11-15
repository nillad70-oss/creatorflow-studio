// BILLING LIFECYCLE TESTS — webhook keeps entitlements in sync with Stripe.
import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'
import { state } from '../helpers/fakeSupabase'
import { stripeCalls, stripeSubscriptions } from '../helpers/setup'
import { call, seedUsers, USER_A, USER_B, TOKEN_A, TOKEN_B } from '../helpers/call'
import webhook, { tierForStatus } from '../../pages/api/stripe/webhook'
import portal from '../../pages/api/stripe/portal'
import checkoutSignup from '../../pages/api/stripe/checkout-signup'

function signed(type, object) {
  const payload = JSON.stringify({ id: `evt_${type}`, type, data: { object } })
  const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET })
  return { rawBody: payload, headers: { 'stripe-signature': sig } }
}
const userA = () => state.tables.users.find((u) => u.id === USER_A.id)
const userB = () => state.tables.users.find((u) => u.id === USER_B.id)

describe('Status -> entitlement mapping (preserves current behaviour)', () => {
  it('trialing and active are Pro (same as before Phase 0)', () => {
    expect(tierForStatus('trialing')).toBe('pro')
    expect(tierForStatus('active')).toBe('pro')
  })
  it('past_due keeps Pro during Stripe retries', () => expect(tierForStatus('past_due')).toBe('pro'))
  it('canceled / unpaid / incomplete_expired drop to free', () => {
    ;['canceled', 'unpaid', 'incomplete_expired'].forEach((s) => expect(tierForStatus(s)).toBe('free'))
  })
  it('unknown statuses leave the tier unchanged', () => expect(tierForStatus('paused')).toBeNull())
})

describe('Webhook lifecycle', () => {
  it('checkout completed: Pro + trial end + subscription id recorded', async () => {
    seedUsers()
    stripeSubscriptions.sub_b = { id: 'sub_b', status: 'trialing', customer: 'cus_b', trial_end: 1900000000 }
    const r = await call(webhook, signed('checkout.session.completed',
      { id: 'cs_1', customer: 'cus_b', subscription: 'sub_b', metadata: { userId: USER_B.id } }))
    expect(r.status).toBe(200)
    expect(userB()).toMatchObject({ subscription_tier: 'pro', stripe_customer_id: 'cus_b', stripe_subscription_id: 'sub_b', subscription_status: 'trialing' })
    expect(userB().trial_ends_at).toBe(new Date(1900000000 * 1000).toISOString())
  })
  it('trial converts to paid: status active, still Pro', async () => {
    seedUsers()
    const r = await call(webhook, signed('customer.subscription.updated', { id: 'sub_a', customer: 'cus_a', status: 'active', trial_end: null }))
    expect(r.status).toBe(200)
    expect(userA()).toMatchObject({ subscription_tier: 'pro', subscription_status: 'active' })
  })
  it('failed renewal payment: marked past_due, access kept', async () => {
    seedUsers()
    await call(webhook, signed('invoice.payment_failed', { id: 'in_1', customer: 'cus_a', subscription: 'sub_a' }))
    expect(userA()).toMatchObject({ subscription_tier: 'pro', subscription_status: 'past_due' })
  })
  it('payment recovered: back to active', async () => {
    seedUsers()
    userA().subscription_status = 'past_due'
    await call(webhook, signed('invoice.paid', { id: 'in_2', customer: 'cus_a', subscription: 'sub_a' }))
    expect(userA().subscription_status).toBe('active')
  })
  it('payment recovered on the current Stripe API version (subscription under invoice.parent)', async () => {
    seedUsers()
    userA().subscription_status = 'past_due'
    await call(webhook, signed('invoice.paid', { id: 'in_3', customer: 'cus_a',
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_a' } } }))
    expect(userA().subscription_status).toBe('active')
  })
  it('a one-off invoice with no subscription does not change status', async () => {
    seedUsers()
    userA().subscription_status = 'past_due'
    await call(webhook, signed('invoice.paid', { id: 'in_4', customer: 'cus_a', parent: null }))
    expect(userA().subscription_status).toBe('past_due')
  })
  it('Stripe gives up (unpaid): drops to free', async () => {
    seedUsers()
    await call(webhook, signed('customer.subscription.updated', { id: 'sub_a', customer: 'cus_a', status: 'unpaid' }))
    expect(userA().subscription_tier).toBe('free')
  })
  it('subscription cancelled: drops to free (unchanged behaviour)', async () => {
    seedUsers()
    await call(webhook, signed('customer.subscription.deleted', { id: 'sub_a', customer: 'cus_a' }))
    expect(userA()).toMatchObject({ subscription_tier: 'free', subscription_status: 'cancelled' })
  })
  it('a database failure returns 500 so Stripe retries instead of losing the update', async () => {
    seedUsers()
    const original = state.tables.users
    Object.defineProperty(state.tables, 'users', { get() { throw new Error('db down') }, configurable: true })
    const r = await call(webhook, signed('customer.subscription.deleted', { id: 'sub_a', customer: 'cus_a' }))
    Object.defineProperty(state.tables, 'users', { value: original, writable: true, configurable: true })
    expect(r.status).toBe(500)
  })
})

describe('Customer billing management (Stripe portal)', () => {
  it('opens the portal for the signed-in user\'s own customer record', async () => {
    seedUsers()
    const r = await call(portal, { token: TOKEN_A })
    expect(r.status).toBe(200)
    expect(stripeCalls.portal[0].customer).toBe('cus_a')
  })
  it('404 when the user has no Stripe customer yet', async () => {
    seedUsers()
    const r = await call(portal, { token: TOKEN_B })
    expect(r.status).toBe(404)
  })
  it('401 without a session', async () => {
    const r = await call(portal, {})
    expect(r.status).toBe(401)
  })
})

describe('Signup checkout keeps its existing behaviour', () => {
  it('uses the same default plan and 3-day trial as before', async () => {
    seedUsers()
    const r = await call(checkoutSignup, { token: TOKEN_A, body: {} })
    expect(r.status).toBe(200)
    expect(stripeCalls.checkout[0].line_items[0].price).toBe('price_1TZdETLtci79J0RjR1JnKafJ')
    expect(stripeCalls.checkout[0].subscription_data.trial_period_days).toBe(3)
  })
  it('old GET links no longer create a checkout; they redirect to billing', async () => {
    const r = await call(checkoutSignup, { method: 'GET', query: { userId: USER_A.id, email: 'x@y.z' } })
    expect(r.status).toBe(303)
    expect(r.redirect).toBe('/settings/billing')
    expect(stripeCalls.checkout).toHaveLength(0)
  })
})
