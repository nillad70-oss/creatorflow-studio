// AI Twin™ Studio — shared (browser + server) catalog of styles, engines and tiers.

export const STYLES = {
  headshot:      { scope: 'professional',      label: 'Executive headshot',  scene: 'a polished executive headshot, head and shoulders, soft studio key light with gentle fill, clean neutral seamless backdrop' },
  speaker:       { scope: 'professional',      label: 'Keynote speaker',     scene: 'speaking on a modern conference stage, warm stage lighting, audience softly out of focus, confident open gesture' },
  office:        { scope: 'professional',      label: 'Modern office',       scene: 'in a bright modern office with large windows, natural daylight, relaxed confident posture, shallow depth of field' },
  podcast:       { scope: 'professional',      label: 'Podcast / studio',    scene: 'in a professional podcast studio with a broadcast microphone, warm practical lights and acoustic panels behind' },
  brand_portrait:{ scope: 'professional',      label: 'Brand portrait',      scene: 'an editorial brand portrait, three-quarter length, tasteful environmental background, magazine-quality lighting' },
  fashion:       { scope: 'fashion_lifestyle', label: 'Fashion editorial',   scene: 'a high-end fashion editorial photo, full-length, styled outfit, dramatic but flattering light' },
  lifestyle:     { scope: 'fashion_lifestyle', label: 'Lifestyle',           scene: 'a candid lifestyle moment in a beautiful, aspirational everyday setting, golden-hour natural light' },
  travel:        { scope: 'fashion_lifestyle', label: 'Travel',              scene: 'a travel photo at a scenic destination, natural light, relaxed happy expression, photographed like a premium travel magazine' },
}

// Engines: the current top identity-faithful reference-image models (via fal.ai).
export const ENGINES = {
  'studio-pro': { label: 'Studio Pro', vendor: 'Google Nano Banana Pro', model: 'fal-ai/nano-banana-pro/edit' },
  precision:    { label: 'Precision',  vendor: 'OpenAI GPT Image 2.5',   model: 'openai/gpt-image-2.5/flare/edit' },
}

// 'best' runs both engines side by side; Claude scores the results and marks the best.
export const ENGINE_MODES = {
  best:         { label: 'Best of both (recommended)', engines: ['studio-pro', 'precision'] },
  'studio-pro': { label: 'Studio Pro only',            engines: ['studio-pro'] },
  precision:    { label: 'Precision only',             engines: ['precision'] },
}

export const TIERS = {
  standard: { label: 'Standard (2K)', creditsPerImage: 1 },
  ultra:    { label: 'Ultra (4K)',    creditsPerImage: 2 },
}

export const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9']

export const MAX_DESCRIPTION = 400

// The creator pays per creation that DELIVERS an image that looks like them.
// Extra candidates and the automatic retry round are on us.
export function creationCost(mode, tier) {
  if (!ENGINE_MODES[mode] || !TIERS[tier]) return null
  return TIERS[tier].creditsPerImage
}
