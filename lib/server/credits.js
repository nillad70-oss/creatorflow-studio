// Credit ledger helpers (server-only). All balance changes go through the
// database function apply_credit_entry(), which is atomic, never lets a
// balance go negative, and applies each external reference only once.
import { getServiceClient } from './auth'

export async function getBalance(userId) {
  const { data } = await getServiceClient()
    .from('credit_accounts').select('balance').eq('user_id', userId).maybeSingle()
  return data?.balance || 0
}

export async function getRecentLedger(userId, limit = 20) {
  const { data } = await getServiceClient()
    .from('credit_ledger').select('entry_type, delta, balance_after, note, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  return data || []
}

// Returns the new balance, or null if refused (would overdraw / already applied).
export async function applyCredit(userId, delta, entryType, reference = null, note = null) {
  const { data, error } = await getServiceClient().rpc('apply_credit_entry', {
    p_user_id: userId, p_delta: delta, p_entry_type: entryType, p_reference: reference, p_note: note,
  })
  if (error) throw new Error(`credit entry failed: ${error.message}`)
  return data ?? null
}

// Credit packs are configured, not hard-coded, so prices can be set without a
// code change (decision D1). Format of CREDIT_PACKS (JSON):
//   [{"id":"starter","credits":50,"price_id":"price_..."}]
// While unset, credit purchases are unavailable.
export function creditPacks() {
  try {
    const packs = JSON.parse(process.env.CREDIT_PACKS || '[]')
    return Array.isArray(packs)
      ? packs.filter((p) => p && typeof p.id === 'string' && Number.isInteger(p.credits) && p.credits > 0 && typeof p.price_id === 'string')
      : []
  } catch {
    return []
  }
}

export function findPack(packId) {
  return creditPacks().find((p) => p.id === packId) || null
}
