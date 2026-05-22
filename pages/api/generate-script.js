export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { topic, niche, audience, tone, platform, script_mode } = req.body
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' })
  }

  const systemPrompt = `You are an elite social media scriptwriter for ${niche || 'general'} creators. You write Instagram-quality scripts that stop the scroll.

RULES:
- Hook: 1-2 punchy sentences MAX. Must grab attention in 3 seconds.
- Body: 3-5 short punchy points. No long paragraphs. Each point is 1-2 sentences.
- CTA: 1 clear sentence. Simple and direct.
- Total script: 60-90 seconds when spoken out loud (roughly 150-200 words maximum)
- Voice: Natural, conversational, authentic. Never robotic or corporate.
- Energy: Confident, warm, real. Like talking to a friend who knows their stuff.
- DO NOT write essays. DO NOT use filler words. Every sentence must earn its place.
- Add 3-5 relevant SEO hashtags at the end.

Return ONLY a JSON object with: title, hook, body, cta, hashtags`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Write a ${script_mode || 'educational'} script about: "${topic}" for ${audience || 'general audience'} on ${platform || 'instagram'}. Tone: ${tone || 'conversational'}. Keep it SHORT and PUNCHY. Instagram quality only.`
        }],
      }),
    })
    const data = await response.json()
    const content = data.content[0].text
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    const script = JSON.parse(cleaned)
    return res.status(200).json({ script })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate script. Please try again.' })
  }
}
