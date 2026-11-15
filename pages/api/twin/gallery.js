import { requireUser, getServiceClient } from '../../../lib/server/auth'
import { rateLimit, isUuidLike } from '../../../lib/server/guard'
import { requireTwinEnabled, audit, GENERATED_BUCKET } from '../../../lib/server/twin'

// GET    /api/twin/gallery        -> the caller's delivered images (10-minute links)
// DELETE /api/twin/gallery { id } -> permanently deletes one image
export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!requireTwinEnabled(res)) return
  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: `twin-gallery:${user.id}`, limit: 60 })) return
  const supabase = getServiceClient()

  if (req.method === 'GET') {
    const { data: assets } = await supabase.from('generated_assets')
      .select('id, storage_path, is_best, likeness, creation_id, created_at')
      .eq('user_id', user.id).eq('media_type', 'image').order('created_at', { ascending: false }).limit(60)
    const images = []
    for (const a of assets || []) {
      const { data } = await supabase.storage.from(GENERATED_BUCKET).createSignedUrl(a.storage_path, 10 * 60, { download: false })
      images.push({ id: a.id, url: data?.signedUrl || null, is_best: a.is_best, likeness: a.likeness, creation_id: a.creation_id, created_at: a.created_at })
    }
    return res.status(200).json({ images })
  }

  const id = req.body?.id
  if (!isUuidLike(id)) return res.status(400).json({ error: 'Invalid id' })
  const { data: asset } = await supabase.from('generated_assets').select('id, storage_path').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!asset) return res.status(404).json({ error: 'Not found' })
  await supabase.storage.from(GENERATED_BUCKET).remove([asset.storage_path])
  await supabase.from('generated_assets').delete().eq('id', id).eq('user_id', user.id)
  await audit(user.id, 'twin.image.deleted', id, {})
  return res.status(200).json({ deleted: true })
}
