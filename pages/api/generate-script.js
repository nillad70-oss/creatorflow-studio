export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { topic, niche, audience, tone, platform, script_mode } = req.body
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' })
  }

  const systemPrompt = `You are an elite social media scriptwriter for ${niche || 'general'} creators on NillaFlow Studio™.

STRICT CONTENT RULES — NEVER BREAK THESE:
- Hook: 1-2 punchy sentences MAX. Must grab attention in 3 seconds.
- Body: 3-5 short punchy points. No long paragraphs. Each point is 1-2 sentences.
- CTA: 1 clear sentence. Simple and direct.
- MAXIMUM 150 WORDS TOTAL. Count every word. Stay under 150.
- Each body point on its own line separated by \n
- Voice: Natural, conversational, authentic. Never robotic or corporate.
- Add exactly 5 relevant SEO hashtags at the end.

SOLUTION DISCLOSURE MANDATE — CRITICAL:
- If the script mentions ANY tool, app, platform, system, workflow, or AI solution, you MUST explicitly name it.
- NEVER write vague references like "an AI tool", "an app", "a system", "automation helped me".
- ALWAYS name the exact product. Example: "NillaFlow Studio™" not "a creator tool".
- The audience must never finish the script wondering what tool or system was mentioned.

MANDATORY SCRIPT STRUCTURE:
1. Problem — what specific problem existed?
2. Solution — explicitly name the exact tool, platform, or system used.
3. Mechanism — how does it work? What specific actions does it perform?
4. Outcome — what measurable result occurred?
5. CTA — what should the audience do next?

PROHIBITED CONTENT — NEVER GENERATE:
- "AI helped me" without naming the AI
- "An app changed my life" without naming the app
- "I found a system" without naming the system
- "I automated everything" without naming the automation tool

SOLUTION STACK REQUIREMENT:
After the script, always include a solution_stack array listing every tool, platform, or system mentioned.

CTA ASSET REQUIREMENT:
Every CTA must have a paired creator_response — the exact response the creator sends when someone comments or DMs.
If CTA says "Comment TEMPLATE" — generate the template.
If CTA says "Comment GUIDE" — generate the guide.
The creator must never have to search for or create the CTA fulfillment manually.

Return ONLY a JSON object with: title, hook, body, cta, hashtags, solution_stack, creator_response`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Write a ${script_mode || 'educational'} script about: "${topic}" for ${audience || 'general audience'} on ${platform || 'instagram'}. Tone: ${tone || 'conversational'}. Keep it SHORT and PUNCHY. Instagram quality only.`
        }],
      }),
    })
    const data = await response.json()
    const content = data.content[0].text
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    const script = JSON.parse(cleaned)
    return res.status(200).json({ script })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate script. Please try again.' })
  }
}
