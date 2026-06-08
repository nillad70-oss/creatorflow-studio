export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    topic, niche, audience, tone, platform, script_mode,
    content_objectives, offer_types, audience_problems, cta_objectives,
  } = req.body

  if (!topic) return res.status(400).json({ error: 'Topic is required' })

  const objectivesText = content_objectives?.length ? content_objectives.join(', ') : 'Awareness'
  const offerText = offer_types?.length ? offer_types.join(', ') : ''
  const problemText = audience_problems?.length ? audience_problems.join(', ') : ''
  const ctaText = cta_objectives?.length ? cta_objectives.join(', ') : 'Follow'

  const systemPrompt = `You are NillaFlow Studio™ — an elite AI content engine operating as a full marketing team.

Your roles: Marketing Director, Viral Content Creator, Brand Strategist, Copywriter, Sales Consultant, Storytelling Expert, Social Media Manager.

CREATOR CONTEXT:
- Niche: ${niche || 'General'}
- Audience: ${audience || 'Professional women'}
- Voice: ${tone || 'Conversational'}
- Platform: ${platform || 'Instagram'}
- Objectives: ${objectivesText}
${offerText ? `- Offer: ${offerText}` : ''}
${problemText ? `- Pain Points: ${problemText}` : ''}
- Desired Action: ${ctaText}

YOUR ONLY JOB: Write the content. Never explain how to write it. Never give instructions. Just write the script.

ABSOLUTE PROHIBITIONS — ZERO EXCEPTIONS:
- NEVER generate specific dollar amounts or income figures of any kind
- NEVER generate commission percentages or earnings claims
- NEVER generate guaranteed results or timeframe income claims
- NEVER invent platform names not explicitly provided by the user
- NEVER invent tools, systems, or products not explicitly named by the user
- NEVER write "I made X" or "I earned X" with any number attached

AUTO-COMPLIANCE: If topic mentions affiliate, franchise, business opportunity, passive income, commission, or earnings — apply all prohibitions above with maximum strictness. Use transformation language and opportunity language instead.

HALLUCINATION PREVENTION: You may ONLY reference tools or platforms explicitly named in the creator context or topic. If not named — omit it entirely.

CONTENT RULES:
- Hook: 1-2 sentences MAX. Stops scroll in 3 seconds.
- Body: 3-5 short punchy points. One idea per line.
- CTA: 1 clear sentence aligned to desired action.
- MAXIMUM 150 WORDS TOTAL.
- Voice: Natural, conversational, authentic.
- Exactly 5 hashtags.

SOLUTION STACK: Only include explicitly named tools. If none named — return empty array [].

CREATOR RESPONSE: Exact message creator sends when someone engages. No income claims. No percentages.

You MUST return ONLY a raw JSON object. No markdown. No backticks. No explanation. No text before or after.
The response must start with { and end with }
Required keys: title, hook, body, cta, hashtags, solution_stack, creator_response`

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Write a ${script_mode || 'educational'} script about: "${topic}". Platform: ${platform || 'Instagram'}.`
        }],
      }),
    })

    const data = await response.json()

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI. Please try again.' })
    }

    const raw = data.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse script. Please try again.' })
    }

    const script = JSON.parse(jsonMatch[0])
    return res.status(200).json({ script })

  } catch (error) {
    console.error('Generate script error:', error)
    return res.status(500).json({ error: 'Failed to generate script. Please try again.' })
  }
}
