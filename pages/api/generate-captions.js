export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { script, style, niche, platform } = req.body

  if (!script) {
    return res.status(400).json({ error: 'Script is required' })
  }

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
        system: `You are an expert social media caption writer for ${niche || 'general'} creators on ${platform || 'instagram'} for NillaFlow Studio™.

SOLUTION DISCLOSURE MANDATE — CRITICAL:
- If the caption mentions ANY tool, app, platform, system, or AI solution, you MUST explicitly name it.
- NEVER write vague references like "an AI tool" or "a system". Always name the exact product.

MANDATORY CAPTION STRUCTURE:
1. Hook — stop the scroll in 3 seconds
2. Problem — what specific problem existed
3. Solution — explicitly name the exact tool or system used
4. Outcome — what measurable result occurred
5. CTA — paired with a creator response asset

PROHIBITED CONTENT:
- "AI helped me" without naming the AI
- "An app changed everything" without naming the app
- "I found a system" without naming the system

Return ONLY a JSON object with: caption, solution_stack, creator_response, hashtags
- caption: the full caption text
- solution_stack: array of tools mentioned
- creator_response: exact response to send when someone engages
- hashtags: exactly 5 relevant hashtags`,
        messages: [{
          role: 'user',
          content: `Write a ${style} caption for this script for ${niche || 'general'} creators on ${platform || 'instagram'}.\n\nScript:\n${script}`
        }],
      }),
    })

    const data = await response.json()
    const text = data.content[0].text
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleaned)
    return res.status(200).json({ caption: result.caption + '\n\n' + (Array.isArray(result.hashtags) ? result.hashtags.join(' ') : result.hashtags), solution_stack: result.solution_stack, creator_response: result.creator_response })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate caption. Please try again.' })
  }
}