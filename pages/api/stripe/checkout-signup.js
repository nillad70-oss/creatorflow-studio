import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  try {
    const { userId, email, priceId } = req.query
    const finalPriceId = priceId || 'price_1TZdETLtci79J0RjR1JnKafJ'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [{ price: finalPriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/signup`,
      subscription_data: { trial_period_days: 3 },
      metadata: { userId: userId || '' },
    })

    res.redirect(303, session.url)
  } catch (err) {
    console.error('Checkout signup error:', err)
    res.redirect(303, '/onboarding')
  }
}
