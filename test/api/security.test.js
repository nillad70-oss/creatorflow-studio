// SECURITY TESTS — Phase 0 acceptance criteria.
// 1. Unauthenticated requests to protected routes return 401.
// 2. A signed-in user cannot act as, or reach the data of, another user.
// 3. Client-supplied user_id is never trusted as identity.
// 4. Stripe identity comes from the verified session; webhook signatures enforced.
import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'
import { state } from '../helpers/fakeSupabase'
import { ai, stripeCalls } from '../helpers/setup'
import { call, seedUsers, USER_A, USER_B, TOKEN_A, TOKEN_B } from '../helpers/call'

import generateIdeas from '../../pages/api/generate-ideas'
import generateScript from '../../pages/api/generate-script'
import generateCaptions from '../../pages/api/generate-captions'
import generateAdcopy from '../../pages/api/generate-adcopy'
import enhanceStory from '../../pages/api/enhance-story'
import intentEngine from '../../pages/api/intent-engine'
import sessionRefine from '../../pages/api/session-refine'
import uploadAsset from '../../pages/api/upload-asset'
import analyzeAsset from '../../pages/api/analyze-asset'
import checkoutSignup from '../../pages/api/stripe/checkout-signup'
import checkout from '../../pages/api/stripe/checkout/index'
import webhook from '../../pages/api/stripe/webhook'

const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')

const PROTECTED = [
  ['generate-ideas', generateIdeas, { niche: 'x' }],
  ['generate-script', generateScript, { topic: 'x' }],
  ['generate-captions', generateCaptions, { script: 'x' }],
  ['generate-adcopy', generateAdcopy, { topic: 'x' }],
  ['enhance-story', enhanceStory, { story_id: 'story-1' }],
  ['intent-engine', intentEngine, { comment_text: 'x' }],
  ['session-refine', sessionRefine, { session_id: 's', feedback_message: 'x' }],
  ['analyze-asset', analyzeAsset, { asset_id: 'a' }],
]

describe('1. Unauthenticated requests are rejected with 401 and cost nothing', () => {
  for (const [name, handler, body] of PROTECTED) {
    it(`${name}: no token -> 401, no AI call`, async () => {
      seedUsers()
      const r = await call(handler, { body: { ...body, user_id: USER_A.id } })
      expect(r.status).toBe(401)
      expect(ai.calls).toHaveLength(0)
    })
    it(`${name}: invalid token -> 401`, async () => {
      seedUsers()
      const r = await call(handler, { token: 'forged-token', body: { ...body, user_id: USER_A.id } })
      expect(r.status).toBe(401)
    })
  }
  it('upload-asset: no token -> 401, nothing stored', async () => {
    seedUsers()
    const r = await call(uploadAsset, { rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: JPEG_B64, mime_type: 'image/jpeg' }) })
    expect(r.status).toBe(401)
    expect(state.storage['user-assets']).toBeUndefined()
  })
})

describe('2. Client-supplied user_id is ignored; identity comes from the token', () => {
  it('free user B cannot pass the Pro check by sending Pro user A\'s id (upload)', async () => {
    seedUsers()
    const r = await call(uploadAsset, {
      token: TOKEN_B,
      rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: JPEG_B64, mime_type: 'image/jpeg', file_size_bytes: 6 }),
    })
    expect(r.status).toBe(403)
    expect(Object.keys(state.storage['user-assets'] || {})).toHaveLength(0)
  })
  it('free user B cannot use refinement by sending Pro user A\'s id', async () => {
    seedUsers()
    state.tables.creative_sessions = [{ id: 'sess-a', user_id: USER_A.id, session_type: 'script', context_snapshot: {} }]
    const r = await call(sessionRefine, { token: TOKEN_B, body: { session_id: 'sess-a', user_id: USER_A.id, feedback_message: 'x' } })
    expect(r.status).toBe(403)
    expect(ai.calls).toHaveLength(0)
  })
  it('user B cannot pull user A\'s private story into a generation', async () => {
    seedUsers()
    state.rpc.get_current_story = ({ p_user_id }) => (p_user_id === USER_A.id
      ? [{ id: 's', story_beats: { origin: { enhanced_narrative: 'A-SECRET-STORY' } } }] : [])
    ai.reply = { title: 'T', hook: 'H', body: 'B', cta: 'C' }
    await call(generateScript, { token: TOKEN_B, body: { topic: 'x', user_id: USER_A.id } })
    expect(ai.calls[0].system).not.toContain('A-SECRET-STORY')
  })
  it('sessions are recorded under the token owner, not the body user_id', async () => {
    seedUsers()
    ai.reply = { variants: [], description: 'd' }
    await call(generateAdcopy, { token: TOKEN_B, body: { topic: 'x', user_id: USER_A.id } })
    expect(state.tables.creative_sessions[0].user_id).toBe(USER_B.id)
  })
  it('comment logs are recorded under the token owner', async () => {
    seedUsers()
    ai.reply = { classified_intent: 'curiosity', confidence: 0.9, reply_text: 'hi', needs_human_reply: false }
    await call(intentEngine, { token: TOKEN_B, body: { user_id: USER_A.id, comment_text: 'hi' } })
    expect(state.tables.comment_intent_log[0].user_id).toBe(USER_B.id)
  })
})

describe('3. Users cannot reach each other\'s resources', () => {
  it('enhance-story: user B cannot enhance (or overwrite) user A\'s story', async () => {
    seedUsers()
    state.tables.story_profiles = [{ id: 'story-a', user_id: USER_A.id, story_beats: { origin: { raw_answer: 'mine' } } }]
    ai.reply = { enhanced_narrative: 'HIJACKED', derived_assets: {}, income_figure_present: false }
    const r = await call(enhanceStory, { token: TOKEN_B, body: { story_id: 'story-a' } })
    expect(r.status).toBe(404)
    expect(state.tables.story_profiles[0].story_beats.origin.enhanced_narrative).toBeUndefined()
  })
  it('analyze-asset: user B cannot analyze user A\'s image', async () => {
    seedUsers({ bTier: 'pro' })
    state.tables.assets = [{ id: 'asset-a', user_id: USER_A.id, storage_path: `${USER_A.id}/x.jpg`, mime_type: 'image/jpeg' }]
    const r = await call(analyzeAsset, { token: TOKEN_B, body: { asset_id: 'asset-a', user_id: USER_A.id } })
    expect(r.status).toBe(404)
  })
  it('session-refine: Pro user B cannot read or extend user A\'s session', async () => {
    seedUsers({ bTier: 'pro' })
    state.tables.creative_sessions = [{ id: 'sess-a', user_id: USER_A.id, session_type: 'script', context_snapshot: {} }]
    const r = await call(sessionRefine, { token: TOKEN_B, body: { session_id: 'sess-a', user_id: USER_A.id, feedback_message: 'x' } })
    expect(r.status).toBe(404)
  })
  it('generate-adcopy: user B cannot attach user A\'s analyzed images', async () => {
    seedUsers()
    state.tables.assets = [{ id: 'asset-a', user_id: USER_A.id, ai_analysis: { description: 'A-PRIVATE-PHOTO', mood: 'x' } }]
    ai.reply = { variants: [], description: 'd' }
    await call(generateAdcopy, { token: TOKEN_B, body: { topic: 'x', asset_ids: ['asset-a'], user_id: USER_A.id } })
    expect(ai.calls[0].system).not.toContain('A-PRIVATE-PHOTO')
  })
})

describe('4. Upload validation does not trust the client', () => {
  it('rejects a file whose real size exceeds 5 MB even if the client claims it is small', async () => {
    seedUsers()
    const big = Buffer.alloc(5 * 1024 * 1024 + 10, 0)
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff
    const r = await call(uploadAsset, {
      token: TOKEN_A,
      rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: big.toString('base64'), mime_type: 'image/jpeg', file_size_bytes: 10 }),
    })
    expect(r.status).toBe(400)
  })
  it('rejects a non-image file disguised with an image MIME type', async () => {
    seedUsers()
    const r = await call(uploadAsset, {
      token: TOKEN_A,
      rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: Buffer.from('<html>evil</html>').toString('base64'), mime_type: 'image/png', file_size_bytes: 17 }),
    })
    expect(r.status).toBe(400)
  })
  it('records the real byte size, not the client-claimed size', async () => {
    seedUsers()
    const r = await call(uploadAsset, {
      token: TOKEN_A,
      rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: JPEG_B64, mime_type: 'image/jpeg', file_size_bytes: 999 }),
    })
    expect(r.status).toBe(200)
    expect(r.json.asset.file_size_bytes).toBe(6)
  })
})

describe('5. Stripe identity and webhook integrity', () => {
  it('checkout-signup: refuses to create checkout without a verified session', async () => {
    seedUsers()
    const r = await call(checkoutSignup, { method: 'POST', body: { priceId: 'price_monthly_test' } })
    expect(r.status).toBe(401)
    expect(stripeCalls.checkout).toHaveLength(0)
  })
  it('checkout-signup: metadata userId comes from the token, never the request', async () => {
    seedUsers()
    const r = await call(checkoutSignup, { method: 'POST', token: TOKEN_B, body: { userId: USER_A.id, email: 'a@test.dev' } })
    expect(r.status).toBe(200)
    expect(stripeCalls.checkout[0].metadata.userId).toBe(USER_B.id)
    expect(stripeCalls.checkout[0].customer_email).toBe(USER_B.email)
  })
  it('checkout: rejects price IDs that are not NillaFlow plans', async () => {
    seedUsers()
    const r = await call(checkout, { token: TOKEN_A, body: { priceId: 'price_attacker_1cent' } })
    expect(r.status).toBe(400)
    expect(stripeCalls.checkout).toHaveLength(0)
  })
  it('webhook: rejects an event with a bad signature', async () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } })
    const r = await call(webhook, { rawBody: payload, headers: { 'stripe-signature': 't=1,v1=bad' } })
    expect(r.status).toBe(400)
  })
  it('webhook: accepts a correctly signed event', async () => {
    seedUsers()
    const payload = JSON.stringify({ id: 'evt_2', type: 'checkout.session.completed',
      data: { object: { customer: 'cus_b', subscription: 'sub_b', metadata: { userId: USER_B.id } } } })
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET })
    const r = await call(webhook, { rawBody: payload, headers: { 'stripe-signature': sig } })
    expect(r.status).toBe(200)
    expect(state.tables.users.find((u) => u.id === USER_B.id).subscription_tier).toBe('pro')
  })
})
