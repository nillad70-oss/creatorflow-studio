export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { topic, niche, audience, tone, platform, script_mode } = req.body
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' })
  }
  const systemPrompt = `You are an expert scriptwriter for ${niche || 'general'} content creators. Write natural, conversational scripts. Return ONLY a JSON object with: title, hook, body, cta, pacing`
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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Write a ${script_mode || 'educational'} script about: "${topic}" for ${audience || 'general audience'} on ${platform || 'instagram'}. Tone: ${tone || 'conversational'}` }],
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
