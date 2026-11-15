import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit } from '../../../lib/server/guard'
import { getBalance, applyCredit } from '../../../lib/server/credits'
import {
  requireTwinEnabled, getTwin, getActiveConsent, audit,
  REFERENCE_BUCKET, GENERATED_BUCKET, CONSENT_VERSION, CONSENT_SCOPES, MIN_REFERENCES, MAX_REFERENCES,
} from '../../../lib/server/twin'

// GET    /api/twin  -> the caller's AI Twin status (photos as 60-second preview links)
// DELETE /api/twin  -> permanently deletes the caller's AI Twin: photos, consent
//                      recording, generated media and all twin records. Purchased
//                      credits are kept. Returns a deletion receipt.
export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `twin:${user.id}`, limit: 60 })) return

  const supabase = getServiceClient()
  const twin = await getTwin(user.id)

  if (req.method === 'GET') {
    const credits = await getBalance(user.id)
    const base = { consent_version: CONSENT_VERSION, scopes_available: CONSENT_SCOPES, min_photos: MIN_REFERENCES, max_photos: MAX_REFERENCES, credits }
    if (!twin) return res.status(200).json({ ...base, twin: null })

    const consent = await getActiveConsent(user.id, twin.id)
    const { data: refs } = await supabase.from('twin_reference_images')
      .select('id, storage_path, created_at').eq('user_id', user.id).eq('twin_id', twin.id)
      .order('created_at', { ascending: true })

    const photos = []
    for (const ref of refs || []) {
      const { data } = await supabase.storage.from(REFERENCE_BUCKET).createSignedUrl(ref.storage_path, 60)
      photos.push({ id: ref.id, preview_url: data?.signedUrl || null, created_at: ref.created_at })
    }

    return res.status(200).json({
      ...base,
      twin: { id: twin.id, status: twin.status, created_at: twin.created_at },
      consent: consent ? {
        scopes: consent.scopes, version: consent.consent_version,
        signed_at: consent.signed_at, recording_on_file: Boolean(consent.recording_path),
      } : null,
      photos,
    })
  }

  // DELETE
  if (!twin) return res.status(200).json({ deleted: false, message: 'No AI Twin to delete.' })

  const paths = []
  const { data: refs } = await supabase.from('twin_reference_images').select('storage_path').eq('user_id', user.id).eq('twin_id', twin.id)
  ;(refs || []).forEach((r) => paths.push([REFERENCE_BUCKET, r.storage_path]))
  const { data: consents } = await supabase.from('consent_records').select('recording_path').eq('user_id', user.id).eq('twin_id', twin.id)
  ;(consents || []).forEach((c) => c.recording_path && paths.push([REFERENCE_BUCKET, c.recording_path]))
  const { data: generated } = await supabase.from('generated_assets').select('storage_path').eq('user_id', user.id).eq('twin_id', twin.id)
  ;(generated || []).forEach((g) => paths.push([GENERATED_BUCKET, g.storage_path]))

  let filesRemoved = 0
  let failed = false
  for (const bucket of [REFERENCE_BUCKET, GENERATED_BUCKET]) {
    const list = paths.filter(([b]) => b === bucket).map(([, p]) => p)
    if (!list.length) continue
    const { error } = await supabase.storage.from(bucket).remove(list)
    if (error) failed = true
    else filesRemoved += list.length
  }

  const rows = {
    photos: refs?.length || 0,
    consent_records: consents?.length || 0,
    generated_assets: generated?.length || 0,
  }
  // Return credits held by any creation still in progress, then remove job records.
  const { data: running } = await supabase.from('twin_creations').select('id, credits_held')
    .eq('user_id', user.id).eq('twin_id', twin.id).eq('status', 'running')
  for (const c of running || []) {
    await applyCredit(user.id, c.credits_held, 'release', `creation:${c.id}`, 'AI Twin deleted')
  }
  await supabase.from('generation_jobs').delete().eq('user_id', user.id).eq('twin_id', twin.id)
  // Deleting the twin cascades to consent records, reference photos, creations and generated assets.
  const { error: deleteError } = await supabase.from('twin_profiles').delete().eq('id', twin.id).eq('user_id', user.id)
  if (deleteError) failed = true

  const { data: receipt } = await supabase.from('deletion_requests').insert({
    user_id: user.id, scope: 'ai_twin', files_removed: filesRemoved, rows_removed: rows,
    status: failed ? 'partial' : 'completed', completed_at: new Date().toISOString(),
  }).select('id, status, completed_at').single()

  await audit(user.id, 'twin.deleted', twin.id, { files_removed: filesRemoved, rows, status: failed ? 'partial' : 'completed' })

  if (failed) {
    return res.status(500).json({ deleted: false, receipt, error: 'Some items could not be deleted. Our team has been notified; please try again.' })
  }
  return res.status(200).json({ deleted: true, receipt, files_removed: filesRemoved, records_removed: rows })
}
