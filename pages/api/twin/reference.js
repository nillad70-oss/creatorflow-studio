import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit, isUuidLike } from '../../../lib/server/guard'
import { screenReferencePhoto } from '../../../lib/server/screenPhoto'
import {
  requireTwinEnabled, requirePro, getTwin, getActiveConsent, audit, isOwnPath, sniffType, storagePathFor,
  REFERENCE_BUCKET, IMAGE_TYPES, MAX_REFERENCES, MIN_REFERENCES, MAX_REFERENCE_BYTES,
} from '../../../lib/server/twin'

// POST   /api/twin/reference  { action: 'upload-url', mime_type }  -> signed upload URL
// POST   /api/twin/reference  { action: 'finalize', path }         -> screen + save
// DELETE /api/twin/reference  { id }                               -> remove one photo
export default async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `twin-ref:${user.id}`, limit: 30 })) return

  const twin = await getTwin(user.id)
  if (!twin) return res.status(404).json({ error: 'Start by giving consent.' })
  const supabase = getServiceClient()

  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (!isUuidLike(id)) return res.status(400).json({ error: 'Invalid photo.' })
    const { data: ref } = await supabase.from('twin_reference_images').select('*')
      .eq('id', id).eq('user_id', user.id).maybeSingle()
    if (!ref) return res.status(404).json({ error: 'Photo not found.' })
    await supabase.storage.from(REFERENCE_BUCKET).remove([ref.storage_path])
    await supabase.from('twin_reference_images').delete().eq('id', id).eq('user_id', user.id)
    await audit(user.id, 'twin.reference.deleted', id)
    return res.status(200).json({ ok: true })
  }

  if (!(await requirePro(res, user.id))) return
  const consent = await getActiveConsent(user.id, twin.id)
  if (!consent || !consent.recording_path) {
    return res.status(409).json({ error: 'Please complete the consent step, including the short recording, first.' })
  }

  const { action } = req.body || {}
  const { data: existing } = await supabase.from('twin_reference_images').select('id')
    .eq('user_id', user.id).eq('twin_id', twin.id)
  const count = existing?.length || 0

  if (action === 'upload-url') {
    const { mime_type } = req.body
    if (!IMAGE_TYPES.includes(mime_type)) return res.status(400).json({ error: 'Use a JPEG, PNG or WebP photo.' })
    if (count >= MAX_REFERENCES) return res.status(400).json({ error: `You can upload up to ${MAX_REFERENCES} photos.` })
    const path = storagePathFor(user.id, twin.id, 'ref', mime_type)
    const { data: upload, error } = await supabase.storage.from(REFERENCE_BUCKET).createSignedUploadUrl(path)
    if (error) return res.status(500).json({ error: 'Could not prepare the upload.' })
    return res.status(200).json({ path, token: upload.token, signed_url: upload.signedUrl })
  }

  if (action === 'finalize') {
    const { path } = req.body
    if (!isOwnPath(path, user.id, twin.id) || !path.includes('/ref-')) return res.status(400).json({ error: 'Invalid photo.' })
    if (count >= MAX_REFERENCES) {
      await supabase.storage.from(REFERENCE_BUCKET).remove([path])
      return res.status(400).json({ error: `You can upload up to ${MAX_REFERENCES} photos.` })
    }

    const { data: file, error } = await supabase.storage.from(REFERENCE_BUCKET).download(path)
    if (error || !file) return res.status(400).json({ error: 'Upload not found. Please try again.' })
    const buf = Buffer.from(await file.arrayBuffer())
    const type = sniffType(buf)
    if (!IMAGE_TYPES.includes(type) || buf.length > MAX_REFERENCE_BYTES) {
      await supabase.storage.from(REFERENCE_BUCKET).remove([path])
      return res.status(400).json({ error: 'That file is not a valid photo under 10 MB.' })
    }

    let screening
    try {
      screening = await screenReferencePhoto(buf, type)
    } catch (err) {
      console.error('Photo screening failed:', err)
      await supabase.storage.from(REFERENCE_BUCKET).remove([path])
      return res.status(502).json({ error: 'We could not check that photo right now. Please try again.' })
    }

    if (!screening.accepted) {
      await supabase.storage.from(REFERENCE_BUCKET).remove([path])
      await audit(user.id, 'twin.reference.rejected', path, { reasons: screening.reasons })
      return res.status(200).json({ accepted: false, reasons: screening.reasons })
    }

    const { data: ref, error: insertError } = await supabase.from('twin_reference_images')
      .insert({
        user_id: user.id, twin_id: twin.id, storage_path: path, mime_type: type,
        file_size_bytes: buf.length, screening: screening.result,
      })
      .select('id, created_at')
      .single()
    if (insertError) {
      await supabase.storage.from(REFERENCE_BUCKET).remove([path])
      return res.status(500).json({ error: 'Could not save that photo.' })
    }

    const total = count + 1
    if (total >= MIN_REFERENCES && twin.status === 'consented') {
      await supabase.from('twin_profiles').update({ status: 'ready' }).eq('id', twin.id).eq('user_id', user.id)
    }
    await audit(user.id, 'twin.reference.accepted', ref.id)
    return res.status(200).json({ accepted: true, id: ref.id, total, ready: total >= MIN_REFERENCES })
  }

  return res.status(400).json({ error: 'Unknown action.' })
}
