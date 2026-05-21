export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { niche, audience, tone, platform, days } = req.body

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
        max_tokens: 2000,
        system: `You are a content strategist for ${niche || 'general'} creators. Generate content ideas. Return ONLY a JSON array with no other text. Each item must have: topic, hook, category, type.`,
        messages: [{
          role: 'user',
          content: `Generate ${days || 30} content ideas for a ${niche} creator targeting ${audience} with a ${tone} tone for ${platform}. Return ONLY a JSON array.`
        }],
      }),
    })

    const data = await response.json()
    const content = data.content[0].text
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    const ideas = JSON.parse(cleaned)
    return res.status(200).json({ ideas })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
  }
}