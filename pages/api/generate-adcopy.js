import { getStoryContext, buildStoryPromptBlock } from '../../lib/storyContext'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Fetches an asset's cached analysis if one is provided. Returns null if no
// asset_id was passed, or if the asset/analysis isn't found - callers must
// treat this as fully optional, never required, so existing single-shot
// generation with no asset continues to behave exactly as before.
// Fetches cached analyses for multiple assets, in the order provided, so they
// can be read as a sequence (e.g. stills from one video) rather than isolated
// images. Returns an empty array if no asset_ids were passed - callers must
// treat this as fully optional, same as story context.
async function getAssetContext(asset_ids, user_id) {
  if (!asset_ids || asset_ids.length === 0) return []
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('assets')
    .select('id, ai_analysis')
    .in('id', asset_ids)
    .eq('user_id', user_id)
  if (error || !data) return []
  // Preserve the order the user attached them in, not the DB return order
  return asset_ids
    .map(id => data.find(d => d.id === id))
    .filter(d => d?.ai_analysis)
    .map(d => d.ai_analysis)
}

function buildAssetPromptBlock(analyses, storyNote) {
  if (!analyses || analyses.length === 0) return ''

  const describeOne = (a) =>
    `Description: ${a.description}\nSetting: ${a.setting || 'not specified'}\nWardrobe/styling: ${a.wardrobe_or_styling || 'n/a'}\nMood: ${a.mood}\nLifestyle signals: ${a.lifestyle_signals || 'not specified'}\nNotable details: ${(a.notable_details || []).join(', ')}`

  const noteBlock = storyNote
    ? `\nTHE CREATOR TOLD YOU DIRECTLY WHAT THESE IMAGES MEAN - THIS TAKES PRIORITY OVER YOUR OWN VISUAL READ:\n"${storyNote}"\nUse this as the primary lens for interpreting the images. If an image seems visually unrelated to the others (different setting, different subject), do NOT flag it as an outlier or exclude it - the creator has already told you why it belongs. Ground the copy in the meaning they gave you, using the visual details below as supporting texture, not as the thing you're guessing the connection from.\n`
    : ''

  if (analyses.length === 1) {
    const a = analyses[0]
    return `\nUPLOADED IMAGE - REQUIRED CREATIVE CONTEXT:\n${describeOne(a)}\n${noteBlock}\nVISUAL GROUNDING REQUIREMENT: The ad copy MUST reference at least one concrete visual detail from this image (setting, styling, mood, or a notable detail) - not just a generic theme that could apply to any photo. Write as if you are looking directly at this image.\n`
  }

  const sequence = analyses.map((a, i) => `--- Still ${i + 1} ---\n${describeOne(a)}`).join('\n\n')
  const outlierInstruction = storyNote
    ? `Since the creator already explained what connects these images, treat all ${analyses.length} as one story per their explanation above - do not second-guess it with your own outlier detection.`
    : `FIRST, determine the visual story: do these stills form ONE coherent narrative/theme, or does one or more stand apart from the rest? Be honest - do not force a false connection between images that don't actually belong together. If most stills share a clear theme but one is a clear outlier, name that explicitly rather than pretending they're all one story.`

  return `\nUPLOADED IMAGE SEQUENCE - REQUIRED CREATIVE CONTEXT (${analyses.length} stills, in the order uploaded):\n${sequence}\n${noteBlock}\n${outlierInstruction}\n\nVISUAL GROUNDING REQUIREMENT: The ad copy MUST reference concrete visual details from the images (setting, styling, mood, specific actions or objects) - not a generic theme that ignores what's actually shown. State your approach in visual_story_synthesis below.\n`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    topic, niche, audience, platform, objective,
    offer_types, audience_problems, cta_objectives,
    user_id, story_objective, asset_ids, asset_story_note,
  } = req.body

  if (!topic) return res.status(400).json({ error: 'Topic is required' })

  const story = await getStoryContext(user_id)
  const storyBlock = buildStoryPromptBlock(story, story_objective || 'close_cta')

  const assetAnalyses = await getAssetContext(asset_ids, user_id)
  const assetBlock = buildAssetPromptBlock(assetAnalyses, asset_story_note)

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
${storyBlock}${assetBlock}
${(storyBlock && assetBlock) ? `CONNECT THE STORY AND THE IMAGES - THIS IS NOT OPTIONAL: The story context and the uploaded images are about the SAME PERSON'S SAME LIFE. Read them together the way an attentive friend would, not as two separate inputs. If the story describes a "before" (missed time, no room for herself, working shifts that ate every hour) and the images show a "now" (leisure, family meals, flowers, free time), that contrast IS the visual story - connect it yourself, automatically, the way a person naturally would. Do not wait for an explicit note spelling out the connection before you're willing to make it. If a story note is also provided above, treat it as confirmation and extra specificity, not as the only source of the connection - you should already be seeing it from the story and images alone.` : ''}

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
- Primary Text: 2 SHORT sentences MAXIMUM, targeting 100 characters, absolute hard cap 200 characters. If you cannot say it in 2 short sentences, cut content, do not run longer. This is ad copy, not a script - every unnecessary word costs performance.
- Headline: under 40 characters
- Description: under 30 characters

Before finalizing each variant, count the primary_text length. If any variant exceeds 200 characters, rewrite it shorter before returning your answer - do not return long-form copy.

Generate 3 DISTINCT hook mechanics (not 3 versions of the same angle - use 3 different mechanics from the list above), each with its own matching primary text and headline, so each variant is a complete, internally consistent ad concept, not mixed-and-matched pieces.

AUTO-COMPLIANCE: If topic mentions affiliate, franchise, business opportunity, passive income, or earnings — automatically apply all prohibitions. Use transformation language and freedom language only.
BUSINESS MODEL FRAMING: This business is not a traditional MLM/pyramid structure - no sales quotas, no perpetual upline override (caps at level 4, after which a downline's commission is entirely their own), and a downline can rank and earn above their upline. "This isn't MLM" framing is permitted based on these facts - state it plainly if relevant, never explain the mechanics in ad copy.
NEVER use a specific dollar income figure in ad copy, even a true one - this is a hard line in this placement specifically, since Meta's reviewers enforce this independently. Use system-attribution outcome language instead.
NEVER guarantee a specific future outcome. A pattern-interrupt hook must never cross into shock content, fear-mongering, or misleading clickbait that the body copy doesn't deliver on.

${assetAnalyses.length > 0 ? `CRITICAL - THE SYNTHESIS MUST ACTUALLY BE USED, NOT JUST STATED: You are about to write a visual_story_synthesis field describing what's in the images. That synthesis is not decoration - every one of the 3 variants below MUST include at least one concrete, specific visual element from it (name the actual thing: the flowing blue dress, the garden path, the pink flowering trees, the plated meal - not a vague paraphrase like "your lifestyle" or "what you've built"). Before you finalize your answer, check each variant's video_hook and primary_text against your own visual_story_synthesis - if a variant could have been written without ever seeing the images, rewrite it. A variant that only uses story context (career, shifts, expertise) with zero visual detail is a FAILED variant when images are present.\n` : ''}
Return ONLY a raw JSON object, no markdown, no backticks:
{${assetAnalyses.length > 0 ? `
  "visual_story_synthesis": "2-3 sentences: what is the visual story across the uploaded image(s)? Name the actual coherent theme (setting, styling, mood, activity). If one image is an outlier that doesn't fit, say so explicitly and explain how you handled it in the copy below.",` : ''}
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

    // Server-side enforcement, not just prompt instruction - the model doesn't
    // reliably self-police its own length. Truncate at the last sentence
    // boundary under 200 chars if possible, otherwise hard-cut with ellipsis.
    const enforceLength = (text) => {
      if (!text || text.length <= 200) return text
      const truncated = text.slice(0, 200)
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? ')
      )
      if (lastSentenceEnd > 100) return truncated.slice(0, lastSentenceEnd + 1)
      return truncated.slice(0, 197).trim() + '...'
    }

    if (Array.isArray(result.variants)) {
      result.variants = result.variants.map(v => ({
        ...v,
        primary_text: enforceLength(v.primary_text),
      }))
    }

    return res.status(200).json({
      ...result,
      ad_boost_warning: adBoostWarning,
    })

  } catch (error) {
    console.error('Ad copy generation error:', error)
    return res.status(500).json({ error: 'Failed to generate ad copy. Please try again.' })
  }
}
