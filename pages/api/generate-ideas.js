export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { niche, audience, tone, platform, days, brandInput } = req.body
  const brandContext = brandInput || `${niche} creator targeting ${audience}`
  const platformList = Array.isArray(platform) ? platform.join(', ') : platform || 'Instagram, TikTok'
  const dayCount = days || 30

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: `You are a world-class content strategist. Return ONLY valid JSON. No text before or after. No markdown fences.`,
        messages: [{
          role: 'user',
          content: `Create a ${dayCount}-day content calendar for a ${niche} creator targeting ${audience} with a ${tone} tone for ${platformList}.

Weekly strategy:
- Week 1: Authority and personal story
- Week 2: Education and value
- Week 3: Social proof and offers
- Week 4: Community and legacy

Return this exact JSON structure:
{
  "competitors": [
    {"name": "name", "type": "direct", "description": "what they do", "gap": "your opportunity"}
  ],
  "days": [
    {"day": 1, "week": 1, "title": "title", "hook": "opening line", "cta": "action", "format": "how to film", "platforms": ["ig"], "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"}
  ],
  "strategy": {
    "platformPriority": "which platform first",
    "contentRhythm": "weekly structure",
    "hashtagStack": "master hashtags"
  }
}`
        }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
    }

    const textBlock = data.content.find(block => block.type === 'text')
    if (!textBlock) {
      return res.status(500).json({ error: 'No content returned.' })
    }

    const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, '').trim()
    const calendar = JSON.parse(cleaned)

    if (calendar.days && calendar.competitors) {
      return res.status(200).json({ calendar, mode: 'calendar' })
    }

    return res.status(200).json({ ideas: Array.isArray(calendar) ? calendar : [], mode: 'ideas' })

  } catch (error) {
    console.error('Generate ideas error:', error)
    return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
  }
}
