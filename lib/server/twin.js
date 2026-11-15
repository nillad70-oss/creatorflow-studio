// AI Twin™ server helpers (server-only).
import { getServiceClient, getTier } from './auth'
import { CONSENT_VERSION } from '../twinConsent'

export { CONSENT_VERSION }
export const CONSENT_SCOPES = ['professional', 'fashion_lifestyle', 'video', 'voice']
export const REFERENCE_BUCKET = 'twin-references'
export const GENERATED_BUCKET = 'generated-media'
export const MAX_REFERENCES = 10
export const MIN_REFERENCES = 5
export const MAX_REFERENCE_BYTES = 10 * 1024 * 1024
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const RECORDING_TYPES = ['video/webm', 'video/mp4', 'video/quicktime']

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
}

// The feature ships dark: routes answer 404 until AI_TWIN_ENABLED=true.
export const isTwinEnabled = () => process.env.AI_TWIN_ENABLED === 'true'

export function requireTwinEnabled(res) {
  if (isTwinEnabled()) return true
  res.status(404).json({ error: 'Not found' })
  return false
}

// D2: AI Twin is a Pro feature.
export async function requirePro(res, userId) {
  if ((await getTier(userId)) === 'pro') return true
  res.status(403).json({ error: 'AI Twin is a Pro subscriber feature.', upgrade_url: '/settings/billing' })
  return false
}

export function storagePathFor(userId, twinId, kind, mimeType) {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${userId}/${twinId}/${kind}-${Date.now()}-${rand}.${EXT[mimeType]}`
}

// A path is only ever accepted if it sits inside the caller's own folder for
// their own twin. Prevents claiming someone else's uploaded file.
export function isOwnPath(path, userId, twinId) {
  return typeof path === 'string'
    && path.startsWith(`${userId}/${twinId}/`)
    && !path.includes('..')
    && path.length < 300
}

export async function getTwin(userId) {
  const { data } = await getServiceClient()
    .from('twin_profiles').select('*').eq('user_id', userId).maybeSingle()
  return data || null
}

export async function getActiveConsent(userId, twinId) {
  const { data } = await getServiceClient()
    .from('consent_records').select('*')
    .eq('user_id', userId).eq('twin_id', twinId)
    .order('signed_at', { ascending: false }).limit(1)
  const latest = data?.[0]
  return latest && !latest.revoked_at ? latest : null
}

export async function audit(userId, action, target, details = {}) {
  try {
    await getServiceClient().from('audit_log').insert({ user_id: userId, action, target, details })
  } catch (err) {
    console.error('audit_log write failed:', err)
  }
}

// Reads the first bytes of an uploaded file and returns its real type.
export function sniffType(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buf.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm'
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
    return buf.slice(8, 10).toString('ascii') === 'qt' ? 'video/quicktime' : 'video/mp4'
  }
  return null
}
