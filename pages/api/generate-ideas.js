export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { niche, audience, tone, platform, days } = req.body
  const platformList = Array.isArray(platform) ? platform.join(', ') : platform || 'Instagram'
  const dayCount = Math.min(days || 7, 30)

  const nicheIntelligence = {
    'Nursing & Healthcare': {
      painPoints: [
        'Spending 2-4 hours per shift on documentation instead of patient care',
        'Chronic burnout from 12-hour shifts with no recovery time',
        'Feeling undervalued and underpaid despite life-saving skills',
        'No one taught them how to build income outside the hospital',
        'Afraid to leave nursing but desperate for financial breathing room',
        'Imposter syndrome when exploring digital business or tech',
        'No time to research tools or strategies that could help them',
        'Watching colleagues quietly build second income streams and not knowing how',
      ],
      vehicles: [
        'ChatGPT for clinical documentation and charting shortcuts',
        'NillaFlow Studio for creating content around nursing expertise',
        'Canva for building digital resources nurses can sell',
        'Digital products: study guides, clinical cheat sheets, shift planners',
        'Content creation: monetizing nursing knowledge on social media',
        'Consulting: offering expertise to healthcare organizations',
      ],
      conversationTopics: [
        'Charting taking over their lives',
        'Feeling invisible in the healthcare system',
        'Wanting more time with family after shifts',
        'Wondering if their nursing skills translate to business',
        'Afraid AI will replace nurses',
        'Looking for side income that does not require another degree',
      ],
      weeklyTheme: {
        1: 'Awareness — name the pain they have never heard named out loud',
        2: 'Education — show them a specific tool or method that changes something NOW',
        3: 'Proof — show them someone like them who made the shift',
        4: 'Invitation — make the next step feel safe and specific',
      }
    },
    'Business & Entrepreneurship': {
      painPoints: [
        'Working harder than ever but income is not growing',
        'Content creation taking all their time with no ROI',
        'No system for consistent leads or clients',
        'Imposter syndrome when charging premium prices',
        'Overwhelmed by too many tools and no clear strategy',
        'Social media feels like shouting into a void',
      ],
      vehicles: [
        'NillaFlow Studio for content calendar and script generation',
        'ChatGPT for copy, emails, and client communication',
        'Canva for branded content and lead magnets',
        'Digital products and courses for passive income',
        'Email list building for owned audience',
      ],
      conversationTopics: [
        'Wanting more clients without more hustle',
        'Struggling to explain what they do clearly',
        'Comparing themselves to competitors',
        'Wondering if social media is even worth it',
      ],
      weeklyTheme: {
        1: 'Awareness — name the invisible ceiling holding them back',
        2: 'Education — one tool or system that removes a bottleneck',
        3: 'Proof — results and transformation stories',
        4: 'Invitation — clear next step to work with you',
      }
    },
    'Technology & AI': {
      painPoints: [
        'Feeling left behind as AI moves faster than they can learn',
        'Not knowing which AI tools are actually worth learning',
        'Afraid of looking stupid asking basic AI questions',
        'Watching others use AI to save hours while they still do everything manually',
        'No one explaining AI in plain language without the hype',
        'Immigrant professionals feeling double pressure to keep up',
      ],
      vehicles: [
        'ChatGPT with specific prompts for their exact workflow',
        'NillaFlow Studio for AI-powered content without tech knowledge',
        'Google Gemini for free AI assistance',
        'Canva AI for design without design skills',
        'CapCut for video editing with AI captions',
      ],
      conversationTopics: [
        'AI replacing jobs — real fear not hype',
        'Which AI tools are free vs worth paying for',
        'How to learn AI without a tech background',
        'Using AI to save time on tasks they hate',
      ],
      weeklyTheme: {
        1: 'Awareness — the AI gap that is quietly growing between those who use it and those who do not',
        2: 'Education — one specific AI tool with one specific use case and exact prompt',
        3: 'Proof — real time saved, real money made, real stress removed',
        4: 'Invitation — start here, this week, with this one thing',
      }
    }
  }

  const defaultIntelligence = {
    painPoints: [
      'Working hard but not seeing results',
      'Overwhelmed by too much information and no clear path',
      'Feeling invisible on social media despite consistent posting',
      'No system for turning content into income',
      'Afraid to charge what they are worth',
    ],
    vehicles: [
      'NillaFlow Studio for content strategy and script generation',
      'ChatGPT for copy and communication',
      'Canva for visual content',
      'Digital products for passive income',
    ],
    conversationTopics: [
      'Wanting results without burning out',
      'Not knowing what content actually works',
      'Feeling behind compared to others in their space',
    ],
    weeklyTheme: {
      1: 'Awareness — name the real problem',
      2: 'Education — specific tool or method',
      3: 'Proof — transformation and results',
      4: 'Invitation — clear next step',
    }
  }

  const intelligence = nicheIntelligence[niche] || defaultIntelligence

  const systemPrompt = `You are NillaFlow Studio™ — a premier AI content intelligence engine.

Your job is to generate a content calendar that functions as a complete conversion journey.
Every piece of content must move the audience from PAIN AWARENESS → TRUST → ACTION → MONETIZATION.

You already know this audience deeply. Here is their intelligence profile:

AUDIENCE: ${audience || 'professional women'}
NICHE: ${niche || 'general'}
PLATFORM: ${platformList}
TONE: ${tone || 'conversational'}

WHAT KEEPS THEM AWAKE AT NIGHT:
${intelligence.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

WHAT THEY ARE CONSTANTLY TALKING ABOUT:
${intelligence.conversationTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

SPECIFIC VEHICLES AND TOOLS FOR THIS AUDIENCE:
${intelligence.vehicles.map((v, i) => `${i + 1}. ${v}`).join('\n')}

WEEKLY CONVERSION STRATEGY:
${Object.entries(intelligence.weeklyTheme).map(([week, theme]) => `Week ${week}: ${theme}`).join('\n')}

CONTENT RULES — PREMIER STANDARD:
1. Every title must speak directly to a pain point from the list above — not generic
2. Every hook must make the reader feel SEEN in the first 3 seconds
3. Every topic must embed a specific vehicle, tool, or method — not a category
4. Content must answer: What is the problem? Why does it matter? What is the specific solution? What can they do TODAY?
5. Week 1 builds awareness and trust. Week 2 delivers specific actionable value. Week 3 introduces transformation proof. Week 4 invites to next step.
6. Topics must escalate in specificity and depth as the weeks progress
7. NEVER generate generic titles like "Tips for nurses" or "How to use AI" — always specific

Return ONLY a raw JSON object. No markdown. No backticks. Start with { end with }

Keep each field concise — max 20 words per field.`

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
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Generate a ${dayCount}-day content calendar using the audience intelligence above.

Return this exact JSON structure:
{"competitors":[{"name":"name","type":"direct","description":"what they do","gap":"specific opportunity"}],"days":[{"day":1,"week":1,"title":"specific pain-aware title","hook":"first 3 seconds — make them feel seen","cta":"one clear next action","format":"Carousel or Reel or Video Tutorial or Talking Head or Infographic Reel","platforms":["ig"],"hashtags":"#tag1 #tag2 #tag3 #tag4 #tag5","vehicle":"specific tool or method for this post"}],"strategy":{"platformPriority":"which platform and why","contentRhythm":"posting schedule","hashtagStack":"#master #hashtag #list"}}`
        }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(500).json({ error: data.error?.message || 'API error' })
    }

    const textBlock = data.content.find(block => block.type === 'text')
    if (!textBlock) {
      return res.status(500).json({ error: 'No content returned.' })
    }

    const raw = textBlock.text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse response: ' + raw.substring(0, 100) })
    }

    const calendar = JSON.parse(jsonMatch[0])

    if (calendar.days && calendar.competitors) {
      return res.status(200).json({ calendar, mode: 'calendar' })
    }

    return res.status(200).json({ ideas: Array.isArray(calendar) ? calendar : [], mode: 'ideas' })

  } catch (error) {
    console.error('Generate ideas error:', error.message)
    return res.status(500).json({ error: error.message || 'Failed to generate ideas.' })
  }
}
