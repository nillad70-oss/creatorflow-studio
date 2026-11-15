// AI TWIN PHASE 1 TESTS — consent, photo screening, status, deletion, credits.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Stripe from 'stripe'
import { state } from '../helpers/fakeSupabase'
import { ai, stripeCalls } from '../helpers/setup'
import { call, seedUsers, USER_A, USER_B, TOKEN_A, TOKEN_B } from '../helpers/call'
import consent from '../../pages/api/twin/consent'
import recording from '../../pages/api/twin/recording'
import reference from '../../pages/api/twin/reference'
import twin from '../../pages/api/twin/index'
import credits from '../../pages/api/credits/index'
import webhook from '../../pages/api/stripe/webhook'
import { CONSENT_VERSION } from '../../lib/server/twin'
import { decideScreening } from '../../lib/server/screenPhoto'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1])
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const GOOD = { people_count: 1, face_clearly_visible: true, appears_adult: true, explicit_or_nude: false, image_quality: 'good', issues: [] }
const CONSENT_BODY = { scopes: ['professional'], attest_self: true, attest_adult: true, consent_version: CONSENT_VERSION, recording_mime_type: 'video/webm' }

// In-memory version of the database credit function (same rules as the SQL one).
function installCreditFunction() {
  state.rpc.apply_credit_entry = ({ p_user_id, p_delta, p_entry_type, p_reference, p_note }) => {
    state.tables.credit_ledger = state.tables.credit_ledger || []
    state.tables.credit_accounts = state.tables.credit_accounts || []
    if (p_reference && state.tables.credit_ledger.some((l) => l.entry_type === p_entry_type && l.reference === p_reference)) return null
    let acct = state.tables.credit_accounts.find((a) => a.user_id === p_user_id)
    if (!acct) { acct = { user_id: p_user_id, balance: 0 }; state.tables.credit_accounts.push(acct) }
    if (acct.balance + p_delta < 0) return null
    acct.balance += p_delta
    state.tables.credit_ledger.push({ user_id: p_user_id, entry_type: p_entry_type, delta: p_delta, balance_after: acct.balance, reference: p_reference, note: p_note, created_at: new Date().toISOString() })
    return acct.balance
  }
}

async function consentAndRecord(token = TOKEN_A, userId = USER_A.id) {
  const c = await call(consent, { token, body: CONSENT_BODY })
  const path = c.json.recording_upload.path
  state.storage['twin-references'] = state.storage['twin-references'] || {}
  state.storage['twin-references'][path] = WEBM
  const r = await call(recording, { token, body: { path } })
  return { c, r, twinId: c.json.twin_id }
}

async function uploadPhoto(token = TOKEN_A) {
  const u = await call(reference, { token, body: { action: 'upload-url', mime_type: 'image/jpeg' } })
  state.storage['twin-references'][u.json.path] = JPEG
  return call(reference, { token, body: { action: 'finalize', path: u.json.path } })
}

beforeEach(() => { process.env.AI_TWIN_ENABLED = 'true'; installCreditFunction(); ai.reply = GOOD })
afterEach(() => { delete process.env.AI_TWIN_ENABLED; delete process.env.CREDIT_PACKS })

describe('Feature switch and access', () => {
  it('all AI Twin routes are hidden (404) until AI_TWIN_ENABLED=true', async () => {
    delete process.env.AI_TWIN_ENABLED
    seedUsers()
    for (const h of [consent, recording, reference, twin, credits]) {
      const r = await call(h, { token: TOKEN_A, method: h === twin || h === credits ? 'GET' : 'POST', body: {} })
      expect(r.status).toBe(404)
    }
  })
  it('requires a login', async () => {
    seedUsers()
    expect((await call(consent, { body: CONSENT_BODY })).status).toBe(401)
    expect((await call(twin, { method: 'GET' })).status).toBe(401)
  })
  it('is Pro-only (decision D2)', async () => {
    seedUsers()
    const r = await call(consent, { token: TOKEN_B, body: CONSENT_BODY })
    expect(r.status).toBe(403)
  })
})

describe('Consent', () => {
  it('records scoped, attested, versioned consent and issues a recording upload link', async () => {
    seedUsers()
    const r = await call(consent, { token: TOKEN_A, body: CONSENT_BODY, headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'test' } })
    expect(r.status).toBe(200)
    expect(r.json.recording_upload.path.startsWith(`${USER_A.id}/`)).toBe(true)
    const rec = state.tables.consent_records[0]
    expect(rec).toMatchObject({ user_id: USER_A.id, consent_version: CONSENT_VERSION, scopes: ['professional'], attest_self: true, attest_adult: true, ip_address: '1.2.3.4' })
    expect(state.tables.audit_log.some((a) => a.action === 'twin.consent.signed')).toBe(true)
  })
  it('rejects missing attestations, unknown uses and outdated consent text', async () => {
    seedUsers()
    expect((await call(consent, { token: TOKEN_A, body: { ...CONSENT_BODY, attest_adult: false } })).status).toBe(400)
    expect((await call(consent, { token: TOKEN_A, body: { ...CONSENT_BODY, scopes: ['anything'] } })).status).toBe(400)
    expect((await call(consent, { token: TOKEN_A, body: { ...CONSENT_BODY, consent_version: 'old' } })).status).toBe(409)
  })
  it('accepts the on-camera recording only from the caller\'s own folder', async () => {
    seedUsers({ bTier: 'pro' })
    const { r } = await consentAndRecord()
    expect(r.status).toBe(200)
    expect(r.json.status).toBe('consented')
    const b = await call(consent, { token: TOKEN_B, body: CONSENT_BODY })
    const aPath = state.tables.consent_records[0].recording_path
    const steal = await call(recording, { token: TOKEN_B, body: { path: aPath } })
    expect(steal.status).toBe(400)
    expect(b.status).toBe(200)
  })
  it('rejects a "recording" that is not actually a video', async () => {
    seedUsers()
    const c = await call(consent, { token: TOKEN_A, body: CONSENT_BODY })
    state.storage['twin-references'] = { [c.json.recording_upload.path]: Buffer.from('not a video at all!!') }
    const r = await call(recording, { token: TOKEN_A, body: { path: c.json.recording_upload.path } })
    expect(r.status).toBe(400)
    expect(state.storage['twin-references'][c.json.recording_upload.path]).toBeUndefined()
  })
})

describe('Reference photos', () => {
  it('cannot upload photos before consent + recording', async () => {
    seedUsers()
    await call(consent, { token: TOKEN_A, body: CONSENT_BODY })
    const r = await call(reference, { token: TOKEN_A, body: { action: 'upload-url', mime_type: 'image/jpeg' } })
    expect(r.status).toBe(409)
  })
  it('accepts a good photo and becomes ready at 5 photos', async () => {
    seedUsers()
    await consentAndRecord()
    let last
    for (let i = 0; i < 5; i++) last = await uploadPhoto()
    expect(last.json).toMatchObject({ accepted: true, total: 5, ready: true })
    expect(state.tables.twin_profiles[0].status).toBe('ready')
  })
  it('rejects a photo that fails screening, explains why, and deletes the file', async () => {
    seedUsers()
    await consentAndRecord()
    ai.reply = { ...GOOD, people_count: 2 }
    const r = await uploadPhoto()
    expect(r.json.accepted).toBe(false)
    expect(r.json.reasons[0]).toMatch(/exactly one person/)
    expect(Object.keys(state.storage['twin-references']).filter((p) => p.includes('/ref-'))).toHaveLength(0)
  })
  it('screening rules: minors, explicit content and poor quality are rejected', () => {
    expect(decideScreening({ ...GOOD, appears_adult: false }).accepted).toBe(false)
    expect(decideScreening({ ...GOOD, explicit_or_nude: true }).accepted).toBe(false)
    expect(decideScreening({ ...GOOD, image_quality: 'poor' }).accepted).toBe(false)
    expect(decideScreening(GOOD).accepted).toBe(true)
  })
  it('rejects non-image files disguised as photos', async () => {
    seedUsers()
    await consentAndRecord()
    const u = await call(reference, { token: TOKEN_A, body: { action: 'upload-url', mime_type: 'image/jpeg' } })
    state.storage['twin-references'][u.json.path] = Buffer.from('<script>alert(1)</script>')
    const r = await call(reference, { token: TOKEN_A, body: { action: 'finalize', path: u.json.path } })
    expect(r.status).toBe(400)
    expect(ai.calls).toHaveLength(0)
  })
  it('stops at 10 photos', async () => {
    seedUsers()
    await consentAndRecord()
    for (let i = 0; i < 10; i++) await uploadPhoto()
    const r = await call(reference, { token: TOKEN_A, body: { action: 'upload-url', mime_type: 'image/jpeg' } })
    expect(r.status).toBe(400)
  })
  it('a user cannot delete another user\'s photo', async () => {
    seedUsers({ bTier: 'pro' })
    await consentAndRecord()
    const p = await uploadPhoto()
    await call(consent, { token: TOKEN_B, body: CONSENT_BODY })
    const r = await call(reference, { method: 'DELETE', token: TOKEN_B, body: { id: p.json.id } })
    expect(r.status).toBe(404)
    expect(state.tables.twin_reference_images).toHaveLength(1)
  })
})

describe('Status and full deletion', () => {
  it('status shows consent, photos (short-lived links) and credits', async () => {
    seedUsers()
    await consentAndRecord()
    await uploadPhoto()
    const r = await call(twin, { token: TOKEN_A, method: 'GET' })
    expect(r.status).toBe(200)
    expect(r.json.consent).toMatchObject({ scopes: ['professional'], recording_on_file: true })
    expect(r.json.photos).toHaveLength(1)
    expect(r.json.photos[0].preview_url).toContain('signed.test')
  })
  it('delete removes every file and record, keeps purchased credits, and issues a receipt', async () => {
    seedUsers()
    await consentAndRecord()
    await uploadPhoto(); await uploadPhoto()
    state.rpc.apply_credit_entry({ p_user_id: USER_A.id, p_delta: 50, p_entry_type: 'purchase', p_reference: 'cs_1' })
    // The real database cascades; mirror that in the in-memory fake.
    const r = await call(twin, { token: TOKEN_A, method: 'DELETE' })
    expect(r.status).toBe(200)
    expect(r.json.deleted).toBe(true)
    expect(r.json.files_removed).toBe(3) // 2 photos + consent recording
    expect(Object.keys(state.storage['twin-references'])).toHaveLength(0)
    expect(state.tables.twin_profiles).toHaveLength(0)
    expect(state.tables.deletion_requests[0]).toMatchObject({ user_id: USER_A.id, status: 'completed', files_removed: 3 })
    expect(state.tables.credit_accounts[0].balance).toBe(50)
  })
})

describe('Credits', () => {
  const PACKS = JSON.stringify([{ id: 'starter', credits: 50, price_id: 'price_pack_test' }])
  function signed(object) {
    const payload = JSON.stringify({ id: 'evt_pack', type: 'checkout.session.completed', data: { object } })
    return { rawBody: payload, headers: { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET }) } }
  }

  it('packs are unavailable until prices are configured (decision D1)', async () => {
    seedUsers()
    const r = await call(credits, { token: TOKEN_A, body: { pack: 'starter' } })
    expect(r.status).toBe(400)
    expect(stripeCalls.checkout).toHaveLength(0)
  })
  it('starts a one-time Stripe checkout for a configured pack', async () => {
    process.env.CREDIT_PACKS = PACKS
    seedUsers()
    const r = await call(credits, { token: TOKEN_A, body: { pack: 'starter' } })
    expect(r.status).toBe(200)
    expect(stripeCalls.checkout[0]).toMatchObject({ mode: 'payment', metadata: { userId: USER_A.id, credit_pack: 'starter' } })
  })
  it('paid pack adds credits once, even if Stripe retries, and never changes the plan', async () => {
    process.env.CREDIT_PACKS = PACKS
    seedUsers()
    const session = { id: 'cs_pack_1', mode: 'payment', payment_status: 'paid', customer: 'cus_b', metadata: { userId: USER_B.id, credit_pack: 'starter', credits: '99999' } }
    expect((await call(webhook, signed(session))).status).toBe(200)
    expect((await call(webhook, signed(session))).status).toBe(200)
    expect(state.tables.credit_accounts.find((a) => a.user_id === USER_B.id).balance).toBe(50) // from config, not metadata
    expect(state.tables.users.find((u) => u.id === USER_B.id).subscription_tier).toBe('free')
  })
  it('unpaid pack checkout adds nothing', async () => {
    process.env.CREDIT_PACKS = PACKS
    seedUsers()
    await call(webhook, signed({ id: 'cs_pack_2', mode: 'payment', payment_status: 'unpaid', metadata: { userId: USER_B.id, credit_pack: 'starter' } }))
    expect(state.tables.credit_accounts?.find((a) => a.user_id === USER_B.id)?.balance || 0).toBe(0)
  })
  it('balance and activity are visible to the owner', async () => {
    seedUsers()
    state.rpc.apply_credit_entry({ p_user_id: USER_A.id, p_delta: 20, p_entry_type: 'grant', p_reference: 'welcome' })
    const r = await call(credits, { token: TOKEN_A, method: 'GET' })
    expect(r.json.balance).toBe(20)
    expect(r.json.activity).toHaveLength(1)
  })
})
