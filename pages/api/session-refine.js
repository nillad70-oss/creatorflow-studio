import { createClient } from '@supabase/supabase-js'
import { getStoryContext, buildStoryPromptBlock } from '../../lib/storyContext'
import { getAssetContext, buildAssetPromptBlock } from '../../lib/assetContext'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const enforceLength = (text, max = 200) => {
  if (!text || text.length <= max) return text
  const truncated = text.slice(0, max)
  const lastEnd = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '))
  if (lastEnd > max / 2) return truncated.slice(0, lastEnd + 1)
  return truncated.slice(0, max - 3).trim() + '...'
}

const checkGrounded = (claimedElement, copyText) => {
  const claimed = (claimedElement || '').toLowerCase().trim()
  const text = (copyText || '').toLowerCase()
  const keyWords = claimed.split(/\s+/).filter(w => w.length > 3)
  return claimed.length > 0 && claimed !== 'n/a' && keyWords.some(w => text.includes(w))
}

const SCHEMA_BY_TYPE = {
  adcopy: {
    label: "NillaFlow Studio™'s Ad Clip Engine",
    schemaDescription: `variants (each with hook_mechanic, video_hook, primary_text, headline, and visual_element_used if images are present), description, recommended_pairing, and visual_story_synthesis if images are present`,
    extraRules: `- Primary Text stays under 200 characters, 2 short sentences max\n- Never use a specific dollar income figure, even a true one`,
  },
  script: {
    label: "NillaFlow Studio™'s content engine",
    schemaDescription: `title, hook, body, cta, hashtags, solution_stack, creator_response, and visual_story_synthesis/visual_element_used if images are present`,
    extraRules: `- Total body stays under 600 characters\n- Exactly 5 hashtags`,
  },
  captions: {
    label: "NillaFlow Studio™'s caption engine",
    schemaDescription: `caption, solution_stack, creator_response, hashtags, and visual_story_synthesis/visual_element_used if images are present`,
    extraRules: `- Exactly 5 hashtags\n- Name any tool/app/system explicitly, never vaguely`,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { session_id, user_id, feedback_message } = req.body

  if (!session_id || !user_id || !feedback_message) {
    return res.status(400).json({ error: 'session_id, user_id, and feedback_message are required' })
  }

  const supabase = getServiceClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', user_id)
    .single()

  if (!userRow || userRow.subscription_tier !== 'pro') {
    return res.status(403).json({ error: 'Conversational refinement is a Pro subscriber feature.' })
  }

  const { data: session, error: sessionError } = await supabase
    .from('creative_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', user_id)
    .single()

  if (sessionError || !session) {
    return res.status(404).json({ error: 'Session not found or not owned by this user' })
  }

  const sessionType = session.session_type || 'adcopy'
  const typeConfig = SCHEMA_BY_TYPE[sessionType] || SCHEMA_BY_TYPE.adcopy

  const { data: history, error: historyError } = await supabase
    .from('session_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })

  if (historyError || !history) {
    return res.status(500).json({ error: 'Failed to load conversation history' })
  }

  const ctx = session.context_snapshot || {}
  const story = await getStoryContext(user_id)
  const storyBlock = buildStoryPromptBlock(story, ctx.story_objective || 'close_cta')
  const assetAnalyses = await getAssetContext(ctx.asset_ids, user_id)
  const assetBlock = buildAssetPromptBlock(assetAnalyses, ctx.asset_story_note, sessionType === 'adcopy' ? 'ad' : sessionType)

  const systemPrompt = `You are ${typeConfig.label}, continuing a REVISION conversation with a subscriber about content you already generated. This is not a fresh generation - it's a refinement of the existing result based on their feedback.

ORIGINAL CONTEXT:
Topic: ${ctx.topic}
Niche: ${ctx.niche || 'not specified'}
Audience: ${ctx.audience || 'not specified'}
${ctx.objective ? `Objective: ${ctx.objective}` : ''}
${storyBlock}${assetBlock}

RULES THAT STILL APPLY, EVEN WHILE REVISING:
- Keep the same output schema: ${typeConfig.schemaDescription}
${typeConfig.extraRules}
- "This isn't MLM" framing is permitted (no quotas, override caps at level 4, downline can outrank upline) but state plainly, never explain mechanics
- If images are present, grounding in concrete visual detail is still required - a revision that drops visual grounding to satisfy other feedback is not acceptable, find a way to do both
- Apply the specific feedback in the latest user message to revise the MOST RECENT assistant result in the conversation - don't regenerate from scratch, actually revise what's there

Return ONLY a raw JSON object matching the schema above, no markdown, no backticks.`

  const messages = history.map(m => ({ role: m.role, content: m.content }))
  messages.push({ role: 'user', content: feedback_message })

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
        max_tokens: 1500,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await response.json()
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI' })
    }

    const raw = data.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse revision' })
    }

    const result = JSON.parse(jsonMatch[0])

    if (sessionType === 'adcopy' && Array.isArray(result.variants)) {
      result.variants = result.variants.map(v => {
        const updated = { ...v, primary_text: enforceLength(v.primary_text) }
        if (assetAnalyses.length > 0) {
          updated.visually_grounded = checkGrounded(v.visual_element_used, `${v.video_hook || ''} ${v.primary_text || ''}`)
        }
        return updated
      })
    } else if (sessionType === 'script') {
      result.body = enforceLength(result.body, 600)
      if (assetAnalyses.length > 0) {
        result.visually_grounded = checkGrounded(result.visual_element_used, `${result.hook || ''} ${result.body || ''}`)
      }
    } else if (sessionType === 'captions') {
      if (assetAnalyses.length > 0) {
        result.visually_grounded = checkGrounded(result.visual_element_used, result.caption || '')
      }
    }

    await supabase.from('session_messages').insert([
      { session_id, role: 'user', content: feedback_message },
      { session_id, role: 'assistant', content: JSON.stringify(result) },
    ])

    return res.status(200).json({ session_id, session_type: sessionType, ...result })

  } catch (error) {
    console.error('Session refinement error:', error)
    return res.status(500).json({ error: 'Failed to revise. Please try again.' })
  }
}
