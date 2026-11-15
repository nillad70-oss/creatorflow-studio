import { getServiceClient } from '../../../lib/server/auth'
import { verifyFalWebhook } from '../../../lib/server/fal'
import { recordProviderResult } from '../../../lib/server/twinCreation'

export const config = { api: { bodyParser: false } }

async function readRaw(req) {
  if (req.rawBody) return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody)
  const chunks = []
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
  return Buffer.concat(chunks)
}

// fal.ai calls this when a candidate finishes. It only records the result;
// checking happens on the creator's next status poll, so this stays fast and
// can be retried safely.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const raw = await readRaw(req)
  let valid = false
  try { valid = await verifyFalWebhook(req.headers, raw) } catch { valid = false }
  if (!valid) return res.status(401).json({ error: 'Invalid signature' })

  let body
  try { body = JSON.parse(raw.toString('utf8')) } catch { return res.status(400).json({ error: 'Bad JSON' }) }

  const supabase = getServiceClient()
  const { data: job } = await supabase.from('generation_jobs').select('id, status')
    .eq('provider', 'fal').eq('provider_job_id', String(body.request_id || '')).maybeSingle()
  if (!job) return res.status(200).json({ ok: true }) // unknown or deleted: acknowledge, do nothing

  if (body.status === 'OK' && body.payload?.images?.[0]?.url) {
    await recordProviderResult(supabase, job, { imageUrl: body.payload.images[0].url })
  } else {
    await recordProviderResult(supabase, job, { error: body.error || 'provider error' })
  }
  return res.status(200).json({ ok: true })
}
