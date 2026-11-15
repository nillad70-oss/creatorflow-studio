import { Readable } from 'stream'
import httpMocks from 'node-mocks-http'
import { state } from './fakeSupabase'

export const USER_A = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'a@test.dev' }
export const USER_B = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'b@test.dev' }
export const TOKEN_A = 'token-user-a'
export const TOKEN_B = 'token-user-b'

// Seeds two users (A = pro, B = free by default) with valid access tokens.
export function seedUsers({ aTier = 'pro', bTier = 'free' } = {}) {
  state.tokens[TOKEN_A] = USER_A
  state.tokens[TOKEN_B] = USER_B
  state.tables.users = [
    { id: USER_A.id, email: USER_A.email, subscription_tier: aTier, stripe_customer_id: 'cus_a' },
    { id: USER_B.id, email: USER_B.email, subscription_tier: bTier, stripe_customer_id: null },
  ]
}

// Calls a Next.js API route handler the way Next would, returning the response.
// `token` is sent as a Bearer header; `body` is sent as JSON.
export async function call(handler, { method = 'POST', body, token, query, rawBody, headers = {} } = {}) {
  const hdrs = { 'content-type': 'application/json', ...headers }
  if (token) hdrs.authorization = `Bearer ${token}`

  let req
  if (rawBody !== undefined) {
    // Routes with bodyParser disabled read the raw stream themselves.
    const stream = Readable.from([Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)])
    stream.method = method
    stream.headers = hdrs
    stream.query = query || {}
    stream.url = '/api/test'
    req = stream
  } else {
    req = httpMocks.createRequest({ method, headers: hdrs, body, query: query || {} })
  }
  const res = httpMocks.createResponse()
  await handler(req, res)
  let json = null
  try { json = res._getJSONData() } catch { json = null }
  return { status: res._getStatusCode(), json, redirect: res._getRedirectUrl(), res }
}
