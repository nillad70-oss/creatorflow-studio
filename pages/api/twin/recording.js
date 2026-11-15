import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'
import {
  requireTwinEnabled, getTwin, getActiveConsent, audit, isOwnPath, sniffType,
  REFERENCE_BUCKET, RECORDING_TYPES, MAX_RECORDING_BYTES,
} from '../../../lib/server/twin'

// POST /api/twin/recording  Body: { path }
// Confirms the consent recording was uploaded to the caller's own folder,
// checks it is a real video of acceptable size, and links it to the consent.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `twin-recording:${user.id}`, limit: 10 })) return

  const twin = await getTwin(user.id)
  if (!twin) return res.status(404).json({ error: 'Start by giving consent.' })
  const consent = await getActiveConsent(user.id, twin.id)
  if (!consent) return res.status(409).json({ error: 'No active consent on file.' })

  const { path } = req.body || {}
  if (!isOwnPath(path, user.id, twin.id) || !path.includes('/consent-')) {
    return res.status(400).json({ error: 'Invalid recording.' })
  }

  const supabase = getServiceClient()
  const { data: file, error } = await supabase.storage.from(REFERENCE_BUCKET).download(path)
  if (error || !file) return res.status(400).json({ error: 'Recording not found. Please record again.' })

  const buf = Buffer.from(await file.arrayBuffer())
  const type = sniffType(buf)
  if (buf.length === 0 || buf.length > MAX_RECORDING_BYTES || !RECORDING_TYPES.includes(type)) {
    await supabase.storage.from(REFERENCE_BUCKET).remove([path])
    return res.status(400).json({ error: 'That recording could not be used. Please record again (max 25 MB).' })
  }

  // Replace any earlier recording for this consent.
  if (consent.recording_path && consent.recording_path !== path) {
    await supabase.storage.from(REFERENCE_BUCKET).remove([consent.recording_path])
  }

  await supabase.from('consent_records').update({ recording_path: path }).eq('id', consent.id).eq('user_id', user.id)
  if (twin.status === 'draft') {
    await supabase.from('twin_profiles').update({ status: 'consented' }).eq('id', twin.id).eq('user_id', user.id)
  }
  await audit(user.id, 'twin.consent.recorded', consent.id, { bytes: buf.length })

  return res.status(200).json({ ok: true, status: twin.status === 'draft' ? 'consented' : twin.status })
}
