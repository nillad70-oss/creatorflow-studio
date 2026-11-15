// Likeness + safety check of a generated AI Twin image, done by Claude vision.
// Compares the candidate with the creator's own reference photos (they consented
// to this in consent v2). Nothing is stored except the returned scores: no face
// template, embedding or faceprint is produced. It never identifies who the person is.

export const LIKENESS_THRESHOLD = Number(process.env.TWIN_LIKENESS_THRESHOLD || 82)
const JUDGE_MODEL = process.env.TWIN_JUDGE_MODEL || 'claude-sonnet-5-5'

const JUDGE_PROMPT = `The first images are reference photos that a consenting adult creator uploaded of themselves. The LAST image is an AI-generated candidate meant to depict that same creator.

Do NOT try to identify who the person is. Only compare the images with each other.

Score how convincingly the candidate depicts the SAME individual as the references, as a close friend would judge it: face shape, eyes, nose, mouth, eyebrows, jawline, skin tone and undertone, hair texture/hairline, apparent age and body type. Penalize heavily any drift in skin tone, ethnicity-related features, age, or weight, and any "generic AI face". Lighting, outfit and setting changes are expected and should not reduce the score.

Return ONLY valid JSON:
{
  "likeness": <0-100; 90+ = unmistakably the same person, 80-89 = clearly them, 60-79 = resembles them, <60 = a different person>,
  "likeness_issues": [<short plain-English differences, e.g. "skin tone lighter than references", "nose shape different">],
  "people_count": <number of people in the candidate>,
  "appears_adult": <true/false>,
  "explicit_or_nude": <true/false>,
  "artifacts": <true if there are distorted hands, extra limbs, melted features, garbled text, or other obvious AI defects>,
  "quality": <0-100 overall photographic quality and realism>
}`

export function decideJudgement(j) {
  const safetyReasons = []
  if (j.people_count !== 1) safetyReasons.push('more than one person')
  if (!j.appears_adult) safetyReasons.push('does not clearly appear adult')
  if (j.explicit_or_nude) safetyReasons.push('explicit content')
  const safe = safetyReasons.length === 0
  const likeness = clamp(j.likeness)
  const quality = clamp(j.quality)
  const deliverable = safe && !j.artifacts && likeness >= LIKENESS_THRESHOLD && quality >= 60
  // Ranking score: likeness dominates; quality breaks ties.
  const score = Math.round(likeness * 0.75 + quality * 0.25)
  return { safe, safetyReasons, deliverable, likeness, quality, score, issues: j.likeness_issues || [] }
}

function clamp(n) { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0 }

export async function judgeCandidate(referenceUrls, candidateUrl) {
  const refs = referenceUrls.slice(0, 4) // a few clear references are enough to judge likeness
  const content = [
    ...refs.map((url) => ({ type: 'image', source: { type: 'url', url } })),
    { type: 'image', source: { type: 'url', url: candidateUrl } },
    { type: 'text', text: JUDGE_PROMPT },
  ]
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: JUDGE_MODEL, max_tokens: 500, messages: [{ role: 'user', content }] }),
  })
  if (!response.ok) throw new Error(`likeness check failed (${response.status})`)
  const data = await response.json()
  const text = (data.content || []).map((c) => c.text || '').join('')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('likeness check returned no result')
  const raw = JSON.parse(match[0])
  return { raw, ...decideJudgement(raw) }
}
