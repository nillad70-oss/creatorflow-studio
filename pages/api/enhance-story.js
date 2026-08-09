import { createClient } from '@supabase/supabase-js'

// Service-role client — this route runs after the user already saved their
// own story via build-story.js (RLS-protected insert). This job only ever
// touches the story_id it's handed, so service role here is scoped by logic,
// not by trusting arbitrary input.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const BEAT_CONFIG = {
  origin: {
    conversion_function: 'trust_relatability',
    assetInstructions: `Generate:
- hook_variants: array of 3 hooks, each under 12 words, scroll-stopping
- reel_opening_lines: array of 2 lines a person could say as the first line of a reel`,
  },
  rupture: {
    conversion_function: 'pain_agitation',
    assetInstructions: `Generate:
- pain_point_tags: array of short tags naming the pain described (e.g. "missed_family_time", "burnout", "financial_scare")
- audience_match_signal: one sentence describing who else would recognize this pain`,
  },
  realization: {
    conversion_function: 'problem_awareness',
    assetInstructions: `Generate:
- bridge_lines: array of 2 lines connecting this realization toward considering a different path`,
  },
  discovery: {
    conversion_function: 'offer_introduction',
    assetInstructions: `Generate:
- soft_pitch_lines: array of 2 lines introducing the opportunity without hard-selling
- curiosity_cta_variants: array of 2 curiosity-driven calls to action (not "buy now" - more "want to see how")`,
  },
  doubt: {
    conversion_function: 'objection_handling',
    assetInstructions: `Generate:
- objection_reply_library: array of objects, each { objection_type, reply_variant }.
  objection_type must be one of: fear_of_failure, no_time, no_money, tried_before.
  Only include objection_types that are actually grounded in what the person described -
  do not invent objections they didn't imply. Minimum 1, maximum 4 entries.`,
  },
  reassurance: {
    conversion_function: 'cta_close',
    assetInstructions: `Generate:
- cta_variants: array of 3 calls to action, graduated from soft ("comment a keyword") to direct ("book a call / register for the webinar")`,
  },
}

const COMPLIANCE_RULES = `
AUTO-COMPLIANCE: If the raw answer mentions affiliate income, franchise, business opportunity, commissions, or a specific dollar figure — automatically rewrite using system-attribution language, never passive/automated framing. Never use phrases like "the system worked itself," "on autopilot," "passive income," or "while I did nothing." Attribute any result to a system the person built and still actively operates. Never state or imply a guaranteed future outcome ("you will make X").
HALLUCINATION PREVENTION: Only use details the person actually provided in their raw answer. Never invent events, numbers, or specifics not present in the source text.
`

async function enhanceBeat(beatKey, rawAnswer, goalType) {
  const config = BEAT_CONFIG[beatKey]

  const systemPrompt = `You are the Story Intake enhancement engine inside NillaFlow Studio™.
You are processing the "${beatKey}" beat of a user's personal story.
Goal type context: ${goalType || 'not specified'}

${COMPLIANCE_RULES}

Your job has two parts:

1. enhanced_narrative: Rewrite the raw answer into 2-4 sentences of authentic,
first-person narrative. Keep it in the person's own voice - conversational,
not corporate. Do not add details they didn't give you.

2. derived_assets: ${config.assetInstructions}

You MUST return ONLY a raw JSON object. No markdown, no backticks, no explanation.
Response must start with { and end with }
Required keys: enhanced_narrative, derived_assets, income_figure_present (boolean),
auto_rewritten_to_system_attribution (boolean)`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Raw answer for the "${beatKey}" beat:\n\n"${rawAnswer}"`,
      }],
    }),
  })

  const data = await response.json()
  if (!data.content || !data.content[0]) {
    throw new Error(`No AI response for beat: ${beatKey}`)
  }

  const raw = data.content[0].text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Failed to parse enhancement for beat: ${beatKey}`)
  }

  return JSON.parse(jsonMatch[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { story_id } = req.body
  if (!story_id) return res.status(400).json({ error: 'story_id is required' })

  const supabase = getServiceClient()

  const { data: story, error: fetchError } = await supabase
    .from('story_profiles')
    .select('*')
    .eq('id', story_id)
    .single()

  if (fetchError || !story) {
    return res.status(404).json({ error: 'Story not found' })
  }

  const updatedBeats = { ...story.story_beats }
  let anyIncomeFigurePresent = false

  try {
    // Run beats sequentially to keep this simple and avoid rate-limit bursts.
    // Can be parallelized with Promise.all later if latency becomes an issue.
    for (const beatKey of Object.keys(BEAT_CONFIG)) {
      const rawAnswer = updatedBeats[beatKey]?.raw_answer || ''
      if (!rawAnswer.trim()) continue

      const result = await enhanceBeat(beatKey, rawAnswer, story.goal_type)

      if (result.income_figure_present) anyIncomeFigurePresent = true

      updatedBeats[beatKey] = {
        ...updatedBeats[beatKey],
        enhanced_narrative: result.enhanced_narrative,
        conversion_function: BEAT_CONFIG[beatKey].conversion_function,
        derived_assets: result.derived_assets,
      }
    }

    const compliance_flags = {
      income_figure_present: anyIncomeFigurePresent,
      auto_rewritten_to_system_attribution: anyIncomeFigurePresent,
      ad_boost_warning_applicable: anyIncomeFigurePresent,
    }

    const { error: updateError } = await supabase
      .from('story_profiles')
      .update({
        story_beats: updatedBeats,
        compliance_flags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', story_id)

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json({ success: true, story_id, compliance_flags })

  } catch (error) {
    console.error('Story enhancement error:', error)
    return res.status(500).json({ error: 'Failed to enhance story. Please try again.' })
  }
}
