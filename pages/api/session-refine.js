import { createClient } from '@supabase/supabase-js'
import { getStoryContext, buildStoryPromptBlock } from '../../lib/storyContext'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Rebuilds the same asset context helper used in generate-adcopy.js, kept
// local here to avoid a cross-file import of a non-exported function.
async function getAssetContext(asset_ids, user_id) {
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

function buildAssetPromptBlock(analyses, storyNote) {
  if (!analyses || analyses.length === 0) return ''
  const describeOne = (a) =>
    `Description: ${a.description}\nSetting: ${a.setting || 'not specified'}\nWardrobe/styling: ${a.wardrobe_or_styling || 'n/a'}\nMood: ${a.mood}\nLifestyle signals: ${a.lifestyle_signals || 'not specified'}\nNotable details: ${(a.notable_details || []).join(', ')}`
  const noteBlock = storyNote
    ? `\nTHE CREATOR TOLD YOU DIRECTLY WHAT THESE IMAGES MEAN:\n"${storyNote}"\n`
    : ''
  if (analyses.length === 1) {
    return `\nUPLOADED IMAGE:\n${describeOne(analyses[0])}\n${noteBlock}`
  }
  const sequence = analyses.map((a, i) => `--- Still ${i + 1} ---\n${describeOne(a)}`).join('\n\n')
  return `\nUPLOADED IMAGE SEQUENCE (${analyses.length} stills):\n${sequence}\n${noteBlock}`
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

  // ── ENTITLEMENT CHECK - same Pro gate as the rest of Asset Intelligence,
  // since refinement is an extension of the same subscriber feature. ──
  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', user_id)
    .single()

  if (!userRow || userRow.subscription_tier !== 'pro') {
    return res.status(403).json({ error: 'Conversational refinement is a Pro subscriber feature.' })
  }

  // ── Load the session, verifying ownership - not just session_id alone ──
  const { data: session, error: sessionError } = await supabase
    .from('creative_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', user_id)
    .single()

  if (sessionError || !session) {
    return res.status(404).json({ error: 'Session not found or not owned by this user' })
  }

  // ── Load the full conversation history, in order ──
  const { data: history, error: historyError } = await supabase
    .from('session_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })

  if (historyError || !history) {
    return res.status(500).json({ error: 'Failed to load conversation history' })
  }

  // ── Rebuild the same story/asset context this session started with ──
  const ctx = session.context_snapshot || {}
  const story = await getStoryContext(user_id)
  const storyBlock = buildStoryPromptBlock(story, ctx.story_objective || 'close_cta')
  const assetAnalyses = await getAssetContext(ctx.asset_ids, user_id)
  const assetBlock = buildAssetPromptBlock(assetAnalyses, ctx.asset_story_note)

  const systemPrompt = `You are NillaFlow Studio™'s Ad Clip Engine, continuing a REVISION conversation with a subscriber about ad copy you already generated. This is not a fresh generation - it's a refinement of the existing result based on their feedback.

ORIGINAL CONTEXT:
Topic: ${ctx.topic}
Niche: ${ctx.niche || 'not specified'}
Audience: ${ctx.audience || 'not specified'}
Objective: ${ctx.objective || 'conversions'}
${storyBlock}${assetBlock}

RULES THAT STILL APPLY, EVEN WHILE REVISING:
- Keep the same output schema: variants (each with hook_mechanic, video_hook, primary_text, headline, and visual_element_used if images are present), description, recommended_pairing, and visual_story_synthesis if images are present
- Primary Text stays under 200 characters, 2 short sentences max
- Never use a specific dollar income figure, even a true one
- "This isn't MLM" framing is permitted (no quotas, override caps at level 4, downline can outrank upline) but state plainly, never explain mechanics
- If images are present, grounding in concrete visual detail is still required - a revision that drops visual grounding to satisfy other feedback is not acceptable, find a way to do both
- Apply the specific feedback in the latest user message to revise the MOST RECENT assistant result in the conversation - don't regenerate from scratch, actually revise what's there

Return ONLY a raw JSON object matching the schema above, no markdown, no backticks.`

  // Build the full multi-turn message array from history + the new feedback
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
        max_tokens: 1200,
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

    // Same server-side length + grounding enforcement as the original
    // generation - a revision doesn't get a lighter compliance bar.
    const enforceLength = (text) => {
      if (!text || text.length <= 200) return text
      const truncated = text.slice(0, 200)
      const lastEnd = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '))
      if (lastEnd > 100) return truncated.slice(0, lastEnd + 1)
      return truncated.slice(0, 197).trim() + '...'
    }

    if (Array.isArray(result.variants)) {
      result.variants = result.variants.map(v => {
        const updated = { ...v, primary_text: enforceLength(v.primary_text) }
        if (assetAnalyses.length > 0) {
          const claimed = (v.visual_element_used || '').toLowerCase().trim()
          const copyText = `${v.video_hook || ''} ${v.primary_text || ''}`.toLowerCase()
          const keyWords = claimed.split(/\s+/).filter(w => w.length > 3)
          updated.visually_grounded = claimed.length > 0 && claimed !== 'n/a' && keyWords.some(w => copyText.includes(w))
        }
        return updated
      })
    }

    // Save both turns to history for the next refinement
    await supabase.from('session_messages').insert([
      { session_id, role: 'user', content: feedback_message },
      { session_id, role: 'assistant', content: JSON.stringify(result) },
    ])

    return res.status(200).json({ session_id, ...result })

  } catch (error) {
    console.error('Session refinement error:', error)
    return res.status(500).json({ error: 'Failed to revise. Please try again.' })
  }
}
