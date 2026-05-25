import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

export default function Signup() {
  const router = useRouter()
  const { plan } = router.query

  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: { intended_plan: plan || 'free' }
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        subscription_tier: 'free',
        onboarding_complete: false,
        created_at: new Date().toISOString()
      })
    }

    if (data.session) {
      // Redirect to Stripe checkout to collect card before onboarding
      console.log('Redirecting to Stripe:', data.user?.id, form.email)
      window.location.href = '/api/stripe/checkout-signup?priceId=price_1TZdETLtci79J0RjR1JnKafJ&userId=' + data.user.id + '&email=' + encodeURIComponent(form.email)
    } else if (data.user) {
      router.push('/login?email=' + encodeURIComponent(form.email))
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>Create Account — CreatorFlow Studio™</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div className="min-h-screen bg-void flex flex-col">
        <div className="fixed inset-0 bg-electric-glow pointer-events-none" />
        <nav className="relative z-10 px-6 py-5">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
              <span className="text-white text-xs font-bold">CF</span>
            </div>
            <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-lg font-medium tracking-wide">
              CreatorFlow
            </span>
          </Link>
        </nav>
        <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
          <div className="w-full max-w-md">
            {success ? (
              <div className="glass rounded-2xl p-8 text-center">
                <h2 className="text-2xl text-primary font-medium mb-3">Check your email</h2>
                <p className="text-secondary text-sm">We sent a confirmation link to <strong>{form.email}</strong></p>
              </div>
            ) : (
              <div className="glass rounded-2xl p-8">
                <div className="text-center mb-8">
                  {plan === 'pro' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric/10 text-electric-glow text-xs mb-4">
                      ✦ 3-day free trial — then $17/month
                    </div>
                  )}
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl text-primary font-light mb-2">Start flowing.</h1>
                  <p className="text-secondary text-sm">Create your CreatorFlow account.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-secondary text-xs mb-2">Email address</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required className="input-field w-full px-4 py-3 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-secondary text-xs mb-2">Password</label>
                    <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" required className="input-field w-full px-4 py-3 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-secondary text-xs mb-2">Confirm password</label>
                    <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat your password" required className="input-field w-full px-4 py-3 rounded-xl text-sm" />
                  </div>
                  {error && (
                    <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                      <p className="text-error text-sm">{error}</p>
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="btn-electric w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-50 mt-2">
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
                <p className="text-center text-tertiary text-xs mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-electric-glow">Sign in</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}