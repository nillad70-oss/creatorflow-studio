// Reference-photo quality screening with Claude vision.
// Quality and content checks ONLY: it does not identify people, recognize
// faces, or compare faces between photos.

const SCREEN_PROMPT = `You are checking a photo that a creator uploaded as a reference image of themselves for professional AI-generated branding images.

Do NOT try to identify who the person is. Only assess the photo itself.

Return ONLY valid JSON, no other text:
{
  "people_count": <number of people visible>,
  "face_clearly_visible": <true if one face is clearly visible, in focus, not covered by sunglasses/mask/hands>,
  "appears_adult": <true if the person clearly appears to be an adult; false if they may be a minor or you cannot tell>,
  "explicit_or_nude": <true if the image contains nudity or sexual content>,
  "image_quality": "good" | "fair" | "poor",
  "issues": [<short plain-English problems, e.g. "Face is in shadow", "Image is blurry", "More than one person">]
}`

export function decideScreening(result) {
  const reasons = []
  if (result.people_count !== 1) reasons.push('Photo must show exactly one person.')
  if (!result.face_clearly_visible) reasons.push('Your face must be clearly visible.')
  if (!result.appears_adult) reasons.push('Photo must clearly show an adult.')
  if (result.explicit_or_nude) reasons.push('Photo contains content that is not allowed.')
  if (result.image_quality === 'poor') reasons.push('Image quality is too low (blurry, dark or too small).')
  return { accepted: reasons.length === 0, reasons }
}

export async function screenReferencePhoto(buffer, mimeType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') } },
          { type: 'text', text: SCREEN_PROMPT },
        ],
      }],
    }),
  })
  if (!response.ok) throw new Error(`screening request failed (${response.status})`)
  const data = await response.json()
  const text = (data.content || []).map((c) => c.text || '').join('')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('screening returned no result')
  const result = JSON.parse(match[0])
  return { result, ...decideScreening(result) }
}
