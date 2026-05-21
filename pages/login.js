import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again.')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in. Check your inbox.')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    // Success — middleware handles redirect
    router.push('/dashboard')
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setResetSent(true)
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>Sign In — CreatorFlow Studio™</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void flex flex-col">
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

            {resetSent ? (
              // ── Reset sent ──
              <div className="glass rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-electric/10 border border-electric/20 flex items-center justify-center mx-auto mb-5">
                  <span className="text-electric-glow text-2xl">✉</span>
                </div>
                <h2 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-medium mb-3">
                  Check your email
                </h2>
                <p className="text-secondary text-sm leading-relaxed mb-6">
                  We sent a password reset link to <strong className="text-primary">{form.email}</strong>.
                </p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false) }}
                  className="text-electric-glow text-sm hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : resetMode ? (
              // ── Password reset form ──
              <div className="glass rounded-2xl p-8">
                <div className="text-center mb-8">
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl text-primary font-light mb-2">
                    Reset password
                  </h1>
                  <p className="text-secondary text-sm">
                    Enter your email and we'll send a reset link.
                  </p>
                </div>

                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-secondary text-xs mb-2">Email address</label>
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

                  {error && (
                    <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                      <p className="text-error text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-electric w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>

                <div className="divider-glow my-6" />

                <p className="text-center text-tertiary text-xs">
                  <button onClick={() => setResetMode(false)} className="text-electric-glow hover:underline">
                    Back to sign in
                  </button>
                </p>
              </div>
            ) : (
              // ── Login form ──
              <div className="glass rounded-2xl p-8">
                <div className="text-center mb-8">
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl text-primary font-light mb-2">
                    Welcome back.
                  </h1>
                  <p className="text-secondary text-sm">Sign in to continue flowing.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
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

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-secondary text-xs tracking-wide">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setResetMode(true)}
                        className="text-tertiary text-xs hover:text-secondary transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Your password"
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>

                  {error && (
                    <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                      <p className="text-error text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-electric w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="divider-glow my-6" />

                <p className="text-center text-tertiary text-xs">
                  Don't have an account?{' '}
                  <Link href="/signup" className="text-electric-glow hover:underline">
                    Create one free
                  </Link>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
