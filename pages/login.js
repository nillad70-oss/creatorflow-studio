import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '../lib/supabase/client'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })
      if (error) { setError(error.message); setLoading(false); return }
      console.log('LOGIN RESULT:', JSON.stringify(data))
if (data.session) { window.location.href = '/dashboard' }
if (!data.session) { setError('No session returned. Data: ' + JSON.stringify(data)) }
    } catch (err) {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="w-full max-w-md glass rounded-2xl p-8">
        <h1 className="text-3xl text-primary text-center mb-8">Welcome back.</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="input-field w-full px-4 py-3 rounded-xl text-sm" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="input-field w-full px-4 py-3 rounded-xl text-sm" />
          {error && <p className="text-error text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-electric w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-tertiary text-xs mt-6">No account? <Link href="/signup" className="text-electric-glow">Create one free</Link></p>
      </div>
    </div>
  )
}