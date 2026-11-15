import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'
import {
  requireTwinEnabled, requirePro, getTwin, audit, storagePathFor,
  CONSENT_VERSION, CONSENT_SCOPES, REFERENCE_BUCKET, RECORDING_TYPES,
} from '../../../lib/server/twin'

// POST /api/twin/consent
// Body: { scopes: string[], attest_self: true, attest_adult: true,
//         consent_version, recording_mime_type }
// Records versioned, scoped consent (creating the twin if needed) and returns
// a one-time signed URL for uploading the on-camera consent statement.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `twin-consent:${user.id}`, limit: 10 })) return
  if (!(await requirePro(res, user.id))) return

  const { scopes, attest_self, attest_adult, consent_version, recording_mime_type } = req.body || {}

  if (consent_version !== CONSENT_VERSION) {
    return res.status(409).json({ error: 'The consent terms have changed. Please reload and review them again.', consent_version: CONSENT_VERSION })
  }
  if (attest_self !== true || attest_adult !== true) {
    return res.status(400).json({ error: 'You must confirm the photos are of you and that you are 18 or older.' })
  }
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every((s) => CONSENT_SCOPES.includes(s))) {
    return res.status(400).json({ error: 'Choose at least one allowed use.' })
  }
  if (!RECORDING_TYPES.includes(recording_mime_type)) {
    return res.status(400).json({ error: 'Unsupported recording format.' })
  }

  const supabase = getServiceClient()

  let twin = await getTwin(user.id)
  if (!twin) {
    const { data, error } = await supabase
      .from('twin_profiles').insert({ user_id: user.id, status: 'draft' }).select().single()
    if (error) return res.status(500).json({ error: 'Could not start your AI Twin. Please try again.' })
    twin = data
  }

  const { data: consent, error: consentError } = await supabase
    .from('consent_records')
    .insert({
      user_id: user.id,
      twin_id: twin.id,
      consent_version: CONSENT_VERSION,
      scopes: [...new Set(scopes)],
      attest_self: true,
      attest_adult: true,
      ip_address: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
    })
    .select()
    .single()
  if (consentError) return res.status(500).json({ error: 'Could not save your consent. Please try again.' })

  const path = storagePathFor(user.id, twin.id, 'consent', recording_mime_type)
  const { data: upload, error: uploadError } = await supabase.storage
    .from(REFERENCE_BUCKET).createSignedUploadUrl(path)
  if (uploadError) return res.status(500).json({ error: 'Could not prepare the recording upload.' })

  await audit(user.id, 'twin.consent.signed', consent.id, { scopes: consent.scopes, version: CONSENT_VERSION })

  return res.status(200).json({
    twin_id: twin.id,
    consent_id: consent.id,
    recording_upload: { path, token: upload.token, signed_url: upload.signedUrl },
  })
}
