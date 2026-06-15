export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { niche, audience, tone, platform, days } = req.body
  const platformList = Array.isArray(platform) ? platform.join(', ') : platform || 'Instagram'
  const dayCount = days || 7

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: `You are a content strategist. Return ONLY a raw JSON object. No markdown. No backticks. No explanation. Start with { and end with }`,
        messages: [{
          role: 'user',
          content: `Create a ${dayCount}-day content calendar for a ${niche || 'general'} creator targeting ${audience || 'professional women'} with a ${tone || 'conversational'} tone for ${platformList}.

Return this JSON structure exactly:
{"competitors":[{"name":"name","type":"direct","description":"what they do","gap":"opportunity"}],"days":[{"day":1,"week":1,"title":"title","hook":"opening line","cta":"call to action","format":"how to create","platforms":["ig"],"hashtags":"#tag1 #tag2 #tag3 #tag4 #tag5"}],"strategy":{"platformPriority":"platform focus","contentRhythm":"weekly structure","hashtagStack":"master hashtags"}}`
        }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(500).json({ error: data.error?.message || 'Anthropic API error' })
    }

    const textBlock = data.content.find(block => block.type === 'text')
    if (!textBlock) {
      return res.status(500).json({ error: 'No text content returned from AI.' })
    }

    const raw = textBlock.text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON in response. Raw:', raw.substring(0, 300))
      return res.status(500).json({ error: 'Could not parse AI response. Raw: ' + raw.substring(0, 100) })
    }

    const calendar = JSON.parse(jsonMatch[0])

    if (calendar.days && calendar.competitors) {
      return res.status(200).json({ calendar, mode: 'calendar' })
    }

    return res.status(200).json({ ideas: Array.isArray(calendar) ? calendar : [], mode: 'ideas' })

  } catch (error) {
    console.error('Generate ideas error:', error.message)
    return res.status(500).json({ error: error.message || 'Failed to generate ideas.' })
  }
}
