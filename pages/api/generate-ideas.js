export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { niche, audience, tone, platform, days, brandInput } = req.body

  // brandInput is the new field — website, social handle, or brand description
  // If not provided fall back to niche + audience combination
  const brandContext = brandInput || `${niche} creator targeting ${audience}`
  const platformList = Array.isArray(platform) ? platform.join(', ') : platform || 'Instagram, TikTok'
  const dayCount = days || 30

  const prompt = `You are a world-class content strategist and social media researcher.

A creator has provided this information:
- Brand / Website / Social Handle: ${brandContext}
- Niche: ${niche || 'general'}
- Target Audience: ${audience || 'general audience'}
- Tone: ${tone || 'conversational'}
- Platforms: ${platformList}

Your job has three parts:

PART 1 — RESEARCH
Use web search to find and analyze 5-6 real competitors in this creator's space. Search their social media profiles on TikTok, Instagram, Facebook, YouTube. Look at their actual content. Identify:
- Their content style and what performs well
- Their hooks and posting patterns
- The gaps and opportunities this creator can own

PART 2 — CALENDAR
Create a ${dayCount}-day content calendar with this sequential strategy:
- Week 1: Establish authority and personal story
- Week 2: Education and value delivery  
- Week 3: Social proof, products, and offers
- Week 4: Community, legacy, and next steps

Each day must have:
- title: compelling video title
- hook: exact words for the opening 2 seconds
- cta: specific call to action
- format: how to film/create this
- platforms: array using codes tt=TikTok ig=Instagram fb=Facebook yt=YouTube
- hashtags: 5 relevant hashtags as a string

PART 3 — STRATEGY
Platform priority and content rhythm recommendations specific to this audience.

Return ONLY a valid JSON object with this exact structure — no text before or after, no markdown:
{
  "competitors": [
    {
      "name": "handle or page name",
      "type": "direct or adjacent",
      "description": "what they do and their performance",
      "gap": "specific opportunity for this creator"
    }
  ],
  "days": [
    {
      "day": 1,
      "week": 1,
      "title": "video title",
      "hook": "opening 2 seconds exact words",
      "cta": "call to action",
      "format": "how to create this",
      "platforms": ["ig", "tt"],
      "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
    }
  ],
  "strategy": {
    "platformPriority": "which platform to focus on first and why",
    "contentRhythm": "how to structure posting each week",
    "hashtagStack": "master hashtag list for this niche"
  }
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
        messages: [{
          role: 'user',
          content: prompt
        }],
      }),
    })

    const data = await response.json()
    console.log('Anthropic response status:', response.status)

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
    }

    // Claude may return multiple content blocks when using tools
    // Find the final text block which contains the JSON
    const textBlock = data.content
      .filter(block => block.type === 'text')
      .pop()

    if (!textBlock) {
      return res.status(500).json({ error: 'No content returned. Please try again.' })
    }

    const cleaned = textBlock.text
      .replace(/```json\n?|\n?```/g, '')
      .trim()

    // Try to parse as calendar JSON first
    try {
      const calendar = JSON.parse(cleaned)

      // If it has the calendar structure return it as calendar
      if (calendar.days && calendar.competitors) {
        return res.status(200).json({ calendar, mode: 'calendar' })
      }

      // Otherwise it's a simple ideas array — return as before
      return res.status(200).json({ ideas: Array.isArray(calendar) ? calendar : [], mode: 'ideas' })

    } catch (parseError) {
      // If JSON parse fails try to extract array
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        const ideas = JSON.parse(arrayMatch[0])
        return res.status(200).json({ ideas, mode: 'ideas' })
      }
      throw new Error('Could not parse response as JSON')
    }

  } catch (error) {
    console.error('Generate ideas error:', error)
    return res.status(500).json({ error: 'Failed to generate ideas. Please try again.' })
  }
}
