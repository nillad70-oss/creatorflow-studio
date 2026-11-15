// Prompt safety + identity-preserving prompt construction for AI Twin™ (server-only).
import { STYLES, MAX_DESCRIPTION } from '../twinStudio'

// Fast first line of defence. Claude reviews everything that passes this.
const BLOCKED = [
  /\b(nude|naked|topless|nsfw|lingerie|underwear|bikini|sexual|sexy|erotic|porn|onlyfans|fetish|cleavage)\b/i,
  /\b(child|children|kid|kids|teen|teenage|minor|underage|schoolgirl|schoolboy|baby[- ]?face|younger version|years? old)\b/i,
  /\b(gun|rifle|weapon|blood|gore|kill|violence|drugs?|cocaine)\b/i,
  /\b(ballot|vote for|election|campaign rally|politician|president|senator)\b/i,
  /\b(as|like|with|next to|beside|hugging|kissing)\s+(celebrity|famous)\b/i,
  /\b(id card|passport|driver'?s licen[cs]e|badge of|police|military uniform)\b/i,
]

export function quickPromptCheck(description) {
  const d = String(description || '').trim()
  if (d.length > MAX_DESCRIPTION) return { ok: false, reason: `Please keep the description under ${MAX_DESCRIPTION} characters.` }
  for (const re of BLOCKED) {
    if (re.test(d)) return { ok: false, reason: 'That description isn\'t allowed for AI Twin images. Please describe a professional or lifestyle scene of yourself.' }
  }
  return { ok: true }
}

const REVIEW_PROMPT = (scope, description) => `You review requests for an AI image service where an ADULT creator makes images of THEMSELVES only, for "${scope}" use (professional branding or fashion/lifestyle content).

Request: """${description}"""

Refuse if it asks for: nudity, sexual or suggestive content; making the person look younger or like a minor; any other real or famous person appearing or being imitated; political, election or campaigning content; violence, weapons or drugs; fake documents, uniforms of authority, or anything meant to deceive people about identity, endorsements or events; anything outside "${scope}" use.

Return ONLY JSON: {"allowed": true|false, "reason": "<one short plain-English sentence if refused, else empty>"}`

export async function reviewPrompt(scope, description) {
  if (!String(description || '').trim()) return { allowed: true }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: REVIEW_PROMPT(scope, description) }] }),
  })
  if (!r.ok) throw new Error(`prompt review failed (${r.status})`)
  const data = await r.json()
  const text = (data.content || []).map((c) => c.text || '').join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('prompt review returned no result')
  const j = JSON.parse(m[0])
  return { allowed: j.allowed === true, reason: j.reason || 'That request isn\'t allowed for AI Twin images.' }
}

// Identity-first prompt. The reference photos do the heavy lifting; the text
// tells the model to treat them as the ground truth for who the person is.
export function buildPrompt(styleKey, description) {
  const style = STYLES[styleKey]
  const extra = String(description || '').trim()
  return [
    'Create a new photorealistic photograph of the exact same person shown in the reference photos.',
    'IDENTITY IS THE TOP PRIORITY: preserve their precise facial structure, eye shape and colour, nose, lips, eyebrows, jawline, skin tone and undertone, skin texture, hair texture and hairline, apparent age and body type exactly as in the references.',
    'Do not beautify, slim, lighten or darken skin, change ethnicity-related features, smooth away natural features, or make them look younger or older. It must be instantly recognisable as them to their friends.',
    `Scene: ${style.scene}.`,
    extra ? `Creator's direction: ${extra}.` : '',
    'Exactly one person in the image. Natural, flattering, true-to-life skin with real pores. Shot on a full-frame camera with an 85mm lens, professional lighting and colour grading.',
    'No text, logos, watermarks, borders or collage. Single image.',
  ].filter(Boolean).join(' ')
}
