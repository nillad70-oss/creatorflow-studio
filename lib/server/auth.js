// Server-only helpers. Never import this file from a page or component:
// it reads SUPABASE_SERVICE_ROLE_KEY, which must never reach a browser.
import { createClient } from '@supabase/supabase-js'

if (typeof window !== 'undefined') {
  throw new Error('lib/server/auth.js must only be imported on the server')
}

// Privileged client: bypasses Row Level Security. Only use it AFTER the caller's
// identity has been verified with requireUser(), and always scope every query
// to that verified user's id.
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function readBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

// Verifies the Supabase access token sent by the browser and returns the
// signed-in user. On failure it sends HTTP 401 itself and returns null, so a
// route only has to write:
//
//   const user = await requireUser(req, res)
//   if (!user) return
//
// Identity comes ONLY from the verified token. Any user_id in the request body
// is ignored.
export async function requireUser(req, res) {
  const token = readBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.' })
    return null
  }
  try {
    const { data, error } = await getServiceClient().auth.getUser(token)
    if (error || !data?.user) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
      return null
    }
    return data.user
  } catch (err) {
    console.error('Auth verification failed:', err)
    res.status(401).json({ error: 'Could not verify your session. Please sign in again.' })
    return null
  }
}

// Looks up the subscription tier for an already-verified user.
export async function getTier(userId) {
  const { data } = await getServiceClient()
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single()
  return data?.subscription_tier || 'free'
}
