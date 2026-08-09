import { getStoryContext } from '../../lib/storyContext'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Called by ReplyRush (or any Meta-comment webhook source) after it catches
// a comment via its already-approved Meta permissions. This route never
// talks to Meta directly - it receives comment text, returns a reply,
// and ReplyRush posts it. No new Meta App Review needed for this piece.

const VALID_OBJECTIONS = ['fear_of_failure', 'no_time', 'no_money', 'tried_before']
const CONFIDENCE_THRESHOLD = 0.6

function buildClassificationPrompt(commentText, story) {
  const objectionLibrary = story?.story_beats?.doubt?.derived_assets?.objection_reply_library || []
  const curiosityCtas = story?.story_beats?.discovery?.derived_assets?.curiosity_cta_variants || []
  const closeCtas = story?.story_beats?.reassurance?.derived_assets?.cta_variants || []
  const origin = story?.story_beats?.origin?.enhanced_narrative || ''

  return `You are the Intent Engine inside NillaFlow Studio™, replying to a comment on behalf of a creator.

COMMENT TO CLASSIFY AND REPLY TO:
"${commentText}"

CREATOR'S STORY ASSETS AVAILABLE TO DRAW FROM:
${origin ? `Origin story: ${origin}` : '(no origin story on file)'}

Objection reply library (use these VERBATIM as the grounding for objection replies - do not invent new angles):
${objectionLibrary.length > 0 ? JSON.stringify(objectionLibrary, null, 2) : '(none available)'}

Curiosity CTAs (for interest/questions):
${curiosityCtas.length > 0 ? JSON.stringify(curiosityCtas) : '(none available)'}

Close CTAs (for ready-to-act signals):
${closeCtas.length > 0 ? JSON.stringify(closeCtas) : '(none available)'}

YOUR JOB:
1. Classify the comment's intent: interest | objection | question | social_proof_request | off_topic | spam
2. If intent is "objection", identify which objection_type it matches: fear_of_failure | no_time | no_money | tried_before | none
3. Give a confidence score 0.0-1.0 for your classification
4. If confidence >= ${CONFIDENCE_THRESHOLD} AND a matching asset exists above, write a short, natural,
   conversational reply that draws on the matched asset - reworded to respond to THIS specific
   comment, not pasted verbatim. Reference what they actually said. Keep it short - this is a
   comment reply, not a caption.
5. If confidence < ${CONFIDENCE_THRESHOLD}, OR intent is off_topic/spam, OR no matching asset exists
   for an objection, do NOT write a reply - this comment needs a human.

AUTO-COMPLIANCE: Never use passive/automated income framing in any reply. Never state or imply
a guaranteed outcome. If the matched asset itself contains a dollar figure, keep the
system-attribution framing intact - do not strip it into a bare number. Business model framing:
"not MLM" framing is permitted (internally grounded: no quotas, capped override, downline can
outrank upline) but state it plainly in a reply without explaining override mechanics or level
numbers - that detail belongs in the webinar, not a comment reply.

Return ONLY a raw JSON object, no markdown, no backticks. Required keys:
classified_intent, objection_type, confidence, reply_text (string or null), needs_human_reply (boolean)`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id, comment_text, comment_id, platform } = req.body

  if (!user_id || !comment_text) {
    return res.status(400).json({ error: 'user_id and comment_text are required' })
  }

  const story = await getStoryContext(user_id)

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
        max_tokens: 600,
        system: buildClassificationPrompt(comment_text, story),
        messages: [{
          role: 'user',
          content: `Classify and reply to: "${comment_text}"`,
        }],
      }),
    })

    const data = await response.json()
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI' })
    }

    const raw = data.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse intent classification' })
    }

    const result = JSON.parse(jsonMatch[0])

    // Server-side guardrails, not just trusting the model's own gate:
    const validObjection = VALID_OBJECTIONS.includes(result.objection_type)
    const lowConfidence = (result.confidence ?? 0) < CONFIDENCE_THRESHOLD
    const badIntent = ['off_topic', 'spam'].includes(result.classified_intent)
    const objectionWithNoValidType = result.classified_intent === 'objection' && !validObjection

    const needsHuman = result.needs_human_reply || lowConfidence || badIntent || objectionWithNoValidType

    // Log every classification - both for the audit trail and so the
    // "needs a human" queue is a real, queryable list, not just a
    // one-off response the caller has to remember to store themselves.
    try {
      const supabase = getServiceClient()
      await supabase.from('comment_intent_log').insert({
        user_id,
        comment_id: comment_id || null,
        platform: platform || null,
        comment_text,
        classified_intent: result.classified_intent,
        objection_type: validObjection ? result.objection_type : null,
        confidence: result.confidence,
        reply_text: needsHuman ? null : result.reply_text,
        needs_human_reply: needsHuman,
      })
    } catch (logError) {
      // Logging failure should never block the actual reply from returning
      console.error('Comment log insert failed:', logError)
    }

    return res.status(200).json({
      comment_id: comment_id || null,
      platform: platform || null,
      classified_intent: result.classified_intent,
      objection_type: validObjection ? result.objection_type : null,
      confidence: result.confidence,
      reply_text: needsHuman ? null : result.reply_text,
      needs_human_reply: needsHuman,
    })

  } catch (error) {
    console.error('Intent engine error:', error)
    return res.status(500).json({ error: 'Failed to process comment. Please try again.' })
  }
}
