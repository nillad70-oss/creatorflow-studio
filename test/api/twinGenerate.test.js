// AI TWIN PHASE 2 TESTS — creation pipeline, likeness gate, credits, webhook, gallery.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { state } from '../helpers/fakeSupabase'
import { call, seedUsers, USER_A, TOKEN_A, TOKEN_B } from '../helpers/call'
import generate from '../../pages/api/twin/generate'
import webhook from '../../pages/api/twin/provider-webhook'
import gallery from '../../pages/api/twin/gallery'
import twin from '../../pages/api/twin/index'
import { CONSENT_VERSION } from '../../lib/server/twin'
import { _resetJwksCache } from '../../lib/server/fal'
import { buildPrompt, quickPromptCheck } from '../../lib/server/twinPrompt'
import { decideJudgement } from '../../lib/server/judgeImage'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)])
const PASS = { likeness: 91, likeness_issues: [], people_count: 1, appears_adult: true, explicit_or_nude: false, artifacts: false, quality: 88 }
const MISS = { ...PASS, likeness: 55, likeness_issues: ['skin tone lighter than references'] }

let sim // simulated provider + Claude
function installNetwork() {
  sim = { submitted: [], judge: [], review: { allowed: true, reason: '' }, falDone: true, jwks: [] }
  let n = 0
  global.fetch = async (url, init = {}) => {
    const u = String(url)
    if (u.startsWith('https://queue.fal.run/') && init.method === 'POST' && !u.includes('/requests/')) {
      const id = `req_${++n}`
      sim.submitted.push({ url: u, input: JSON.parse(init.body), id })
      return { ok: true, json: async () => ({ request_id: id, status_url: `https://queue.fal.run/x/requests/${id}/status`, response_url: `https://queue.fal.run/x/requests/${id}` }) }
    }
    if (u.includes('/requests/') && u.endsWith('/status')) return { ok: true, json: async () => ({ status: sim.falDone ? 'COMPLETED' : 'IN_PROGRESS' }) }
    if (u.includes('/requests/')) {
      const id = u.split('/').pop()
      return { ok: true, json: async () => ({ images: [{ url: `https://fal.media/out/${id}.png` }] }) }
    }
    if (u.startsWith('https://fal.media/')) return { ok: true, arrayBuffer: async () => PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length) }
    if (u === 'https://rest.fal.ai/.well-known/jwks.json') return { ok: true, json: async () => ({ keys: sim.jwks }) }
    if (u.startsWith('https://api.anthropic.com')) {
      const body = JSON.parse(init.body)
      const text = JSON.stringify(body.messages[0].content)
      const reply = text.includes('You review requests') ? sim.review : (sim.judge.shift() || MISS)
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) }
    }
    throw new Error(`Unexpected network call in test: ${u}`)
  }
}

function seedReadyTwin({ credits = 10, version = CONSENT_VERSION, scopes = ['professional'] } = {}) {
  seedUsers()
  const twinId = 'tttttttt-0000-4000-8000-000000000001'
  state.tables.twin_profiles = [{ id: twinId, user_id: USER_A.id, status: 'ready', created_at: '2026-11-01' }]
  state.tables.consent_records = [{ id: 'cccccccc-0000-4000-8000-000000000001', user_id: USER_A.id, twin_id: twinId, consent_version: version, scopes, attest_self: true, attest_adult: true, recording_path: `${USER_A.id}/${twinId}/consent-1.webm`, signed_at: '2026-11-01', revoked_at: null }]
  state.tables.twin_reference_images = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, user_id: USER_A.id, twin_id: twinId, storage_path: `${USER_A.id}/${twinId}/ref-${i}.jpg`, created_at: `2026-11-01T00:0${i}` }))
  state.storage['twin-references'] = Object.fromEntries(state.tables.twin_reference_images.map((r) => [r.storage_path, PNG]))
  state.storage['generated-media'] = {}
  state.tables.credit_accounts = [{ user_id: USER_A.id, balance: credits }]
  state.tables.credit_ledger = []
  state.rpc.apply_credit_entry = ({ p_user_id, p_delta, p_entry_type, p_reference, p_note }) => {
    if (p_reference && state.tables.credit_ledger.some((l) => l.entry_type === p_entry_type && l.reference === p_reference)) return null
    let acct = state.tables.credit_accounts.find((a) => a.user_id === p_user_id)
    if (!acct) { acct = { user_id: p_user_id, balance: 0 }; state.tables.credit_accounts.push(acct) }
    if (acct.balance + p_delta < 0) return null
    acct.balance += p_delta
    state.tables.credit_ledger.push({ user_id: p_user_id, entry_type: p_entry_type, delta: p_delta, reference: p_reference, note: p_note })
    return acct.balance
  }
  return twinId
}

const balance = () => state.tables.credit_accounts.find((a) => a.user_id === USER_A.id).balance
const start = (body = {}) => call(generate, { token: TOKEN_A, body: { style: 'headshot', mode: 'best', tier: 'standard', aspect: '4:5', ...body } })
const poll = (id) => call(generate, { token: TOKEN_A, method: 'GET', query: { id } })

beforeEach(() => {
  process.env.AI_TWIN_ENABLED = 'true'
  process.env.FAL_KEY = 'fal-test'
  delete process.env.NEXT_PUBLIC_APP_URL_OVERRIDE
  _resetJwksCache()
  installNetwork()
})
afterEach(() => { delete process.env.AI_TWIN_ENABLED; delete process.env.FAL_KEY })

describe('Starting a creation', () => {
  it('runs candidates on BOTH top engines with all reference photos', async () => {
    seedReadyTwin()
    const r = await start()
    expect(r.status).toBe(200)
    expect(sim.submitted).toHaveLength(4)
    expect(sim.submitted.filter((s) => s.url.includes('nano-banana-pro'))).toHaveLength(2)
    expect(sim.submitted.filter((s) => s.url.includes('gpt-image-2.5'))).toHaveLength(2)
    expect(sim.submitted[0].input.image_urls).toHaveLength(5)
    expect(sim.submitted[0].input.prompt).toMatch(/IDENTITY IS THE TOP PRIORITY/)
    expect(balance()).toBe(9) // 1 credit held
  })
  it('Ultra uses 4K and holds 2 credits', async () => {
    seedReadyTwin()
    await start({ tier: 'ultra', mode: 'studio-pro' })
    expect(sim.submitted).toHaveLength(3)
    expect(sim.submitted[0].input.resolution).toBe('4K')
    expect(balance()).toBe(8)
  })
  it('refuses without enough credits, and nothing is submitted', async () => {
    seedReadyTwin({ credits: 0 })
    const r = await start()
    expect(r.status).toBe(402)
    expect(sim.submitted).toHaveLength(0)
  })
  it('refuses uses the creator did not consent to', async () => {
    seedReadyTwin({ scopes: ['professional'] })
    expect((await start({ style: 'fashion' })).status).toBe(403)
  })
  it('requires the updated consent (with the likeness check) before creating', async () => {
    seedReadyTwin({ version: 'ai-twin-consent-v1' })
    const r = await start()
    expect(r.status).toBe(409)
    expect(r.json.reconsent).toBe(true)
  })
  it('blocks unsafe descriptions before any image is made', async () => {
    seedReadyTwin()
    expect((await start({ description: 'make me look like a teen' })).status).toBe(400)
    sim.review = { allowed: false, reason: 'Other real people are not allowed.' }
    const r = await start({ description: 'standing next to a well known actor' })
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/real people/)
    expect(sim.submitted).toHaveLength(0)
    expect(balance()).toBe(10)
  })
  it('is Pro only and hidden behind the switch', async () => {
    seedReadyTwin()
    expect((await call(generate, { token: TOKEN_B, body: { style: 'headshot' } })).status).toBe(403)
    delete process.env.AI_TWIN_ENABLED
    expect((await start()).status).toBe(404)
  })
  it('is unavailable until the image service key is configured', async () => {
    seedReadyTwin()
    delete process.env.FAL_KEY
    expect((await start()).status).toBe(503)
  })
})

describe('Likeness gate: only images that look like the creator are delivered', () => {
  it('delivers passing candidates, marks the best, charges once', async () => {
    seedReadyTwin()
    sim.judge = [{ ...PASS, likeness: 88 }, MISS, { ...PASS, likeness: 95 }, MISS]
    const { json: { creation_id } } = await start()
    const v = (await poll(creation_id)).json
    expect(v.status).toBe('succeeded')
    expect(v.images).toHaveLength(2)
    expect(v.images[0].is_best).toBe(true)
    expect(v.images[0].likeness).toBe(95)
    expect(Object.keys(state.storage['generated-media'])).toHaveLength(2) // failed candidates never stored
    expect(balance()).toBe(9)
    await poll(creation_id) // polling again changes nothing
    expect(balance()).toBe(9)
    expect(state.tables.credit_ledger.filter((l) => l.entry_type === 'charge')).toHaveLength(1)
  })
  it('if round 1 misses, retries automatically at no extra cost', async () => {
    seedReadyTwin()
    sim.judge = [MISS, MISS, MISS, MISS, PASS]
    const { json: { creation_id } } = await start()
    const v1 = (await poll(creation_id)).json
    expect(v1.status).toBe('running')
    expect(v1.round).toBe(2)
    expect(sim.submitted).toHaveLength(8)
    const v2 = (await poll(creation_id)).json
    expect(v2.status).toBe('succeeded')
    expect(balance()).toBe(9)
  })
  it('if both rounds miss, nothing is delivered, credits come back, with tips', async () => {
    seedReadyTwin()
    const { json: { creation_id } } = await start()
    await poll(creation_id)
    const v = (await poll(creation_id)).json
    expect(v.status).toBe('failed')
    expect(v.images).toHaveLength(0)
    expect(v.failure_reason).toMatch(/credits were returned/)
    expect(v.failure_reason).toMatch(/skin tone lighter/)
    expect(balance()).toBe(10)
  })
  it('unsafe outputs are never delivered and are refunded', async () => {
    seedReadyTwin()
    const unsafe = { ...PASS, explicit_or_nude: true }
    sim.judge = [unsafe, unsafe, unsafe, unsafe]
    const { json: { creation_id } } = await start()
    const v = (await poll(creation_id)).json
    expect(v.status).toBe('blocked')
    expect(balance()).toBe(10)
    expect(Object.keys(state.storage['generated-media'])).toHaveLength(0)
  })
  it('stops and refunds if the AI Twin is deleted mid-creation', async () => {
    seedReadyTwin()
    sim.falDone = false
    const { json: { creation_id } } = await start()
    expect(balance()).toBe(9)
    const d = await call(twin, { token: TOKEN_A, method: 'DELETE' })
    expect(d.status).toBe(200)
    expect(balance()).toBe(10)
    expect(state.tables.generation_jobs || []).toHaveLength(0)
  })
  it('judgement rules', () => {
    expect(decideJudgement(PASS).deliverable).toBe(true)
    expect(decideJudgement({ ...PASS, likeness: 70 }).deliverable).toBe(false)
    expect(decideJudgement({ ...PASS, artifacts: true }).deliverable).toBe(false)
    expect(decideJudgement({ ...PASS, people_count: 2 }).safe).toBe(false)
    expect(decideJudgement({ ...PASS, appears_adult: false }).safe).toBe(false)
  })
  it('prompt rules', () => {
    expect(quickPromptCheck('navy blazer, confident smile').ok).toBe(true)
    expect(quickPromptCheck('in lingerie').ok).toBe(false)
    expect(buildPrompt('speaker', 'red dress')).toMatch(/Creator's direction: red dress/)
  })
  it('another user cannot see or advance someone else\'s creation', async () => {
    seedReadyTwin()
    const { json: { creation_id } } = await start()
    const r = await call(generate, { token: TOKEN_B, method: 'GET', query: { id: creation_id } })
    expect(r.status).toBe(404)
  })
})

describe('Provider webhook', () => {
  function signed(body, { key, ts = Math.floor(Date.now() / 1000) } = {}) {
    const raw = Buffer.from(JSON.stringify(body))
    const msg = Buffer.from([body.request_id, 'fal-user', String(ts), crypto.createHash('sha256').update(raw).digest('hex')].join('\n'))
    return {
      rawBody: raw,
      headers: {
        'x-fal-webhook-request-id': body.request_id, 'x-fal-webhook-user-id': 'fal-user',
        'x-fal-webhook-timestamp': String(ts), 'x-fal-webhook-signature': crypto.sign(null, msg, key).toString('hex'),
      },
    }
  }
  it('accepts a genuine signed result and rejects forgeries', async () => {
    seedReadyTwin()
    sim.falDone = false
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
    sim.jwks = [{ kty: 'OKP', crv: 'Ed25519', x: publicKey.export({ format: 'jwk' }).x }]
    await start()
    const job = state.tables.generation_jobs[0]
    const body = { request_id: job.provider_job_id, status: 'OK', payload: { images: [{ url: 'https://fal.media/out/x.png' }] } }

    const attacker = crypto.generateKeyPairSync('ed25519').privateKey
    expect((await call(webhook, signed(body, { key: attacker }))).status).toBe(401)
    expect((await call(webhook, signed(body, { key: privateKey, ts: 1000 }))).status).toBe(401) // stale
    expect(job.status).toBe('running')

    expect((await call(webhook, signed(body, { key: privateKey }))).status).toBe(200)
    expect(job.status).toBe('returned')
    expect((await call(webhook, signed(body, { key: privateKey }))).status).toBe(200) // retry is harmless
  })
})

describe('Gallery', () => {
  it('lists and deletes only the owner\'s images', async () => {
    seedReadyTwin()
    sim.judge = [PASS, MISS, MISS, MISS]
    const { json: { creation_id } } = await start()
    await poll(creation_id)
    const g = (await call(gallery, { token: TOKEN_A, method: 'GET' })).json
    expect(g.images).toHaveLength(1)
    expect((await call(gallery, { token: TOKEN_B, method: 'DELETE', body: { id: g.images[0].id } })).status).toBe(404)
    expect((await call(gallery, { token: TOKEN_A, method: 'DELETE', body: { id: g.images[0].id } })).status).toBe(200)
    expect(Object.keys(state.storage['generated-media'])).toHaveLength(0)
  })
})
