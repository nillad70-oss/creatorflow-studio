// AI Twin™ consent wording. DRAFT pending attorney review (decision D4).
// Changing any wording requires a new CONSENT_VERSION: creators are then asked
// to consent again, and old consents stay on record with their own version.
export const CONSENT_VERSION = 'ai-twin-consent-v1'

export const CONSENT_SCOPE_LABELS = {
  professional: 'Professional branding (headshots, speaker and business images)',
  fashion_lifestyle: 'Fashion and lifestyle images',
  video: 'Video of my likeness (coming later; requires separate setup)',
  voice: 'My voice (coming later; requires separate setup)',
}

export const CONSENT_POINTS = [
  'The photos and recording I provide are of me, and I am 18 years of age or older.',
  'I authorize NillaFlow Studio™ to use them only to create AI-generated images of me, for the uses I select below, for my own content.',
  'I will not upload images of any other person, and I will not use my AI Twin to impersonate anyone or to mislead people about who created content.',
  'Images created with my AI Twin are AI-generated, are labeled as such, and I am responsible for disclosing AI use where platforms or laws require it.',
  'My photos are processed by NillaFlow and its AI service providers solely to provide this feature, and are not used to train public models.',
  'I can delete my AI Twin at any time. Deletion permanently removes my photos, my consent recording, and images created from them.',
]

// What the creator reads aloud on camera.
export const CONSENT_STATEMENT =
  'My name is [your name]. Today is [today\'s date]. I am creating an AI Twin of myself in NillaFlow Studio, and I consent to the uses I selected.'
