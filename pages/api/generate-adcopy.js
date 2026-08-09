import { getStoryContext, buildStoryPromptBlock } from '../../lib/storyContext'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    topic, niche, audience, platform, objective,
    offer_types, audience_problems, cta_objectives,
    user_id, story_objective,
  } = req.body

  if (!topic) return res.status(400).json({ error: 'Topic is required' })

  const story = await getStoryContext(user_id)
  const storyBlock = buildStoryPromptBlock(story, story_objective || 'close_cta')

  // This is the exact case the ad-boost warning was built for - surface it
  // to the user before they spend budget, not as a gate, just a heads-up.
  const adBoostWarning = story?.compliance_flags?.ad_boost_warning_applicable
    ? "This story contains income-related content. Meta's ad reviewers may reject a specific dollar figure in a paid ad even when it's true - consider the system-attribution version for anything you plan to boost."
    : null

  const offerText = offer_types?.length ? offer_types.join(', ') : ''
  const problemText = audience_problems?.length ? audience_problems.join(', ') : ''
  const ctaText = cta_objectives?.length ? cta_objectives.join(', ') : 'Learn more'

  const systemPrompt = `You are NillaFlow Studio™'s Ad Clip Engine — not a generic ad copy tool. You engineer high-retention, high-conversion video ads at an Instagram/Meta premium creator level, operating as a Copywriter: tight, conversion-focused writing where every word earns its place.

TOPIC: ${topic}
NICHE: ${niche || 'not specified'}
AUDIENCE: ${audience || 'not specified'}
OBJECTIVE: ${objective || 'conversions'}
${offerText ? `WHAT'S BEING PROMOTED: ${offerText}\n` : ''}${problemText ? `AUDIENCE PAIN POINTS: ${problemText}\n` : ''}DESIRED ACTION: ${ctaText}
${storyBlock}

THE FIRST 3 SECONDS DECIDE EVERYTHING. Before writing anything else, engineer the video hook using ONE of these proven pattern-interrupt mechanics - pick whichever fits the topic and story context best:
- Contradiction hook: state something that seems to contradict itself or common belief ("I spent 27 years becoming an expert, then quit using any of it")
- Cold-open mid-story: drop the viewer into the middle of a specific moment, no setup ("The day I almost didn't take the shift...")
- Direct callout + confession: name the exact viewer, then admit something unexpected ("If you're a nurse reading this at 2am between patients — here's what I wish someone told me")
- Curiosity gap: promise a specific reveal without giving it away yet ("There's one number my old paycheck could never hit. Here's what changed.")
A hook that could apply to any creator in any niche is a FAILED hook. It must be impossible to write without this specific person's story.

RETENTION MECHANICS after the hook: use pattern interrupts every 2-3 sentences (a stat, a contradiction, a direct question, a tonal shift) - viral video ads lose viewers to flat, unbroken paragraphs. Build genuine emotional escalation: tension/pain first, then the turn, then the proof, then the invitation. This is not a features list - it's a felt experience compressed into seconds.

COPYWRITING FORMULA: structure the primary text using Problem-Agitate-Solution or a comparable proven direct-response structure - name the problem specifically, agitate why it actually hurts (not generically, tied to the real audience pain points above), then position the solution as the natural next step, not a hard pitch.

META AD FORMAT - these are HARD LIMITS, not aspirational targets. Primary Text that runs to full paragraphs is a FAILED output, even if the content is good - long text kills scroll-stopping performance, which defeats the entire purpose of this tool:
- Video Hook: the first spoken/on-screen line only, under 15 words, this is what plays in the first 3 seconds
- Primary Text: 2-3 SHORT sentences MAXIMUM, targeting 125 characters, absolute hard cap 200 characters. If you cannot say it in 2-3 short sentences, cut content, do not run longer. This is ad copy, not a script - every unnecessary word costs performance.
- Headline: under 40 characters
- Description: under 30 characters

Before finalizing each variant, count the primary_text length. If any variant exceeds 200 characters, rewrite it shorter before returning your answer - do not return long-form copy.

Generate 3 DISTINCT hook mechanics (not 3 versions of the same angle - use 3 different mechanics from the list above), each with its own matching primary text and headline, so each variant is a complete, internally consistent ad concept, not mixed-and-matched pieces.

AUTO-COMPLIANCE: If topic mentions affiliate, franchise, business opportunity, passive income, or earnings — automatically apply all prohibitions. Use transformation language and freedom language only.
BUSINESS MODEL FRAMING: This business is not a traditional MLM/pyramid structure - no sales quotas, no perpetual upline override (caps at level 4, after which a downline's commission is entirely their own), and a downline can rank and earn above their upline. "This isn't MLM" framing is permitted based on these facts - state it plainly if relevant, never explain the mechanics in ad copy.
NEVER use a specific dollar income figure in ad copy, even a true one - this is a hard line in this placement specifically, since Meta's reviewers enforce this independently. Use system-attribution outcome language instead.
NEVER guarantee a specific future outcome. A pattern-interrupt hook must never cross into shock content, fear-mongering, or misleading clickbait that the body copy doesn't deliver on.

Return ONLY a raw JSON object, no markdown, no backticks:
{
  "variants": [
    {
      "hook_mechanic": "which mechanic this uses (contradiction / cold-open / direct-callout / curiosity-gap)",
      "video_hook": "the first 3-second line",
      "primary_text": "full primary text using this hook",
      "headline": "matching headline"
    },
    { "hook_mechanic": "...", "video_hook": "...", "primary_text": "...", "headline": "..." },
    { "hook_mechanic": "...", "video_hook": "...", "primary_text": "...", "headline": "..." }
  ],
  "description": "...",
  "recommended_pairing": "one sentence on which full variant to test first and why, specifically what makes its hook mechanic strongest for this audience"
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Generate ad copy for: ${topic}` }],
      }),
    })

    const data = await response.json()
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI' })
    }

    const raw = data.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse ad copy' })
    }

    const result = JSON.parse(jsonMatch[0])

    return res.status(200).json({
      ...result,
      ad_boost_warning: adBoostWarning,
    })

  } catch (error) {
    console.error('Ad copy generation error:', error)
    return res.status(500).json({ error: 'Failed to generate ad copy. Please try again.' })
  }
}
