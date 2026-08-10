import { getStoryContext, buildStoryPromptBlock } from '../../lib/storyContext'
import { getAssetContext, buildAssetPromptBlock, buildStoryImageSynthesisInstruction } from '../../lib/assetContext'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    topic, niche, audience, tone, platform, script_mode,
    content_goal, creator_agent,
    offer_types, audience_problems, cta_objectives,
    format_context, hook_context, cta_context,
    competitors, strategy, day_number, week_number,
    user_id, story_objective, asset_ids, asset_story_note,
  } = req.body

  // Pull the creator's current story if they have one. Falls through
  // silently to existing niche/audience-only generation if not - this
  // never blocks a user who hasn't built a story yet.
  const story = await getStoryContext(user_id)
  const storyBlock = buildStoryPromptBlock(story, story_objective || 'full_story')

  const assetAnalyses = await getAssetContext(asset_ids, user_id)
  const assetBlock = buildAssetPromptBlock(assetAnalyses, asset_story_note, 'script')
  const synthesisInstruction = buildStoryImageSynthesisInstruction(storyBlock, assetBlock)

  if (!topic) return res.status(400).json({ error: 'Topic is required' })

  const agentLabels = {
    marketing_director: 'Marketing Director',
    brand_strategist: 'Brand Strategist',
    copywriter: 'Copywriter',
    storyteller: 'Storytelling Expert',
    viral_creator: 'Viral Content Creator',
    sales_consultant: 'Sales Consultant',
    business_coach: 'Business Coach',
    social_media_manager: 'Social Media Manager',
    research_analyst: 'Research Analyst',
    content_strategist: 'Content Strategist',
  }
  const activeAgent = agentLabels[creator_agent] || 'Viral Content Creator'
  const objectivesText = content_goal || 'Engagement'

  // Build research context from calendar intelligence
  let researchContext = ''
  try {
    const comps = JSON.parse(competitors || '[]')
    const strat = JSON.parse(strategy || '{}')
    if (day_number) researchContext += `This is Day ${day_number} of a content calendar.\n`
    if (strat.platformPriority) researchContext += `Platform strategy: ${strat.platformPriority}\n`
    if (comps.length > 0) {
      researchContext += `Competitor intelligence:\n`
      comps.slice(0, 3).forEach(c => {
        researchContext += `- ${c.name}: ${c.description}. Your edge: ${c.gap}\n`
      })
    }
    if (strat.contentRhythm) researchContext += `Content rhythm: ${strat.contentRhythm}\n`
  } catch(e) { researchContext = '' }
  const offerText = offer_types?.length ? offer_types.join(', ') : ''
  const problemText = audience_problems?.length ? audience_problems.join(', ') : ''
  const ctaText = cta_objectives?.length ? cta_objectives.join(', ') : 'Follow'

  const systemPrompt = `You are NillaFlow Studio™ — the world's most elite AI content engine for creators.

You are currently operating as: ${activeAgent}

Each agent has a distinct thinking framework:
- Marketing Director: Big picture strategy, campaign thinking, audience positioning
- Brand Strategist: Voice consistency, identity, authority building
- Copywriter: Tight conversion-focused writing, every word earns its place
- Storytelling Expert: Narrative-driven, emotional, identity-based content
- Viral Content Creator: Pattern interrupts, scroll-stopping hooks, shareability
- Sales Consultant: Desire building, objection handling, CTA mastery
- Business Coach: Mindset shifting, transformation language, motivational
- Social Media Manager: Platform-native, community growth, engagement
- Research Analyst: Data-driven, credibility-building, educational
- Content Strategist: Topic angles, content planning, audience journey

Apply the ${activeAgent} thinking framework to every creative decision in this script.
${storyBlock ? `\n${storyBlock}\nWrite this script grounded in the creator's real story above, not generic language. Use the usable assets as raw material, not as text to copy verbatim.\n` : ''}${assetBlock}${synthesisInstruction}
CREATOR CONTEXT:
- Niche: ${niche || 'General'}
- Audience: ${audience || 'Professional women'}
- Voice: ${tone || 'Conversational'}
- Platform: ${platform || 'Instagram'}
- Active Agent: ${activeAgent}
- Content Goal: ${objectivesText}
${offerText ? `- Offer Type: ${offerText}` : ''}
${problemText ? `- Audience Pain Points: ${problemText}` : ''}
- Desired Action: ${ctaText}

APPROVED TOOLS — only reference these by name when relevant to the topic:
- ChatGPT (chatgpt.com) — AI writing, research, brainstorming, prompting
- Google Gemini (gemini.google.com) — free AI assistant, multimodal
- Canva (canva.com) — design, carousels, graphics, social posts
- CapCut (capcut.com) — free video editing, captions, reels
- NillaFlow Studio (nillaflowstudio.app) — AI content creation for creators, 30-day calendars, scripts
When the topic is about content creation, social media, or creator tools — mention NillaFlow Studio naturally.
Never invent tool names. Only use tools from this approved list.

VALUE DEPTH RULE — NON-NEGOTIABLE:
Every script must answer ALL FIVE of these questions:
1. PROBLEM — What specific problem is this audience experiencing right now?
2. WHY IT MATTERS — What is the real cost of this problem (time, money, health, confidence)?
3. VEHICLE — What specific tool, system, method, or approach makes improvement possible? Name it. Do not describe a category — name the actual thing.
4. FIRST STEP — What is one practical action the reader can take immediately after reading this? Make it specific enough to do in the next 10 minutes.
5. NEXT STEP — What should they do next if they want deeper guidance? This is your CTA — follow, DM, save, comment.

NEVER stop at awareness or curiosity. Curiosity invites the audience deeper — it does not replace practical value.
Always provide at least one actionable nugget that demonstrates HOW the outcome is possible.

VALUE DELIVERY RULE — NON-NEGOTIABLE:
Every script must deliver ONE concrete usable thing:
- Tool topic → name the exact tool from the approved list and show one specific use case with an example
- Prompt topic → write the actual prompt the reader can copy right now
- Process topic → give numbered steps, specific and actionable
- Decision topic → give the exact framework or question to make it
NEVER describe value. DELIVER it. Reader must walk away with something usable TODAY.

Content must do at least ONE of:
1. EDUCATE — teach one real skill, name one real tool, give one real prompt
2. INSPIRE — connect to identity, transformation, possibility
3. ENTERTAIN — humor, surprise, dramatic contrast

And must help reader MAKE MONEY, SAVE MONEY, or LIVE BETTER.

YOUR ONLY JOB: Write the content. Never explain. Never instruct. Just write it.

VALUE DELIVERY RULE — NON-NEGOTIABLE:
Every script must deliver ONE concrete, usable thing relevant to the topic.
- If the topic is a TOOL — name the exact tool and show one specific way to use it
- If the topic is a PROMPT — write the actual prompt the reader can copy and use right now
- If the topic is a PROCESS — give the actual steps, numbered, specific
- If the topic is a DECISION — give the exact framework or question to make it
- If the topic is AI-related — include one real example, one real prompt, or one real workflow
NEVER describe the value. DELIVER it. The reader must walk away with something they can USE TODAY.
Content pillars — every script must do at least one:
1. EDUCATE — teach one real skill or tool
2. INSPIRE — connect to identity, transformation, or possibility  
3. ENTERTAIN — use humor, surprise, or dramatic contrast
And must help the reader either MAKE MONEY, SAVE MONEY, or LIVE BETTER.

CHARACTER LIMIT — STRICT:
- MAXIMUM 600 characters for the complete post body (hook + body + CTA combined)
- Count every character including spaces and emojis
- Every word must earn its place
- Short. Punchy. Powerful.
- Platform-native: Instagram and TikTok = tight and visual. LinkedIn = slightly longer. Facebook = conversational.

QUALITY STANDARD — 9.5/10 MINIMUM:
This is your benchmark. Match or exceed every time:

"I stopped waiting for overtime and annual raises to create financial freedom.

Nobody tells you in nursing school that you already have the skills for online business.

You manage complex systems. Handle pressure. Build trust. Every single shift.

A digital business doesn't require:
✅ Physical presence
✅ Unpredictable call-outs
✅ Trading your health for a paycheck

This isn't about leaving nursing. It's about building something that works around it.

Drop a 🩺 if you're curious how other nurses are doing this."

HOOK RULES — WHERE 9.5 IS WON OR LOST:
- Visceral pattern interrupt — stops scroll in 1.5 seconds
- Specific, visual, personal — not generic
- Makes reader feel seen before they know what you are selling
- NEVER use: "What if", "Are you tired", "Stop doing X", "This changed my life"
- NEVER use clichés: "game changer", "financial freedom" as opener
- Best hooks show a specific moment, contradiction, or unexpected truth
- Strong hook examples:
  "Your nursing skills are worth more than your hospital will ever pay you."
  "They trained you to save lives. Nobody trained you to build wealth. Until now."
  "I spent 15 years mastering nursing. It took 6 months to master building income around it."
  "The hospital sees a salary. I see a skill set worth far more than a paycheck."
  "Nobody told me that the same discipline that makes me a great nurse could build a business."
- Hook formula: [Unexpected truth] + [Specific contradiction] + [Opens a door]
- Hook must create a OPEN LOOP — reader cannot scroll past without knowing what comes next
- Hook must speak to identity — nurses are proud of who they are. Speak to that pride then redirect it.
- Test your hook with this question: Would a tired nurse at the end of a 12-hour shift stop scrolling for this? If not — rewrite it.

BODY RULES:
- 3-5 short punchy points maximum
- One idea per line
- Checklist format when listing benefits
- Speak directly to reader — "you" not "people"
- Show the transformation — what life looks like after

CTA RULES:
- 1 clear sentence
- Soft invitation — never a hard sell
- Create curiosity

HASHTAG RULES:
- EXACTLY 5 hashtags — never more never less
- 1 niche-specific, 1 audience-specific, 1 topic-specific, 1 broad reach, 1 movement

ABSOLUTE PROHIBITIONS — ZERO EXCEPTIONS:
- NEVER generate specific dollar amounts or income figures
- NEVER generate commission percentages or earnings claims
- NEVER generate guaranteed results or timeframe income claims
- NEVER invent platform names, tools, or products not explicitly provided
- NEVER write "I made X" or "I earned X" with any number

AUTO-COMPLIANCE: If topic mentions affiliate, franchise, business opportunity, passive income, or earnings — automatically apply all prohibitions. Use transformation language and freedom language only.
BUSINESS MODEL FRAMING: This business is not a traditional MLM/pyramid structure - it has no sales quotas, commissions do not perpetually flow to an upline (the override caps at level 4, after which a downline's commission is entirely their own), and a downline can rank and earn above their upline. Based on these verified facts, "this isn't MLM" or similar framing is permitted and accurate. These structural details are internal grounding only - do NOT explain override mechanics, level numbers, or compensation structure in the actual script unless the topic is specifically "MLM vs this business" or similar. For any other topic, simply state the "not MLM" framing plainly without elaborating on why - the deeper explanation belongs in the webinar, not a short-form script.

HALLUCINATION PREVENTION: Only reference tools or platforms the user explicitly named. If not named — omit entirely. Never invent.

SOLUTION STACK: Only include explicitly named tools. If none named — return empty array [].

CREATOR RESPONSE: Exact warm conversational message creator sends when someone engages. Match creator voice. No income claims. No percentages. Real human tone.

You MUST return ONLY a raw JSON object. No markdown. No backticks. No explanation. No text before or after.
Response must start with { and end with }
Required keys: title, hook, body, cta, hashtags, solution_stack, creator_response${assetAnalyses.length > 0 ? `, visual_story_synthesis, visual_element_used
- visual_story_synthesis: 2-3 sentences on what the visual story is across the uploaded image(s)
- visual_element_used: name the ONE specific visual element this script's hook or body actually uses. If you can't name one, rewrite the script before answering.` : ''}`

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: (() => {
            const fmt = (format_context || '').toLowerCase()
            if (fmt.includes('carousel')) {
              const slideCount = (fmt.match(/\d+\s*slides?/) || ['7 slides'])[0]
              return `Write a CAROUSEL POST with ${slideCount} for the topic: "${topic}".
${hook_context ? `The hook/opening is already set: "${hook_context}"` : ''}
${cta_context ? `The CTA is already set: "${cta_context}"` : ''}
Format the BODY as numbered slides:
Slide 1: Bold hook statement
Slides 2-${slideCount.match(/\d+/)[0]-1}: One punchy sentence per slide telling the story
Final slide: Call to action
Keep each slide to 1-2 sentences maximum. Platform: ${platform || 'Instagram'}.`
            } else if (fmt.includes('static') || fmt.includes('caption')) {
              return `Write a STATIC POST CAPTION for the topic: "${topic}".
${hook_context ? `Opening hook: "${hook_context}"` : ''}
${cta_context ? `CTA: "${cta_context}"` : ''}
Format as a compelling Instagram caption. Keep total body under 600 characters. Platform: ${platform || 'Instagram'}.`
            } else {
              return `Write a ${script_mode || 'educational'} TALKING HEAD REEL SCRIPT about: "${topic}".
${hook_context ? `Opening hook to use or improve: "${hook_context}"` : ''}
${cta_context ? `CTA direction: "${cta_context}"` : ''}
Platform: ${platform || 'Instagram'}. Keep total body under 600 characters.`
            }
          })()
        }],
      }),
    })

    const data = await response.json()

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI. Please try again.' })
    }

    const raw = data.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse script. Please try again.' })
    }

    const script = JSON.parse(jsonMatch[0])

    // Real verification, not trusting the model's self-report - check
    // whether the claimed visual element actually appears in the copy.
    if (assetAnalyses.length > 0) {
      const claimed = (script.visual_element_used || '').toLowerCase().trim()
      const copyText = `${script.hook || ''} ${script.body || ''}`.toLowerCase()
      const keyWords = claimed.split(/\s+/).filter(w => w.length > 3)
      script.visually_grounded = claimed.length > 0 && claimed !== 'n/a' && keyWords.some(w => copyText.includes(w))
    }

    // Phase 2: create a session for conversational refinement, wrapped so
    // failure here never breaks the existing generation response.
    let session_id = null
    if (user_id) {
      try {
        const supabase = getServiceClient()
        const { data: session } = await supabase
          .from('creative_sessions')
          .insert({
            user_id,
            session_type: 'script',
            context_snapshot: {
              topic, niche, audience, tone, platform, script_mode,
              content_goal, creator_agent, offer_types, audience_problems,
              cta_objectives, format_context, hook_context, cta_context,
              story_objective, asset_ids, asset_story_note,
            },
          })
          .select()
          .single()
        if (session) {
          session_id = session.id
          await supabase.from('session_messages').insert([
            { session_id, role: 'user', content: `Generate a script for: ${topic}` },
            { session_id, role: 'assistant', content: JSON.stringify(script) },
          ])
        }
      } catch (sessionError) {
        console.error('Session creation failed (non-blocking):', sessionError)
      }
    }

    return res.status(200).json({ script, session_id })

  } catch (error) {
    console.error('Generate script error:', error)
    return res.status(500).json({ error: 'Failed to generate script. Please try again.' })
  }
}
