// AI Twin™ creation pipeline (server-only).
//
// One creation = the creator asks once. The system:
//   1. holds the credits,
//   2. runs several candidates in parallel across the top engines,
//   3. has Claude check each one for likeness to the creator's own reference
//      photos and for safety,
//   4. delivers only candidates that pass, marking the best,
//   5. runs one more round automatically if none pass,
//   6. charges only on delivery; otherwise returns the credits.
import crypto from 'crypto'
import { getServiceClient } from './auth'
import { applyCredit } from './credits'
import { REFERENCE_BUCKET, GENERATED_BUCKET, sniffType, audit, CONSENT_VERSION } from './twin'
import { ENGINE_MODES, ENGINES, creationCost } from '../twinStudio'
import { engineInput, submitJob, pollJob } from './fal'
import { buildPrompt } from './twinPrompt'
import { judgeCandidate } from './judgeImage'

export const MAX_ROUNDS = 2
export const CANDIDATES = { multi: 2, single: 3 } // per engine per round
const JOB_TIMEOUT_MS = 10 * 60_000
const CLAIM_TIMEOUT_MS = 3 * 60_000
const MAX_OUTPUT_BYTES = 40 * 1024 * 1024

function webhookUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  return base.startsWith('https://') && !base.includes('localhost') ? `${base}/api/twin/provider-webhook` : null
}

async function referenceUrls(supabase, userId, twinId) {
  const { data: refs } = await supabase.from('twin_reference_images')
    .select('storage_path, created_at').eq('user_id', userId).eq('twin_id', twinId).order('created_at', { ascending: true })
  const urls = []
  for (const r of refs || []) {
    const { data } = await supabase.storage.from(REFERENCE_BUCKET).createSignedUrl(r.storage_path, 15 * 60)
    if (data?.signedUrl) urls.push(data.signedUrl)
  }
  return urls
}

async function submitRound(supabase, creation, round) {
  const engines = ENGINE_MODES[creation.mode].engines
  const perEngine = engines.length > 1 ? CANDIDATES.multi : CANDIDATES.single
  const refs = await referenceUrls(supabase, creation.user_id, creation.twin_id)
  const prompt = buildPrompt(creation.style, creation.user_prompt)
  const hook = webhookUrl()

  const jobs = []
  for (const engine of engines) {
    for (let i = 0; i < perEngine; i++) {
      const input = engineInput(engine, { prompt, referenceUrls: refs, tier: creation.quality_tier, aspect: creation.aspect_ratio })
      const base = {
        user_id: creation.user_id, twin_id: creation.twin_id, creation_id: creation.id, round,
        job_type: 'image', provider: 'fal', engine, style: creation.style, quality_tier: creation.quality_tier,
        aspect_ratio: creation.aspect_ratio, user_prompt: creation.user_prompt, prompt, consent_id: creation.consent_id,
      }
      try {
        const sub = await submitJob(engine, input, hook)
        jobs.push({ ...base, status: 'running', provider_job_id: sub.requestId, status_url: sub.statusUrl, response_url: sub.responseUrl })
      } catch (e) {
        jobs.push({ ...base, status: 'failed', error: String(e.message).slice(0, 300), completed_at: new Date().toISOString() })
      }
    }
  }
  await supabase.from('generation_jobs').insert(jobs)
  return jobs
}

export async function startCreation({ userId, twin, consent, style, mode, tier, aspect, description }) {
  const supabase = getServiceClient()
  const cost = creationCost(mode, tier) // charged only when an image is delivered
  const id = crypto.randomUUID()

  const held = await applyCredit(userId, -cost, 'hold', `creation:${id}`, `AI Twin creation (${style})`)
  if (held === null) return { error: 'insufficient_credits', cost }

  const creation = {
    id, user_id: userId, twin_id: twin.id, consent_id: consent.id, style, mode, quality_tier: tier,
    aspect_ratio: aspect, user_prompt: description || null, credits_held: cost, round: 1, status: 'running',
  }
  const { error } = await supabase.from('twin_creations').insert(creation)
  if (error) {
    await applyCredit(userId, cost, 'release', `creation:${id}`, 'Could not start')
    throw new Error('could not record creation')
  }
  const jobs = await submitRound(supabase, creation, 1)
  await audit(userId, 'twin.creation.started', id, { style, mode, tier, candidates: jobs.length })
  return { creation, cost }
}

// Called by the provider webhook (fast path) and by polling (fallback).
export async function recordProviderResult(supabase, job, { imageUrl, error }) {
  const update = imageUrl
    ? { status: 'returned', result_url: imageUrl }
    : { status: 'failed', error: String(error || 'provider error').slice(0, 300), completed_at: new Date().toISOString() }
  await supabase.from('generation_jobs').update(update).eq('id', job.id).in('status', ['queued', 'running'])
}

async function stillAuthorized(supabase, creation) {
  const { data: twin } = await supabase.from('twin_profiles').select('id, status').eq('id', creation.twin_id).eq('user_id', creation.user_id).maybeSingle()
  if (!twin || twin.status !== 'ready') return false
  const { data: consent } = await supabase.from('consent_records').select('id, revoked_at, consent_version')
    .eq('id', creation.consent_id).eq('user_id', creation.user_id).maybeSingle()
  return Boolean(consent && !consent.revoked_at && consent.consent_version === CONSENT_VERSION)
}

async function processJob(supabase, creation, job, refs) {
  const done = (patch) => supabase.from('generation_jobs').update({ ...patch, completed_at: new Date().toISOString() }).eq('id', job.id)

  let verdict
  try {
    verdict = await judgeCandidate(refs, job.result_url)
  } catch (e) {
    return done({ status: 'failed', error: `check failed: ${String(e.message).slice(0, 200)}` })
  }
  const check = { likeness: verdict.likeness, quality: verdict.quality, score: verdict.score, safe: verdict.safe, issues: verdict.issues, safety: verdict.safetyReasons }
  if (!verdict.safe) return done({ status: 'blocked', likeness: verdict.likeness, check_result: check })
  if (!verdict.deliverable) return done({ status: 'failed', likeness: verdict.likeness, check_result: check, error: 'below likeness/quality bar' })

  // Copy the image into our private storage; the provider URL is never shown to the creator.
  const r = await fetch(job.result_url)
  if (!r.ok) return done({ status: 'failed', error: `download failed (${r.status})`, check_result: check })
  const buf = Buffer.from(await r.arrayBuffer())
  const type = sniffType(buf)
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type) || buf.length > MAX_OUTPUT_BYTES) {
    return done({ status: 'failed', error: 'unexpected output file', check_result: check })
  }
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[type]
  const path = `${creation.user_id}/${creation.twin_id}/gen-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`
  const { error: upErr } = await supabase.storage.from(GENERATED_BUCKET).upload(path, buf, { contentType: type })
  if (upErr) return done({ status: 'failed', error: 'storage upload failed', check_result: check })

  await supabase.from('generated_assets').insert({
    user_id: creation.user_id, twin_id: creation.twin_id, job_id: job.id, creation_id: creation.id,
    storage_path: path, media_type: 'image', ai_disclosure: true, score: verdict.score, likeness: verdict.likeness,
    provenance: {
      ai_generated: true, generator: 'NillaFlow Studio AI Twin', engine: job.engine, model: ENGINES[job.engine]?.model,
      consent_version: CONSENT_VERSION, consent_id: creation.consent_id, created_at: new Date().toISOString(),
      likeness: verdict.likeness, quality: verdict.quality,
    },
  })
  return done({ status: 'succeeded', likeness: verdict.likeness, check_result: check })
}

async function finish(supabase, creation, status, reason) {
  const { data: won } = await supabase.from('twin_creations')
    .update({ status, failure_reason: reason || null, completed_at: new Date().toISOString() })
    .eq('id', creation.id).eq('status', 'running').select('id')
  if (!won?.length) return
  if (status === 'succeeded') {
    await applyCredit(creation.user_id, 0, 'charge', `creation:${creation.id}`, 'Delivered')
  } else {
    await applyCredit(creation.user_id, creation.credits_held, 'release', `creation:${creation.id}`, reason || status)
  }
  await audit(creation.user_id, `twin.creation.${status}`, creation.id, { round: creation.round, reason })
}

function tipsFrom(jobs) {
  const issues = jobs.flatMap((j) => j.check_result?.issues || [])
  const top = [...new Set(issues)].slice(0, 3)
  return 'We couldn\'t produce an image that looks enough like you, so your credits were returned.' +
    (top.length ? ` What differed: ${top.join('; ')}.` : '') +
    ' Tip: add sharper, well-lit photos from several angles (front, three-quarter, profile) with no filters.'
}

// Moves a creation forward and returns its current state. Safe to call repeatedly and concurrently.
export async function advanceCreation(creationId, userId) {
  const supabase = getServiceClient()
  let { data: creation } = await supabase.from('twin_creations').select('*').eq('id', creationId).eq('user_id', userId).maybeSingle()
  if (!creation) return null

  if (creation.status === 'running') {
    if (!(await stillAuthorized(supabase, creation))) {
      await finish(supabase, creation, 'failed', 'Your AI Twin or consent is no longer active.')
    } else {
      const { data: jobs } = await supabase.from('generation_jobs').select('*').eq('creation_id', creation.id).eq('round', creation.round)
      const now = Date.now()

      // Fallback when no webhook has arrived: ask the provider directly.
      await Promise.all((jobs || []).filter((j) => j.status === 'running').map(async (j) => {
        if (now - new Date(j.created_at).getTime() > JOB_TIMEOUT_MS) return recordProviderResult(supabase, j, { error: 'timed out' })
        if (!j.status_url) return
        try {
          const p = await pollJob(j.status_url, j.response_url)
          if (p.state === 'done') await recordProviderResult(supabase, j, { imageUrl: p.imageUrl })
          if (p.state === 'error') await recordProviderResult(supabase, j, { error: p.error })
        } catch { /* try again next poll */ }
      }))

      // Claim finished candidates (or stale claims) and check them.
      const staleBefore = new Date(now - CLAIM_TIMEOUT_MS).toISOString()
      const { data: fresh } = await supabase.from('generation_jobs').update({ status: 'processing', claimed_at: new Date().toISOString() })
        .eq('creation_id', creation.id).eq('round', creation.round).eq('status', 'returned').select('*')
      const { data: stale } = await supabase.from('generation_jobs').update({ claimed_at: new Date().toISOString() })
        .eq('creation_id', creation.id).eq('round', creation.round).eq('status', 'processing').lt('claimed_at', staleBefore).select('*')
      const claimed = [...(fresh || []), ...(stale || [])]
      if (claimed.length) {
        const refs = await referenceUrls(supabase, creation.user_id, creation.twin_id)
        await Promise.all(claimed.map((j) => processJob(supabase, creation, j, refs)))
      }

      const { data: roundJobs } = await supabase.from('generation_jobs').select('*').eq('creation_id', creation.id).eq('round', creation.round)
      const terminal = ['succeeded', 'failed', 'blocked', 'cancelled']
      if ((roundJobs || []).length && roundJobs.every((j) => terminal.includes(j.status))) {
        const { data: assets } = await supabase.from('generated_assets').select('id, score').eq('creation_id', creation.id)
        if (assets?.length) {
          const best = [...assets].sort((a, b) => b.score - a.score)[0]
          await supabase.from('generated_assets').update({ is_best: true }).eq('id', best.id)
          await supabase.from('twin_creations').update({ best_asset_id: best.id }).eq('id', creation.id)
          await finish(supabase, creation, 'succeeded')
        } else if (roundJobs.every((j) => j.status === 'blocked')) {
          await finish(supabase, creation, 'blocked', 'The results didn\'t pass our safety check, so nothing was delivered and your credits were returned.')
        } else if (creation.round < MAX_ROUNDS) {
          const { data: moved } = await supabase.from('twin_creations').update({ round: creation.round + 1 })
            .eq('id', creation.id).eq('round', creation.round).eq('status', 'running').select('*')
          if (moved?.length) await submitRound(supabase, moved[0], moved[0].round)
        } else {
          const { data: allJobs } = await supabase.from('generation_jobs').select('check_result').eq('creation_id', creation.id)
          await finish(supabase, creation, 'failed', tipsFrom(allJobs || []))
        }
      }
    }
    ;({ data: creation } = await supabase.from('twin_creations').select('*').eq('id', creationId).eq('user_id', userId).maybeSingle())
  }
  return creationView(supabase, creation)
}

export async function creationView(supabase, creation) {
  const { data: jobs } = await supabase.from('generation_jobs').select('status, round').eq('creation_id', creation.id)
  const { data: assets } = await supabase.from('generated_assets').select('id, storage_path, is_best, likeness, created_at').eq('creation_id', creation.id)
  const images = []
  for (const a of (assets || []).sort((x, y) => Number(y.is_best) - Number(x.is_best) || y.likeness - x.likeness)) {
    const { data } = await supabase.storage.from(GENERATED_BUCKET).createSignedUrl(a.storage_path, 10 * 60)
    images.push({ id: a.id, url: data?.signedUrl || null, is_best: a.is_best, likeness: a.likeness })
  }
  const cur = (jobs || []).filter((j) => j.round === creation.round)
  return {
    id: creation.id, status: creation.status, round: creation.round, max_rounds: MAX_ROUNDS,
    style: creation.style, credits: creation.credits_held, failure_reason: creation.failure_reason,
    progress: { candidates: cur.length, checked: cur.filter((j) => ['succeeded', 'failed', 'blocked'].includes(j.status)).length },
    images,
  }
}
