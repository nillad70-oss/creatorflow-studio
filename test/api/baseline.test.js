// BASELINE REGRESSION TESTS — prove the existing workflows keep working.
// Every request is sent the way a signed-in user's browser sends it after
// Phase 0: a Bearer token PLUS the legacy user_id in the body. These tests were
// run against the original code (commit 723a28f) before any change was made.
import { describe, it, expect } from 'vitest'
import { state } from '../helpers/fakeSupabase'
import { ai, stripeCalls } from '../helpers/setup'
import { call, seedUsers, USER_A, TOKEN_A } from '../helpers/call'

import generateIdeas from '../../pages/api/generate-ideas'
import generateScript from '../../pages/api/generate-script'
import generateCaptions from '../../pages/api/generate-captions'
import generateAdcopy from '../../pages/api/generate-adcopy'
import enhanceStory from '../../pages/api/enhance-story'
import intentEngine from '../../pages/api/intent-engine'
import sessionRefine from '../../pages/api/session-refine'
import uploadAsset from '../../pages/api/upload-asset'
import analyzeAsset from '../../pages/api/analyze-asset'
import checkout from '../../pages/api/stripe/checkout/index'

const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')

function seedStory(userId = USER_A.id) {
  const story = {
    id: 'story-1', user_id: userId, version: 1, goal_type: 'income', voice_track: 'personal',
    story_beats: { origin: { raw_answer: 'I was a nurse for 20 years', enhanced_narrative: 'I spent two decades at the bedside.' } },
    compliance_flags: {},
  }
  state.tables.story_profiles = [story]
  state.rpc.get_current_story = ({ p_user_id }) => (p_user_id === userId ? [story] : [])
  return story
}

describe('AI Idea Generator & content calendar', () => {
  it('returns a calendar for a valid request', async () => {
    seedUsers()
    ai.reply = { competitors: [{ name: 'X' }], days: [{ day: 1, title: 'T' }], strategy: {} }
    const r = await call(generateIdeas, { token: TOKEN_A, body: { niche: 'Nursing & Healthcare', audience: 'nurses', days: 7, user_id: USER_A.id } })
    expect(r.status).toBe(200)
    expect(r.json.mode).toBe('calendar')
    expect(r.json.calendar.days).toHaveLength(1)
  })
  it('rejects non-POST', async () => {
    const r = await call(generateIdeas, { method: 'GET', token: TOKEN_A })
    expect(r.status).toBe(405)
  })
})

describe('Script Generator', () => {
  it('generates a script and opens a refinement session', async () => {
    seedUsers()
    ai.reply = { title: 'T', hook: 'H', body: 'B', cta: 'C', hashtags: ['#a'] }
    const r = await call(generateScript, { token: TOKEN_A, body: { topic: 'burnout', user_id: USER_A.id } })
    expect(r.status).toBe(200)
    expect(r.json.script.hook).toBe('H')
    expect(r.json.session_id).toBeTruthy()
    expect(state.tables.creative_sessions[0].user_id).toBe(USER_A.id)
  })
  it('includes the creator story in the prompt when one exists', async () => {
    seedUsers(); seedStory()
    ai.reply = { title: 'T', hook: 'H', body: 'B', cta: 'C' }
    await call(generateScript, { token: TOKEN_A, body: { topic: 'burnout', user_id: USER_A.id } })
    expect(ai.calls[0].system).toContain('two decades at the bedside')
  })
})

describe('Caption Generator', () => {
  it('generates a caption', async () => {
    seedUsers()
    ai.reply = { caption: 'Cap', hashtags: ['#a'] }
    const r = await call(generateCaptions, { token: TOKEN_A, body: { script: 'some script', style: 'engaging', user_id: USER_A.id } })
    expect(r.status).toBe(200)
    expect(JSON.stringify(r.json)).toContain('Cap')
  })
  it('requires a script', async () => {
    seedUsers()
    const r = await call(generateCaptions, { token: TOKEN_A, body: { user_id: USER_A.id } })
    expect(r.status).toBe(400)
  })
})

describe('Ad Copy Generator', () => {
  it('generates 3 variants and enforces the 200-character primary text cap', async () => {
    seedUsers()
    const long = 'x'.repeat(260)
    ai.reply = { variants: [
      { hook_mechanic: 'contradiction', video_hook: 'h1', primary_text: long, headline: 'a' },
      { hook_mechanic: 'cold-open', video_hook: 'h2', primary_text: 'short', headline: 'b' },
      { hook_mechanic: 'curiosity-gap', video_hook: 'h3', primary_text: 'short', headline: 'c' },
    ], description: 'd', recommended_pairing: 'p' }
    const r = await call(generateAdcopy, { token: TOKEN_A, body: { topic: 'freedom', user_id: USER_A.id } })
    expect(r.status).toBe(200)
    expect(r.json.variants).toHaveLength(3)
    expect(r.json.variants[0].primary_text.length).toBeLessThanOrEqual(200)
    expect(r.json.session_id).toBeTruthy()
  })
  it('requires a topic', async () => {
    seedUsers()
    const r = await call(generateAdcopy, { token: TOKEN_A, body: { user_id: USER_A.id } })
    expect(r.status).toBe(400)
  })
})

describe('Storytelling & Story Enhancement', () => {
  it('enhances the owner\'s story beats and sets compliance flags', async () => {
    seedUsers(); seedStory()
    ai.reply = { enhanced_narrative: 'New narrative', derived_assets: { hook_variants: ['a'] }, income_figure_present: false, auto_rewritten_to_system_attribution: false }
    const r = await call(enhanceStory, { token: TOKEN_A, body: { story_id: 'story-1' } })
    expect(r.status).toBe(200)
    expect(state.tables.story_profiles[0].story_beats.origin.enhanced_narrative).toBe('New narrative')
  })
})

describe('Comment Intent Engine', () => {
  it('classifies a comment and logs it', async () => {
    seedUsers()
    ai.reply = { classified_intent: 'curiosity', objection_type: null, confidence: 0.9, reply_text: 'Thanks!', needs_human_reply: false }
    const r = await call(intentEngine, { token: TOKEN_A, body: { user_id: USER_A.id, comment_text: 'How does this work?' } })
    expect(r.status).toBe(200)
    expect(r.json.reply_text).toBe('Thanks!')
    expect(state.tables.comment_intent_log[0].user_id).toBe(USER_A.id)
  })
})

describe('Image Asset Upload & Analysis', () => {
  it('lets a Pro user upload a JPEG into their own folder', async () => {
    seedUsers()
    const r = await call(uploadAsset, {
      token: TOKEN_A,
      rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: JPEG_B64, mime_type: 'image/jpeg', file_size_bytes: 6 }),
    })
    expect(r.status).toBe(200)
    expect(r.json.asset.storage_path.startsWith(`${USER_A.id}/`)).toBe(true)
  })
  it('blocks free users from uploading', async () => {
    seedUsers({ aTier: 'free' })
    const r = await call(uploadAsset, {
      token: TOKEN_A,
      rawBody: JSON.stringify({ user_id: USER_A.id, file_base64: JPEG_B64, mime_type: 'image/jpeg', file_size_bytes: 6 }),
    })
    expect(r.status).toBe(403)
  })
  it('analyzes an owned asset with vision and caches the result', async () => {
    seedUsers()
    state.tables.assets = [{ id: 'asset-1', user_id: USER_A.id, storage_path: `${USER_A.id}/x.jpg`, mime_type: 'image/jpeg', ai_analysis: null }]
    ai.reply = { description: 'A nurse in a garden', subject: 'nurse', mood: 'calm', notable_details: ['flowers'] }
    const r = await call(analyzeAsset, { token: TOKEN_A, body: { asset_id: 'asset-1', user_id: USER_A.id } })
    expect(r.status).toBe(200)
    expect(r.json.cached).toBe(false)
    const again = await call(analyzeAsset, { token: TOKEN_A, body: { asset_id: 'asset-1', user_id: USER_A.id } })
    expect(again.json.cached).toBe(true)
    expect(ai.calls).toHaveLength(1)
  })
})

describe('Conversational Refinement', () => {
  it('revises the owner\'s session for a Pro user', async () => {
    seedUsers()
    state.tables.creative_sessions = [{ id: 'sess-1', user_id: USER_A.id, session_type: 'script', context_snapshot: { topic: 'burnout' } }]
    state.tables.session_messages = [
      { session_id: 'sess-1', role: 'user', content: 'Generate', created_at: '1' },
      { session_id: 'sess-1', role: 'assistant', content: '{"hook":"old"}', created_at: '2' },
    ]
    ai.reply = { title: 'T', hook: 'new hook', body: 'B', cta: 'C' }
    const r = await call(sessionRefine, { token: TOKEN_A, body: { session_id: 'sess-1', user_id: USER_A.id, feedback_message: 'punchier' } })
    expect(r.status).toBe(200)
    expect(r.json.hook).toBe('new hook')
    expect(state.tables.session_messages).toHaveLength(4)
  })
})

describe('Subscription Checkout', () => {
  it('creates a Stripe checkout session for a signed-in user', async () => {
    seedUsers()
    const r = await call(checkout, { token: TOKEN_A, body: { priceId: 'price_monthly_test' } })
    expect(r.status).toBe(200)
    expect(r.json.url).toContain('checkout.stripe.test')
    expect(stripeCalls.checkout[0].metadata.userId).toBe(USER_A.id)
    expect(stripeCalls.checkout[0].subscription_data.trial_period_days).toBe(3)
  })
  it('rejects a request with no session', async () => {
    const r = await call(checkout, { body: { priceId: 'price_monthly_test' } })
    expect(r.status).toBe(401)
  })
})
