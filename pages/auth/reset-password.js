import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase/client'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Listen for the session from the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      router.push('/dashboard')
    }, 2000)
  }

  return (
    <>
      <Head>
        <title>Reset Password — NillaFlow Studio™.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void flex flex-col">
        <div className="fixed inset-0 bg-electric-glow pointer-events-none" />

        {/* Nav */}
        <nav className="relative z-10 px-6 py-5">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 80 80" fill="none"><line x1="14" y1="14" x2="14" y2="66" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round"/><line x1="14" y1="14" x2="66" y2="66" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round"/><line x1="66" y1="14" x2="66" y2="66" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round"/><path d="M14 40 C24 28 34 52 40 40 C46 28 56 52 66 40" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none"/><path d="M14 52 C24 40 34 64 40 52 C46 40 56 64 66 52" stroke="#C8A96E" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
            </div>
            <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-lg font-medium tracking-wide">
              NillaFlow
            </span>
          </Link>
        </nav>

        <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
          <div className="w-full max-w-md">

            {success ? (
              <div className="glass rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-5">
                  <span className="text-success text-2xl">✓</span>
                </div>
                <h2 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-medium mb-3">
                  Password updated!
                </h2>
                <p className="text-secondary text-sm">
                  Taking you to your dashboard...
                </p>
              </div>
            ) : (
              <div className="glass rounded-2xl p-8">
                <div className="text-center mb-8">
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl text-primary font-light mb-2">
                    Set new password
                  </h1>
                  <p className="text-secondary text-sm">
                    Choose a strong password for your account.
                  </p>
                </div>

                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      New password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      placeholder="At least 8 characters"
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                      placeholder="Repeat your password"
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
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}