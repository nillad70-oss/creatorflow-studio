import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'
import { requireTwinEnabled, requirePro, getTwin, getActiveConsent, CONSENT_VERSION } from '../../../lib/server/twin'
import { isFalConfigured } from '../../../lib/server/fal'
import { quickPromptCheck, reviewPrompt } from '../../../lib/server/twinPrompt'
import { startCreation, advanceCreation } from '../../../lib/server/twinCreation'
import { STYLES, ENGINE_MODES, TIERS, ASPECTS } from '../../../lib/twinStudio'

export const config = { maxDuration: 60 }

const DAILY_LIMIT = () => Number(process.env.TWIN_DAILY_CREATIONS || 20)

// POST /api/twin/generate { style, mode, tier, aspect, description } -> starts a creation
// GET  /api/twin/generate?id=<creation id>                           -> advances + returns its state
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return
  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    if (!rateLimit(req, res, { key: `twin-poll:${user.id}`, limit: 120 })) return
    const id = String(req.query?.id || '')
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const view = await advanceCreation(id, user.id)
      if (!view) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(view)
    } catch (e) {
      console.error('advanceCreation error', e)
      return res.status(500).json({ error: 'Something went wrong checking your images. Please try again.' })
    }
  }

  if (!rateLimit(req, res, { key: `twin-gen:${user.id}`, limit: 6 })) return
  if (!(await requirePro(res, user.id))) return
  if (!isFalConfigured() || !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Image creation is not switched on yet.' })
  }

  const { style, mode = 'best', tier = 'standard', aspect = '4:5', description = '' } = req.body || {}
  if (!STYLES[style] || !ENGINE_MODES[mode] || !TIERS[tier] || !ASPECTS.includes(aspect)) {
    return res.status(400).json({ error: 'Please choose a style, engine, quality and shape.' })
  }

  const twin = await getTwin(user.id)
  if (!twin || twin.status !== 'ready') return res.status(409).json({ error: 'Finish setting up your AI Twin first.' })
  const consent = await getActiveConsent(user.id, twin.id)
  if (!consent || consent.consent_version !== CONSENT_VERSION) {
    return res.status(409).json({ error: 'Please review and accept the updated AI Twin consent first.', reconsent: true })
  }
  if (!consent.scopes.includes(STYLES[style].scope)) {
    return res.status(403).json({ error: 'You did not allow this kind of use in your consent.' })
  }

  const quick = quickPromptCheck(description)
  if (!quick.ok) return res.status(400).json({ error: quick.reason })
  try {
    const review = await reviewPrompt(STYLES[style].scope, description)
    if (!review.allowed) return res.status(400).json({ error: review.reason })
  } catch {
    return res.status(502).json({ error: 'We could not check your request right now. Please try again.' })
  }

  const supabase = getServiceClient()
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data: recent } = await supabase.from('twin_creations').select('id').eq('user_id', user.id).gte('created_at', since)
  if ((recent || []).length >= DAILY_LIMIT()) {
    return res.status(429).json({ error: 'You have reached today\'s AI Twin limit. Please try again tomorrow.' })
  }

  try {
    const out = await startCreation({ userId: user.id, twin, consent, style, mode, tier, aspect, description })
    if (out.error === 'insufficient_credits') {
      return res.status(402).json({ error: `You need ${out.cost} credit${out.cost > 1 ? 's' : ''} for this.`, needs_credits: out.cost })
    }
    return res.status(200).json({ creation_id: out.creation.id, cost: out.cost })
  } catch (e) {
    console.error('startCreation error', e)
    return res.status(500).json({ error: 'Could not start your images. Your credits were not used.' })
  }
}
