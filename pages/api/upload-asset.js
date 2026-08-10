import { createClient } from '@supabase/supabase-js'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export const config = {
  api: { bodyParser: false }, // we're handling raw multipart/base64 upload ourselves
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Body is expected as JSON: { user_id, file_base64, mime_type, file_size_bytes, filename, asset_type }
  // (bodyParser disabled above, so parse manually to support larger payloads cleanly)
  let body
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const { user_id, file_base64, mime_type, file_size_bytes, filename, asset_type } = body

  if (!user_id || !file_base64 || !mime_type) {
    return res.status(400).json({ error: 'user_id, file_base64, and mime_type are required' })
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

  if (file_size_bytes > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File exceeds the 5 MB limit.' })
  }

  // ── STORE — path scoped to the user's own folder, matching Storage RLS policy ──
  const extension = mime_type.split('/')[1]
  const safeFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const storagePath = `${user_id}/${safeFilename}`

  const fileBuffer = Buffer.from(file_base64, 'base64')

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
      asset_type: asset_type || 'image',
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
