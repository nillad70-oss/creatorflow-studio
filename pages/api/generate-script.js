export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    topic,
    niche,
    audience,
    tone,
    platform,
    script_mode,
    content_objectives,
    offer_types,
    audience_problems,
    cta_objectives,
    compliance_mode,
  } = req.body

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' })
  }

  const objectivesText = content_objectives?.length
    ? `Content Objectives: ${content_objectives.join(', ')}`
    : 'Content Objective: Awareness'

  const offerText = offer_types?.length
    ? `Offer Being Promoted: ${offer_types.join(', ')}`
    : ''

  const problemText = audience_problems?.length
    ? `Audience Pain Points to Address: ${audience_problems.join(', ')}`
    : ''

  const ctaText = cta_objectives?.length
    ? `Desired Audience Action: ${cta_objectives.join(', ')}`
    : 'Desired Audience Action: Follow'

  const complianceBlock = compliance_mode ? `
COMPLIANCE MODE ACTIVE — STRICT ENFORCEMENT:
- NEVER include income claims, earnings examples, or salary replacement claims
- NEVER include guaranteed results or specific commission percentages
- NEVER include unrealistic lifestyle promises
- REPLACE with: educational language, opportunity-focused language, curiosity-based messaging
- Focus on community, transformation, and possibility — never on specific financial outcomes
` : ''

  const systemPrompt = `You are an elite social media scriptwriter for ${niche || 'general'} creators on NillaFlow Studio™.

CREATOR CONTEXT:
- Niche: ${niche || 'General'}
- Primary Audience: ${audience || 'Professional women'}
- Brand Voice: ${tone || 'Conversational'}
- Platform: ${platform || 'Instagram'}
- ${objectivesText}
- ${offerText}
- ${problemText}
- ${ctaText}

STRICT CONTENT RULES — NEVER BREAK THESE:
- Hook: 1-2 punchy sentences MAX. Must grab attention in 3 seconds.
- Body: 3-5 short punchy points. No long paragraphs. Each point is 1-2 sentences.
- CTA: 1 clear sentence aligned to the desired audience action above.
- MAXIMUM 150 WORDS TOTAL. Count every word. Stay under 150.
- Each body point on its own line separated by \\n
- Voice: Natural, conversational, authentic. Never robotic or corporate.
- Add exactly 5 relevant SEO hashtags at the end.
- Script messaging must directly address the audience pain points listed above.
- Script structure must serve the content objectives listed above.

SOLUTION DISCLOSURE MANDATE — CRITICAL:
- If the script mentions ANY tool, app, platform, system, workflow, or AI solution, you MUST explicitly name it.
- NEVER write vague references like "an AI tool", "an app", "a system", "automation helped me".
- ALWAYS name the exact product. Example: "NillaFlow Studio™" not "a creator tool".
- The audience must never finish the script wondering what tool or system was mentioned.

MANDATORY SCRIPT STRUCTURE:
1. Problem — what specific pain point from the list above is being addressed?
2. Solution — explicitly name the exact tool, platform, or system used.
3. Mechanism — how does it work? What specific actions does it perform?
4. Outcome — what measurable result occurred?
5. CTA — aligned to the desired audience action specified above.

PROHIBITED CONTENT — NEVER GENERATE:
- "AI helped me" without naming the AI
- "An app changed my life" without naming the app
- "I found a system" without naming the system
- "I automated everything" without naming the automation tool
- Any invented business details, revenue figures, or platform names not provided

SOLUTION STACK REQUIREMENT:
After the script, always include a solution_stack array listing every tool, platform, or system mentioned.

CTA ASSET REQUIREMENT:
Every CTA must have a paired creator_response — the exact response the creator sends when someone comments or DMs.
The creator must never have to search for or create the CTA fulfillment manually.
${complianceBlock}
Return ONLY a JSON object with: title, hook, body, cta, hashtags, solution_stack, creator_response`

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
          content: `Write a ${script_mode || 'educational'} script about: "${topic}". Keep it SHORT, PUNCHY, and platform-native for ${platform || 'Instagram'}.`
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
