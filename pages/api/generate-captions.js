export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { script, style, niche, platform } = req.body

  if (!script) {
    return res.status(400).json({ error: 'Script is required' })
  }

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
        max_tokens: 1000,
        system: `You are an expert social media caption writer for ${niche || 'general'} creators on ${platform || 'instagram'}. Write captions that drive engagement. Return ONLY the caption text, no explanation.`,
        messages: [{
          role: 'user',
          content: `Write a ${style} caption for this script. Include no more than 5 relevant hashtags at the end.\n\nScript:\n${script}`
        }],
      }),
    })

    const data = await response.json()
    const caption = data.content[0].text
    return res.status(200).json({ caption })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate caption. Please try again.' })
  }
}