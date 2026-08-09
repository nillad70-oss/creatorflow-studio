import { getStoryContext, buildStoryPromptBlock } from '../../lib/storyContext'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { script, style, niche, platform, user_id, story_objective } = req.body

  if (!script) {
    return res.status(400).json({ error: 'Script is required' })
  }

  const story = await getStoryContext(user_id)
  const storyBlock = buildStoryPromptBlock(story, story_objective || 'close_cta')

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
- Explaining override mechanics, level numbers, or compensation structure details in a caption. "This isn't MLM" framing is permitted (internally grounded in verified facts: no quotas, capped override, downline can outrank upline) but state it plainly without elaborating on the mechanics - that explanation belongs in the webinar, not a caption.
- "AI helped me" without naming the AI
- "An app changed everything" without naming the app
- "I found a system" without naming the system
${storyBlock ? `\n${storyBlock}\nUse the creator's real story above for the CTA and any personal framing in this caption - not generic language.\n` : ''}
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
    if (!response.ok || !data.content) {
      console.error('Anthropic API error:', JSON.stringify(data))
      return res.status(500).json({ error: data.error?.message || 'AI API request failed' })
    }
    const text = data.content[0].text
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleaned)
    return res.status(200).json({ caption: result.caption + '\n\n' + (Array.isArray(result.hashtags) ? result.hashtags.join(' ') : result.hashtags), solution_stack: result.solution_stack, creator_response: result.creator_response })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate caption. Please try again.' })
  }
}