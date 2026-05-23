import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const NICHES = [
  "Health & Wellness", "Faith & Spirituality", "Business & Entrepreneurship",
  "Education & Teaching", "Coaching & Mentoring", "Nursing & Healthcare",
  "Beauty & Lifestyle", "Fitness & Movement", "Finance & Money",
  "Parenting & Family", "Personal Development", "Food & Nutrition",
  "Travel & Adventure", "Fashion & Style", "Technology & AI",
]

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: "◈" },
  { id: "tiktok", label: "TikTok", icon: "◉" },
  { id: "youtube", label: "YouTube", icon: "▶" },
  { id: "facebook", label: "Facebook", icon: "◆" },
  { id: "linkedin", label: "LinkedIn", icon: "◇" },
]

const TONES = [
  { id: "conversational", label: "Conversational", desc: "Warm, friendly, like talking to a friend" },
  { id: "motivational", label: "Motivational", desc: "Energetic, inspiring, uplifting" },
  { id: "educational", label: "Educational", desc: "Clear, informative, authoritative" },
  { id: "storytelling", label: "Storytelling", desc: "Narrative, emotional, engaging" },
  { id: "luxury", label: "Luxury & Elegant", desc: "Premium, refined, sophisticated" },
  { id: "faith", label: "Faith-Based", desc: "Spiritual, grounded, purposeful" },
]

const LEVELS = [
  { id: "beginner", label: "Just Starting", desc: "New to content creation" },
  { id: "intermediate", label: "Some Experience", desc: "Posted before but not consistent" },
  { id: "advanced", label: "Experienced", desc: "Regular creator ready to level up" },
]

const STEPS = [
  { number: 1, title: "Your Niche" },
  { number: 2, title: "Your Audience" },
  { number: 3, title: "Your Platform" },
  { number: 4, title: "Your Tone" },
  { number: 5, title: "Your Level" },
]

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [profile, setProfile] = useState({
    niche: '',
    audience: '',
    content_goals: '',
    preferred_platform: [],
    tone: '',
    creator_level: '',
  })

  const updateProfile = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  const nextStep = () => {
    // Validate current step
    if (step === 1 && !profile.niche) { setError('Please select your niche.'); return }
    if (step === 2 && !profile.audience) { setError('Please describe your audience.'); return }
    if (step === 3 && (!profile.preferred_platform || profile.preferred_platform.length === 0)) { setError('Please select at least one platform.'); return }
    if (step === 4 && !profile.tone) { setError('Please select your tone.'); return }
    setError('')
    setStep(prev => prev + 1)
  }

  const handleComplete = async () => {
    if (!profile.creator_level) { setError('Please select your creator level.'); return }

    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        niche: profile.niche,
        audience: profile.audience,
        content_goals: profile.content_goals,
        preferred_platform: profile.preferred_platform,
        tone: profile.tone,
        creator_level: profile.creator_level,
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const progress = ((step - 1) / STEPS.length) * 100

  return (
    <>
      <Head>
        <title>Setup Your Profile — CreatorFlow Studio™</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void flex flex-col">
        <div className="fixed inset-0 pointer-events-none" />

        {/* Progress bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-border">
          <div
            className="h-full bg-electric transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <nav className="relative z-10 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
              <span className="text-white text-xs font-bold">CF</span>
            </div>
            <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-lg font-medium">
              CreatorFlow
            </span>
          </div>
          <span className="text-tertiary text-xs">
            Step {step} of {STEPS.length}
          </span>
        </nav>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 relative z-10">
          <div className="w-full max-w-lg">

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {STEPS.map((s) => (
                <div
                  key={s.number}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    s.number === step ? 'w-8 bg-electric' :
                    s.number < step ? 'w-4 bg-electric/40' :
                    'w-4 bg-border'
                  }`}
                />
              ))}
            </div>

            {/* ── STEP 1 — Niche ── */}
            {step === 1 && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Step 1</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    What's your niche?
                  </h1>
                  <p className="text-secondary text-sm">This helps us generate content ideas perfectly tailored to you.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {NICHES.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => updateProfile('niche', niche)}
                      className={`px-4 py-3 rounded-xl text-sm text-left transition-all duration-200 ${
                        profile.niche === niche
                          ? 'bg-electric/20 border border-electric/50 text-primary'
                          : 'glass text-secondary hover:border-electric/20 hover:text-primary'
                      }`}
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2 — Audience ── */}
            {step === 2 && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Step 2</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    Who do you serve?
                  </h1>
                  <p className="text-secondary text-sm">Describe your ideal audience in a few words.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      My audience is...
                    </label>
                    <input
                      type="text"
                      value={profile.audience}
                      onChange={(e) => updateProfile('audience', e.target.value)}
                      placeholder="e.g. busy moms who want to eat healthier"
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-secondary text-xs mb-2 tracking-wide">
                      My content goal is... <span className="text-tertiary">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={profile.content_goals}
                      onChange={(e) => updateProfile('content_goals', e.target.value)}
                      placeholder="e.g. grow my coaching business, build authority"
                      className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3 — Platform ── */}
            {step === 3 && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Step 3</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    Where do you post?
                  </h1>
                  <p className="text-secondary text-sm">Pick your primary platform.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {PLATFORMS.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => {
        const current = profile.preferred_platform || []
        const updated = current.includes(platform.id)
          ? current.filter(p => p !== platform.id)
          : [...current, platform.id]
        updateProfile('preferred_platform', updated)
      }}
                      className={`flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all duration-200 ${
                        (profile.preferred_platform || []).includes(platform.id)
                          ? 'bg-electric/20 border border-electric/50'
                          : 'glass hover:border-electric/20'
                      }`}
                    >
                      <span className="text-electric-glow text-xl">{platform.icon}</span>
                      <span className={`text-sm font-medium ${
                        (profile.preferred_platform || []).includes(platform.id) ? 'text-primary' : 'text-secondary'
                      }`}>
                        {platform.label}
                      </span>
                      {profile.preferred_platform === platform.id && (
                        <span className="ml-auto text-electric-glow text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 4 — Tone ── */}
            {step === 4 && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Step 4</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    What's your vibe?
                  </h1>
                  <p className="text-secondary text-sm">How do you naturally speak to your audience?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TONES.map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => updateProfile('tone', tone.id)}
                      className={`px-5 py-4 rounded-xl text-left transition-all duration-200 ${
                        profile.tone === tone.id
                          ? 'bg-electric/20 border border-electric/50'
                          : 'glass hover:border-electric/20'
                      }`}
                    >
                      <p className={`text-sm font-medium mb-1 ${
                        profile.tone === tone.id ? 'text-primary' : 'text-secondary'
                      }`}>
                        {tone.label}
                      </p>
                      <p className="text-tertiary text-xs">{tone.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 5 — Level ── */}
            {step === 5 && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Step 5</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    Where are you now?
                  </h1>
                  <p className="text-secondary text-sm">No judgment — this helps us set the right pace for you.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 mb-6">
                  {LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => updateProfile('creator_level', level.id)}
                      className={`flex items-center gap-4 px-5 py-5 rounded-xl text-left transition-all duration-200 ${
                        profile.creator_level === level.id
                          ? 'bg-electric/20 border border-electric/50'
                          : 'glass hover:border-electric/20'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium mb-1 ${
                          profile.creator_level === level.id ? 'text-primary' : 'text-secondary'
                        }`}>
                          {level.label}
                        </p>
                        <p className="text-tertiary text-xs">{level.desc}</p>
                      </div>
                      {profile.creator_level === level.id && (
                        <span className="ml-auto text-electric-glow">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              {step > 1 ? (
                <button
                  onClick={() => setStep(prev => prev - 1)}
                  className="btn-ghost px-6 py-3 rounded-xl text-sm"
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}

              {step < STEPS.length ? (
                <button
                  onClick={nextStep}
                  className="btn-electric px-8 py-3 rounded-xl text-sm font-medium"
                >
                  Continue →
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="btn-electric px-8 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Start Creating →'}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}