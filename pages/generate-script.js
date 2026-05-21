// pages/api/generate-script.js
// Server-side Claude API call — API key never exposed to browser

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { topic, niche, audience, tone, platform, script_mode } = req.body

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' })
  }

  // Build the prompt based on creator profile
  const systemPrompt = `You are an expert content creator and scriptwriter specializing in ${niche || 'general'} content. 
You write scripts that sound completely natural and conversational — like the creator is speaking directly from the heart, not reading a script.

Creator Profile:
- Niche: ${niche || 'general content'}
- Target Audience: ${audience || 'general audience'}
- Tone: ${tone || 'conversational'}
- Platform: ${platform || 'instagram'}
- Script Mode: ${script_mode || 'educational'}

Your scripts follow this structure:
1. HOOK (first 3-5 seconds — stops the scroll)
2. BODY (the core value — conversational, natural pacing)
3. CTA (clear, specific call to action)

Rules:
- Write in first person as if the creator is speaking
- Use natural breathing pauses (indicated by "...")
- Keep sentences short and punchy
- No corporate or robotic language
- Match the exact tone specified
- Optimize for the specified platform's format and length
- Instagram/TikTok: 60-90 seconds when read aloud
- YouTube: 2-3 minutes when read aloud

Return ONLY a JSON object with this exact structure, no other text:
{
  "title": "script title",
  "hook": "the opening hook",
  "body": "the main content with natural pauses",
  "cta": "the call to action",
  "pacing": "tips for delivery"
}`

  const userPrompt = `Write a ${script_mode || 'educational'} script about: "${topic}"

Make it sound completely natural, like I'm talking to a close friend who needs this information. 
The hook must stop someone mid-scroll in under 5 seconds.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        system: systemPrompt,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Claude API error:', errorData)
      return res.status(500).json({ error: 'Failed to generate script. Please try again.' })
    }

    const data = await response.json()
    const content = data.content[0].text

    // Parse the JSON response from Claude
    let script
    try {
      // Remove any markdown code blocks if present
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      script = JSON.parse(cleaned)
    } catch (parseError) {
      // If parsing fails, return the raw text
      script = {
        title: topic,
        hook: content,
        body: '',
        cta: '',
        pacing: ''
      }
    }

    return res.status(200).json({ script })

  } catch (error) {
    console.error('Script generation error:', error)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}