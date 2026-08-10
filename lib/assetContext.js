import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Fetches cached analyses for multiple assets, in the order provided.
// Returns [] if no asset_ids were passed - callers must treat this as
// fully optional, never required, so existing single-shot generation
// with no asset continues to behave exactly as before.
export async function getAssetContext(asset_ids, user_id) {
  if (!asset_ids || asset_ids.length === 0) return []
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('assets')
    .select('id, ai_analysis')
    .in('id', asset_ids)
    .eq('user_id', user_id)
  if (error || !data) return []
  return asset_ids
    .map(id => data.find(d => d.id === id))
    .filter(d => d?.ai_analysis)
    .map(d => d.ai_analysis)
}

// Builds the prompt block for image context. contentType shapes the
// instruction language slightly ('script'/'caption' vs 'ad') without
// changing the underlying grounding requirement.
export function buildAssetPromptBlock(analyses, storyNote, contentType = 'content') {
  if (!analyses || analyses.length === 0) return ''

  const describeOne = (a) =>
    `Description: ${a.description}\nSetting: ${a.setting || 'not specified'}\nWardrobe/styling: ${a.wardrobe_or_styling || 'n/a'}\nMood: ${a.mood}\nLifestyle signals: ${a.lifestyle_signals || 'not specified'}\nNotable details: ${(a.notable_details || []).join(', ')}`

  const noteBlock = storyNote
    ? `\nTHE CREATOR TOLD YOU DIRECTLY WHAT THESE IMAGES MEAN - THIS TAKES PRIORITY OVER YOUR OWN VISUAL READ:\n"${storyNote}"\nUse this as the primary lens for interpreting the images. If an image seems visually unrelated to the others, do NOT flag it as an outlier - the creator has already told you why it belongs.\n`
    : ''

  const groundingReq = `VISUAL GROUNDING REQUIREMENT: This ${contentType} MUST reference at least one concrete visual detail from the image(s) above (setting, styling, mood, or a notable detail) - not a generic theme that could apply to any photo. Write as if you are looking directly at the image(s).`

  if (analyses.length === 1) {
    return `\nUPLOADED IMAGE - REQUIRED CREATIVE CONTEXT:\n${describeOne(analyses[0])}\n${noteBlock}\n${groundingReq}\n`
  }

  const sequence = analyses.map((a, i) => `--- Still ${i + 1} ---\n${describeOne(a)}`).join('\n\n')
  const outlierInstruction = storyNote
    ? `Since the creator already explained what connects these images, treat all ${analyses.length} as one story per their explanation above.`
    : `FIRST, determine the visual story: do these stills form ONE coherent narrative, or does one stand apart? Be honest - name a clear outlier rather than forcing a false connection.`

  return `\nUPLOADED IMAGE SEQUENCE - REQUIRED CREATIVE CONTEXT (${analyses.length} stills, in order):\n${sequence}\n${noteBlock}\n${outlierInstruction}\n\n${groundingReq}\n`
}

// The instruction that connects story context and image context together,
// so the model doesn't treat them as two unrelated inputs. Only fires when
// both are actually present.
export function buildStoryImageSynthesisInstruction(storyBlock, assetBlock) {
  if (!storyBlock || !assetBlock) return ''
  return `\nCONNECT THE STORY AND THE IMAGES - THIS IS NOT OPTIONAL: The story context and the uploaded images are about the SAME PERSON'S SAME LIFE. Read them together the way an attentive friend would. If the story describes a "before" (missed time, no room for herself, working shifts) and the images show a "now" (leisure, family meals, flowers, free time), that contrast IS the visual story - connect it yourself, automatically. Do not wait for an explicit note spelling out the connection.\n`
}
