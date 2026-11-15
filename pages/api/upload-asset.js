import { requireUser, getServiceClient } from '../../lib/server/auth'
import { rateLimit } from '../../lib/server/guard'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
// base64 inflates by ~4/3; allow a little JSON overhead, refuse anything larger
const MAX_BODY_BYTES = Math.ceil(MAX_FILE_SIZE * 4 / 3) + 64 * 1024

// Checks the file's real leading bytes, so a renamed HTML/script file can't be
// stored under an image MIME type.
function sniffImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

export const config = {
  api: { bodyParser: false }, // we're handling raw multipart/base64 upload ourselves
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Identity comes from the verified session token, checked BEFORE the body is read.
  const user = await requireUser(req, res)
  if (!user) return
  const user_id = user.id
  if (!rateLimit(req, res, { key: `upload:${user_id}`, limit: 20 })) return

  // Body is expected as JSON: { file_base64, mime_type, filename, asset_type }
  // (bodyParser disabled above, so parse manually; any user_id or
  // file_size_bytes sent by the client is ignored)
  let body
  try {
    const chunks = []
    let total = 0
    for await (const chunk of req) {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        return res.status(400).json({ error: 'File exceeds the 5 MB limit.' })
      }
      chunks.push(chunk)
    }
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const { file_base64, mime_type, asset_type } = body

  if (!file_base64 || !mime_type) {
    return res.status(400).json({ error: 'file_base64 and mime_type are required' })
  }

  const supabase = getServiceClient()

  // ── ENTITLEMENT CHECK — server-side, before anything else happens.
  // A free user cannot get past this line even if they call this route directly. ──
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', user_id)
    .single()

  if (userError || !userRow) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (userRow.subscription_tier !== 'pro') {
    return res.status(403).json({ error: 'Asset Intelligence is a Pro subscriber feature. Upgrade to unlock image uploads.' })
  }

  // ── FILE VALIDATION — server-side, not trusting the client's own checks ──
  if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
    return res.status(400).json({ error: 'Unsupported file type. Please upload JPEG, PNG, or WebP.' })
  }

  const fileBuffer = Buffer.from(file_base64, 'base64')
  const file_size_bytes = fileBuffer.length // real size, never the client's claim

  if (file_size_bytes === 0 || file_size_bytes > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File exceeds the 5 MB limit.' })
  }

  if (sniffImageType(fileBuffer) !== mime_type) {
    return res.status(400).json({ error: 'That file is not a valid JPEG, PNG, or WebP image.' })
  }

  const ALLOWED_ASSET_TYPES = ['image', 'screenshot', 'product_image', 'brand_graphic']
  const safeAssetType = ALLOWED_ASSET_TYPES.includes(asset_type) ? asset_type : 'image'

  // ── STORE — path scoped to the user's own folder, matching Storage RLS policy ──
  const extension = mime_type.split('/')[1]
  const safeFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const storagePath = `${user_id}/${safeFilename}`

  const { error: uploadError } = await supabase.storage
    .from('user-assets')
    .upload(storagePath, fileBuffer, { contentType: mime_type })

  if (uploadError) {
    return res.status(500).json({ error: 'Upload failed: ' + uploadError.message })
  }

  // ── CREATE ASSET ROW ──
  const { data: asset, error: insertError } = await supabase
    .from('assets')
    .insert({
      user_id,
      storage_path: storagePath,
      asset_type: safeAssetType,
      mime_type,
      file_size_bytes,
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: 'Failed to save asset record: ' + insertError.message })
  }

  return res.status(200).json({ asset })
}
