import { createClient } from './supabase/client'

// fetch() for NillaFlow's own /api routes. Adds the signed-in user's Supabase
// access token as a Bearer header, which the server verifies to identify the
// user. Same call signature as fetch, so pages only swap the function name.
export async function authFetch(url, options = {}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(options.headers || {})
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(url, { ...options, headers })
}
