// fal.ai queue client + webhook signature verification (server-only).
import crypto from 'crypto'
import { ENGINES } from '../twinStudio'

const QUEUE = 'https://queue.fal.run'
const JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json'

export const isFalConfigured = () => Boolean(process.env.FAL_KEY)

const SIZE_FOR = { // GPT Image 2.5 sizes (edges multiples of 16)
  standard: { '1:1': [2048, 2048], '4:5': [1792, 2240], '3:4': [1536, 2048], '2:3': [1536, 2304], '9:16': [1440, 2560], '16:9': [2560, 1440] },
  ultra:    { '1:1': [2880, 2880], '4:5': [2560, 3200], '3:4': [2496, 3328], '2:3': [2400, 3600], '9:16': [2160, 3840], '16:9': [3840, 2160] },
}

// Builds the provider input for an engine.
export function engineInput(engine, { prompt, referenceUrls, tier, aspect }) {
  if (engine === 'studio-pro') {
    return {
      prompt, image_urls: referenceUrls, num_images: 1,
      resolution: tier === 'ultra' ? '4K' : '2K',
      aspect_ratio: aspect, output_format: 'png',
      safety_tolerance: '2',
    }
  }
  if (engine === 'precision') {
    const [width, height] = SIZE_FOR[tier][aspect]
    return {
      prompt, image_urls: referenceUrls, quality: 'high',
      image_size: { width, height }, output_format: 'png',
    }
  }
  throw new Error(`unknown engine ${engine}`)
}

export async function submitJob(engine, input, webhookUrl) {
  const model = ENGINES[engine].model
  const url = `${QUEUE}/${model}${webhookUrl ? `?fal_webhook=${encodeURIComponent(webhookUrl)}` : ''}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error(`fal submit failed (${r.status})`)
  const d = await r.json()
  return { requestId: d.request_id, statusUrl: d.status_url, responseUrl: d.response_url }
}

// Polls the provider when no webhook has arrived yet.
// Returns { state: 'pending' } | { state: 'done', imageUrl } | { state: 'error', error }
export async function pollJob(statusUrl, responseUrl) {
  const auth = { Authorization: `Key ${process.env.FAL_KEY}` }
  const s = await fetch(statusUrl, { headers: auth })
  if (!s.ok) return { state: 'pending' }
  const status = (await s.json()).status
  if (status !== 'COMPLETED') return { state: 'pending' }
  const r = await fetch(responseUrl, { headers: auth })
  const body = await r.json().catch(() => null)
  if (!r.ok) return { state: 'error', error: body?.detail ? JSON.stringify(body.detail).slice(0, 300) : `provider error (${r.status})` }
  const imageUrl = body?.images?.[0]?.url
  return imageUrl ? { state: 'done', imageUrl } : { state: 'error', error: 'provider returned no image' }
}

let jwksCache = null
let jwksAt = 0
async function jwks() {
  if (jwksCache && Date.now() - jwksAt < 6 * 3600_000) return jwksCache
  const r = await fetch(JWKS_URL)
  if (!r.ok) throw new Error('could not fetch fal JWKS')
  jwksCache = (await r.json()).keys || []
  jwksAt = Date.now()
  return jwksCache
}
export const _resetJwksCache = () => { jwksCache = null; jwksAt = 0 }

// Ed25519 signature over: request_id \n user_id \n timestamp \n sha256hex(body)
export async function verifyFalWebhook(headers, rawBody) {
  const requestId = headers['x-fal-webhook-request-id']
  const userId = headers['x-fal-webhook-user-id']
  const timestamp = headers['x-fal-webhook-timestamp']
  const signature = headers['x-fal-webhook-signature']
  if (!requestId || !userId || !timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex')
  const message = Buffer.from([requestId, userId, timestamp, bodyHash].join('\n'), 'utf8')
  let sig
  try { sig = Buffer.from(signature, 'hex') } catch { return false }
  for (const key of await jwks()) {
    try {
      const pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key.x }, format: 'jwk' })
      if (crypto.verify(null, message, pub, sig)) return true
    } catch { /* try next key */ }
  }
  return false
}
