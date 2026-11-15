import { getServiceClient } from './auth'

// Monthly free-tier quotas: the same numbers already defined in the database
// function check_usage_limit() (supabase-schema.sql), which no route ever called.
export const FREE_LIMITS = { scripts: 5, ideas: 5, captions: 3 }
const COLUMN = { scripts: 'scripts_count', ideas: 'ideas_count', captions: 'captions_count' }

// Enforcement is OFF unless USAGE_LIMITS_ENFORCED=true. While off, usage is
// still counted so the impact on free users can be reviewed before switching
// it on. Pro users are never limited.
export const isEnforced = () => process.env.USAGE_LIMITS_ENFORCED === 'true'

const currentMonth = () => new Date().toISOString().slice(0, 7) // 'YYYY-MM'

// Returns true if the request may proceed; otherwise sends HTTP 402 and
// returns false. Fails OPEN on database errors so a usage-table problem can
// never block content generation.
export async function checkUsage(res, userId, type) {
  if (!isEnforced()) return true
  try {
    const supabase = getServiceClient()
    const { data: user } = await supabase.from('users').select('subscription_tier').eq('id', userId).single()
    if (user?.subscription_tier === 'pro') return true
    const { data: row } = await supabase
      .from('usage').select('*').eq('user_id', userId).eq('month', currentMonth()).maybeSingle()
    const used = row?.[COLUMN[type]] || 0
    if (used >= FREE_LIMITS[type]) {
      res.status(402).json({
        error: `You've used all ${FREE_LIMITS[type]} free ${type} for this month. Upgrade to Pro for unlimited access.`,
        upgrade_url: '/settings/billing',
      })
      return false
    }
    return true
  } catch (err) {
    console.error('Usage check failed (allowing request):', err)
    return true
  }
}

// Records one successful generation. Never throws.
export async function recordUsage(userId, type) {
  try {
    const supabase = getServiceClient()
    const month = currentMonth()
    const col = COLUMN[type]
    const { data: row } = await supabase
      .from('usage').select('*').eq('user_id', userId).eq('month', month).maybeSingle()
    if (row) {
      await supabase.from('usage').update({ [col]: (row[col] || 0) + 1 }).eq('id', row.id)
    } else {
      await supabase.from('usage').insert({ user_id: userId, month, [col]: 1 })
    }
  } catch (err) {
    console.error('Usage record failed (non-blocking):', err)
  }
}
