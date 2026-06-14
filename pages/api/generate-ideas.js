export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { niche, audience, tone, platform, days, brandInput } = req.body
  const brandContext = brandInput || `${niche} creator targeting ${audience}`
  const platformList = Array.isArray(platform) ? platform.join(', ') : platform || 'Instagram, TikTok'
  const dayCount = days || 30

  const prompt = `You are a world-class content strategist.

A creator has provided this information:
- Brand: ${brandContext}
- Niche: ${niche || 'general'}
- Target Audience: ${audience || 'general audience'}
- Tone: ${tone || 'conversational'}
- Platforms: ${platformList}

Create a ${dayCount}-day content calendar with this weekly strategy:
- Week 1: Establish authority and personal story
- Week 2: Education and value delivery
- Week 3: Social proof and offers
- Week 4: Community and legacy

Return ONLY a valid JSON object — no text before or after:
{
  "competitors": [
    {
      "name": "competitor name",
      "type": "direct or adjacent",
      "description": "what they do",
      "gap": "opportunity for this creator"
    }
  ],
  "days": [
    {
      "day": 1,
      "week": 1,
      "title": "video title",
      "hook": "opening 2 seconds",
      "cta": "call to action",
      "format": "how to create",
      "platforms": ["ig"],
      "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
    }
  ],
  "strategy": {
    "platformPriority": "which platform first and why",
    "contentRhythm": "how to structure each week",
    "hashtagStack": "master hashtag list"
  }
}`

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
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: prompt
        }],
      }),
    })

    const data = await response.json()
    console.log('Anthropic status:', response.status)

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
    }

    const textBlock = data.content.find(block => block.type === 'text')
    if (!textBlock) {
      return res.status(500).json({ error: 'No content returned.' })
    }

    const cleaned = textBlock.text.replace(/\`\`\`json\n?|\n?\`\`\`/g, '').trim()

    try {
      const calendar = JSON.parse(cleaned)
      if (calendar.days && calendar.competitors) {
        return res.status(200).json({ calendar, mode: 'calendar' })
      }
      return res.status(200).json({ ideas: Array.isArray(calendar) ? calendar : [], mode: 'ideas' })
    } catch (parseError) {
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        const ideas = JSON.parse(arrayMatch[0])
        return res.status(200).json({ ideas, mode: 'ideas' })
      }
      throw new Error('Could not parse response')
    }

  } catch (error) {
    console.error('Generate ideas error:', error)
    return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
  }
}
