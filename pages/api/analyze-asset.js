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

  const { asset_id, user_id } = req.body
  if (!asset_id || !user_id) {
    return res.status(400).json({ error: 'asset_id and user_id are required' })
  }

  const supabase = getServiceClient()

  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('*')
    .eq('id', asset_id)
    .eq('user_id', user_id) // ownership check - not just asset_id alone
    .single()

  if (fetchError || !asset) {
    return res.status(404).json({ error: 'Asset not found or not owned by this user' })
  }

  // ── CACHE CHECK — if this asset was already analyzed, return the cached
  // result immediately. No new API call, no new cost. ──
  if (asset.ai_analysis) {
    return res.status(200).json({ analysis: asset.ai_analysis, cached: true })
  }

  // ── Get a signed URL so Claude can be given the image, then fetch and
  // base64-encode it for the vision API ──
  const { data: signedUrlData, error: signError } = await supabase.storage
    .from('user-assets')
    .createSignedUrl(asset.storage_path, 60) // 60 seconds, just long enough to fetch it once

  if (signError || !signedUrlData) {
    return res.status(500).json({ error: 'Failed to access stored image' })
  }

  let imageBase64
  try {
    const imageResponse = await fetch(signedUrlData.signedUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    imageBase64 = Buffer.from(imageBuffer).toString('base64')
  } catch {
    return res.status(500).json({ error: 'Failed to read image for analysis' })
  }

  const systemPrompt = `You are analyzing an image uploaded to NillaFlow Studio™ by a subscriber, for use as context in ad copy generation.

Describe what's in the image factually and usefully for a copywriter: the subject, setting, mood, colors, any visible text or branding, and what kind of product/lifestyle/moment it represents. Do not invent details you can't actually see. Keep it to 3-5 sentences - this becomes input context for another AI call, not a caption itself.

Return ONLY a raw JSON object, no markdown, no backticks:
{
  "description": "...",
  "subject": "...",
  "mood": "...",
  "notable_details": ["...", "..."]
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
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: asset.mime_type, data: imageBase64 },
            },
            { type: 'text', text: 'Analyze this image.' },
          ],
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
      return res.status(500).json({ error: 'Failed to parse analysis' })
    }

    const analysis = JSON.parse(jsonMatch[0])

    // ── CACHE WRITE — store so no future call re-analyzes this asset ──
    await supabase
      .from('assets')
      .update({ ai_analysis: analysis, analyzed_at: new Date().toISOString() })
      .eq('id', asset_id)

    return res.status(200).json({ analysis, cached: false })

  } catch (error) {
    console.error('Asset analysis error:', error)
    return res.status(500).json({ error: 'Failed to analyze image. Please try again.' })
  }
}
