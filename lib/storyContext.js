import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Returns the user's current story (via the get_current_story() SQL function),
// or null if they haven't built one yet. Callers must handle the null case
// and fall back to their existing non-story behavior - story context is an
// enhancement, never a requirement to generate content.
export async function getStoryContext(user_id) {
  if (!user_id) return null

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .rpc('get_current_story', { p_user_id: user_id })

  if (error || !data || data.length === 0) return null
  return data[0] // { id, goal_type, voice_track, story_beats, compliance_flags }
}

// Builds a compact text block for a specific objective, pulling only the
// beats relevant to it - matches the objective -> beat routing table from
// the Content Engine Wiring spec. Returns '' if no usable content exists,
// so callers can safely concatenate it into a prompt either way.
const OBJECTIVE_BEATS = {
  trust_build: ['origin'],
  pain_match: ['rupture'],
  soft_pitch: ['realization', 'discovery'],
  objection_response: ['doubt'],
  close_cta: ['reassurance'],
  full_story: ['origin', 'rupture', 'realization', 'discovery', 'doubt', 'reassurance'],
}

export function buildStoryPromptBlock(story, objective = 'full_story') {
  if (!story || !story.story_beats) return ''

  const beatKeys = OBJECTIVE_BEATS[objective] || OBJECTIVE_BEATS.full_story
  let block = `\nCREATOR'S REAL STORY (use this - do not invent details outside it):\n`
  let hasContent = false

  beatKeys.forEach((key) => {
    const beat = story.story_beats[key]
    if (beat?.enhanced_narrative) {
      hasContent = true
      block += `- ${key}: ${beat.enhanced_narrative}\n`
    }
    if (beat?.derived_assets && Object.keys(beat.derived_assets).length > 0) {
      block += `  usable assets: ${JSON.stringify(beat.derived_assets)}\n`
    }
  })

  if (story.goal_type) block += `Goal type: ${story.goal_type}\n`

  return hasContent ? block : ''
}
