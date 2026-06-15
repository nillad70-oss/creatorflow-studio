export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    topic, niche, audience, tone, platform, script_mode,
    content_goal, creator_agent,
    offer_types, audience_problems, cta_objectives,
    format_context, hook_context, cta_context,
  } = req.body

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

YOUR ONLY JOB: Write the content. Never explain. Never instruct. Just write it.

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

HALLUCINATION PREVENTION: Only reference tools or platforms the user explicitly named. If not named — omit entirely. Never invent.

SOLUTION STACK: Only include explicitly named tools. If none named — return empty array [].

CREATOR RESPONSE: Exact warm conversational message creator sends when someone engages. Match creator voice. No income claims. No percentages. Real human tone.

You MUST return ONLY a raw JSON object. No markdown. No backticks. No explanation. No text before or after.
Response must start with { and end with }
Required keys: title, hook, body, cta, hashtags, solution_stack, creator_response`

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
    return res.status(200).json({ script })

  } catch (error) {
    console.error('Generate script error:', error)
    return res.status(500).json({ error: 'Failed to generate script. Please try again.' })
  }
}
