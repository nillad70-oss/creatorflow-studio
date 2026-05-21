import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

export default function Signup() {
  const router = useRouter()
  const { plan } = router.query // 'pro' or undefined

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

    // 1. Sign up with Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          intended_plan: plan || 'free'
        }
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Create user profile row
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        subscription_tier: 'free',
        onboarding_complete: false,
        created_at: new Date().toISOString()
      })
    }

    // If email confirmation is off, redirect straight to onboarding
if (data.session) {
  router.push('/onboarding')
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
        {/* Background */}
        <div className="fixed inset-0 bg-electric-glow pointer-events-none" />

        {/* Nav */}
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

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
          <div className="w-full max-w-md">

            {success ? (
              // ── Success State ──
              <div className="glass rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-5">
                  <span className="text-success text-2xl">✓</span>
                </div>
                <h2 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-medium mb-3">
                  Check your email
                </h2>
                <p className="text-secondary text-sm leading-relaxed mb-6">
                  We sent a confirmation link to <strong className="text-primary">{form.email}</strong>.
                  Click it to activate your account and start flowing.
                </p>
                <p className="text-tertiary text-xs">
                  Didn't get it? Check your spam folder.
                </p>
              </div>
            ) : (
              // ── Signup Form ──
              <div className="glass rounded-2xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  {plan === 'pro' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric/10 text-electric-glow text-xs mb-4">
                      ✦ 3-day free trial — then $17/month
                    </div>
                  )}
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl text-primary font-light mb-2">
                    Start flowing.
                  </h1>
                  <p className="text-secondary text-sm">
                    Create your free CreatorFlow account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      Email address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="At least 8 characters"
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat your password"
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                      <p className="text-error text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-electric w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>

                {/* Divider */}
                <div className="divider-glow my-6" />

                {/* Footer */}
                <p className="text-center text-tertiary text-xs">
                  Already have an account?{' '}
                  <Link href="/login" className="text-electric-glow hover:underline">
                    Sign in
                  </Link>
                </p>

                <p className="text-center text-tertiary text-xs mt-3 leading-relaxed">
                  By creating an account, you agree to our{' '}
                  <Link href="/terms" className="hover:text-secondary transition-colors">Terms</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="hover:text-secondary transition-colors">Privacy Policy</Link>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
