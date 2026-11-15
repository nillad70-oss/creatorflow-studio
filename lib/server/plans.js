// The only Stripe prices NillaFlow checkout will accept. Anything else is
// rejected, so nobody can start a "subscription" on an arbitrary price.
// Pricing itself is unchanged: these are the existing $17/mo and $144/yr plans.

// Price used by the signup flow before Phase 0 (hard-coded in pages/signup.js).
// Kept so existing signup behaviour is identical.
export const LEGACY_SIGNUP_PRICE_ID = 'price_1TZdETLtci79J0RjR1JnKafJ'

export function allowedPriceIds() {
  return [
    process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID,
    process.env.STRIPE_MONTHLY_PRICE_ID,
    process.env.STRIPE_YEARLY_PRICE_ID,
    LEGACY_SIGNUP_PRICE_ID,
  ].filter(Boolean)
}

export function isAllowedPrice(priceId) {
  return typeof priceId === 'string' && allowedPriceIds().includes(priceId)
}

export const TRIAL_DAYS = 3
