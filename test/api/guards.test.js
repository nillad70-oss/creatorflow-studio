// USAGE LIMITS + RATE LIMITING TESTS
import { describe, it, expect, afterEach } from 'vitest'
import { state } from '../helpers/fakeSupabase'
import { ai } from '../helpers/setup'
import { call, seedUsers, USER_A, USER_B, TOKEN_A, TOKEN_B } from '../helpers/call'
import generateScript from '../../pages/api/generate-script'
import generateCaptions from '../../pages/api/generate-captions'
import enhanceStory from '../../pages/api/enhance-story'

const month = new Date().toISOString().slice(0, 7)
afterEach(() => { delete process.env.USAGE_LIMITS_ENFORCED })

describe('Free-tier usage limits', () => {
  it('OFF by default: a free user over the limit is NOT blocked (entitlements preserved)', async () => {
    seedUsers()
    state.tables.usage = [{ id: 'u1', user_id: USER_B.id, month, scripts_count: 50 }]
    ai.reply = { hook: 'H', body: 'B' }
    const r = await call(generateScript, { token: TOKEN_B, body: { topic: 'x' } })
    expect(r.status).toBe(200)
  })
  it('usage is counted even while enforcement is off', async () => {
    seedUsers()
    ai.reply = { hook: 'H', body: 'B' }
    await call(generateScript, { token: TOKEN_B, body: { topic: 'x' } })
    await call(generateScript, { token: TOKEN_B, body: { topic: 'y' } })
    expect(state.tables.usage.find((u) => u.user_id === USER_B.id).scripts_count).toBe(2)
  })
  it('ON: free user at 5 scripts gets 402 and no AI call is made', async () => {
    process.env.USAGE_LIMITS_ENFORCED = 'true'
    seedUsers()
    state.tables.usage = [{ id: 'u1', user_id: USER_B.id, month, scripts_count: 5 }]
    const r = await call(generateScript, { token: TOKEN_B, body: { topic: 'x' } })
    expect(r.status).toBe(402)
    expect(ai.calls).toHaveLength(0)
  })
  it('ON: free user under the limit can still generate', async () => {
    process.env.USAGE_LIMITS_ENFORCED = 'true'
    seedUsers()
    state.tables.usage = [{ id: 'u1', user_id: USER_B.id, month, captions_count: 2 }]
    ai.reply = { caption: 'c' }
    const r = await call(generateCaptions, { token: TOKEN_B, body: { script: 's' } })
    expect(r.status).toBe(200)
  })
  it('ON: Pro users are never limited', async () => {
    process.env.USAGE_LIMITS_ENFORCED = 'true'
    seedUsers()
    state.tables.usage = [{ id: 'u1', user_id: USER_A.id, month, scripts_count: 500 }]
    ai.reply = { hook: 'H', body: 'B' }
    const r = await call(generateScript, { token: TOKEN_A, body: { topic: 'x' } })
    expect(r.status).toBe(200)
  })
})

describe('Rate limiting and input validation', () => {
  it('story enhancement is limited to 5 per minute per user', async () => {
    seedUsers()
    state.tables.story_profiles = [{ id: 'story-a', user_id: USER_A.id, story_beats: {} }]
    const codes = []
    for (let i = 0; i < 6; i++) codes.push((await call(enhanceStory, { token: TOKEN_A, body: { story_id: 'story-a' } })).status)
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true)
    expect(codes[5]).toBe(429)
  })
  it('one user hitting the limit does not affect another user', async () => {
    seedUsers()
    state.tables.story_profiles = [{ id: 'story-a', user_id: USER_A.id, story_beats: {} }, { id: 'story-b', user_id: USER_B.id, story_beats: {} }]
    for (let i = 0; i < 6; i++) await call(enhanceStory, { token: TOKEN_A, body: { story_id: 'story-a' } })
    const r = await call(enhanceStory, { token: TOKEN_B, body: { story_id: 'story-b' } })
    expect(r.status).toBe(200)
  })
  it('oversized prompt fields are rejected before reaching the AI', async () => {
    seedUsers()
    const r = await call(generateScript, { token: TOKEN_A, body: { topic: 'x'.repeat(5000) } })
    expect(r.status).toBe(400)
    expect(ai.calls).toHaveLength(0)
  })
})
