import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from './supabase/client'

// Members-only pages. Signed-out visitors are sent to /login.
//
// Why this is client-side: NillaFlow's Supabase client stores the session in the
// browser (localStorage), not in cookies, so server middleware cannot see it.
// That is why the original middleware.js was disabled: it redirected
// signed-in users too. Real data protection is enforced on the server: every
// API route verifies the session token, and every table has Row Level Security.
// This gate is the user-experience layer on top.
export const PROTECTED_PREFIXES = [
  '/dashboard', '/onboarding', '/scripts', '/teleprompter', '/planner',
  '/captions', '/library', '/settings', '/adcopy', '/build-story', '/my-story',
]

export function isProtectedPath(path) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))
}

export default function AuthGate({ children }) {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady || !isProtectedPath(router.pathname)) return
    let cancelled = false
    createClient().auth.getSession().then(({ data }) => {
      if (!cancelled && !data?.session) router.replace('/login')
    })
    return () => { cancelled = true }
  }, [router.isReady, router.pathname])

  return children
}
