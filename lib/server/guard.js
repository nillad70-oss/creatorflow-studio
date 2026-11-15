// Request guards shared by the API routes: rate limiting and input validation.
//
// RATE LIMITING NOTE: this limiter keeps counts in memory, per server instance.
// On Vercel each warm function instance has its own counter, so this stops
// rapid-fire abuse from a single session but is NOT a global quota. A shared
// store (e.g. Upstash Redis) is the recommended follow-up before scaling paid
// AI features. The free-tier monthly quota lives in lib/server/usage.js.

const buckets = new Map()

export function rateLimit(req, res, { key, limit = 20, windowMs = 60_000 }) {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now - entry.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 })
    return true
  }
  entry.count += 1
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000)
    res.setHeader?.('Retry-After', String(retryAfter))
    res.status(429).json({ error: `Too many requests. Please wait ${retryAfter} seconds and try again.` })
    return false
  }
  return true
}

export function resetRateLimits() {
  buckets.clear()
}

// Light validation: rejects oversized free-text fields before they reach the
// AI provider (cost and prompt-abuse protection). Returns true when valid;
// otherwise sends HTTP 400 and returns false.
export function validateLengths(res, body, limits) {
  for (const [field, max] of Object.entries(limits)) {
    const value = body?.[field]
    if (value == null) continue
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (text.length > max) {
      res.status(400).json({ error: `${field} is too long (max ${max} characters).` })
      return false
    }
  }
  return true
}

export function isUuidLike(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[A-Za-z0-9-]+$/.test(value)
}
