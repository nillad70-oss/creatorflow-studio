import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const GOAL_TYPES = [
  { id: "income_replacement", label: "Income Replacement" },
  { id: "education_savings", label: "Education & College Savings" },
  { id: "career_freedom", label: "Career Freedom" },
  { id: "legacy", label: "Legacy for Family" },
  { id: "debt_freedom", label: "Debt Freedom" },
  { id: "other", label: "Something Else" },
]

const BEATS = [
  {
    key: "origin",
    title: "Origin",
    question: "Where are you from, and how has coming from there shaped what matters most to you in life?",
    clues: [
      "What do you miss most from back home or from that earlier stage of your life?",
      "How does that memory guide the kind of life you're building now?",
    ],
  },
  {
    key: "rupture",
    title: "The Turning Point",
    question: "Can you remember a specific moment when you realized you couldn't keep living the same way?",
    clues: [
      "Did you get sick? Miss a family event? Feel burned out? Have a financial scare?",
    ],
  },
  {
    key: "realization",
    title: "The Realization",
    question: "When did you understand that working harder or picking up extra jobs wasn't getting you closer to your bigger goals?",
    clues: [
      "What were you actually doing at the time?",
      "What did you think success would look like, versus where you actually found yourself?",
    ],
  },
  {
    key: "discovery",
    title: "The Discovery",
    question: "Why did this opportunity catch your attention? What caught your eye?",
    clues: [
      "What problem were you trying to solve in that moment?",
      "What made this feel different from other things you'd seen before?",
    ],
  },
  {
    key: "doubt",
    title: "The Doubt",
    question: "Did you have doubts or fears? What helped you overcome them?",
    clues: [
      "What almost stopped you from starting?",
      "Who or what gave you the push to move forward anyway?",
    ],
  },
  {
    key: "reassurance",
    title: "The Reassurance",
    question: "If a friend was unsure about taking this step, what would you say to them?",
    clues: [
      "Would you share your own fear story?",
      "What's the one thing you wish someone had told you before you started?",
    ],
  },
]

export default function BuildStory() {
  const router = useRouter()
  const [stage, setStage] = useState('goal') // 'goal' | number index into BEATS | 'review'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [goalType, setGoalType] = useState('')
  const [answers, setAnswers] = useState({}) // { origin: "raw text", rupture: "raw text", ... }

  const beatIndex = typeof stage === 'number' ? stage : -1
  const currentBeat = beatIndex >= 0 ? BEATS[beatIndex] : null
  const totalSteps = BEATS.length + 2 // goal + 6 beats + review
  const currentStepNum =
    stage === 'goal' ? 1 : stage === 'review' ? totalSteps : beatIndex + 2
  const progress = (currentStepNum / totalSteps) * 100

  const updateAnswer = (value) => {
    setAnswers(prev => ({ ...prev, [currentBeat.key]: value }))
    setError('')
  }

  const goNext = () => {
    if (stage === 'goal') {
      if (!goalType) { setError('Please choose what you\'re building toward.'); return }
      setStage(0)
      return
    }
    if (typeof stage === 'number') {
      if (!answers[currentBeat.key] || answers[currentBeat.key].trim().length < 5) {
        setError('Take a moment with this one before moving on.')
        return
      }
      setError('')
      if (stage === BEATS.length - 1) {
        setStage('review')
      } else {
        setStage(stage + 1)
      }
    }
  }

  const goBack = () => {
    setError('')
    if (stage === 0) { setStage('goal'); return }
    if (stage === 'review') { setStage(BEATS.length - 1); return }
    if (typeof stage === 'number' && stage > 0) { setStage(stage - 1) }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Build the story_beats JSONB payload. enhanced_narrative and
    // derived_assets are filled in server-side by the enhancement step
    // (separate API route) - this write just captures the raw intake.
    const story_beats = {}
    BEATS.forEach(beat => {
      story_beats[beat.key] = {
        raw_answer: answers[beat.key] || '',
        enhanced_narrative: '',
        conversion_function: beat.key === 'origin' ? 'trust_relatability'
          : beat.key === 'rupture' ? 'pain_agitation'
          : beat.key === 'realization' ? 'problem_awareness'
          : beat.key === 'discovery' ? 'offer_introduction'
          : beat.key === 'doubt' ? 'objection_handling'
          : 'cta_close',
        derived_assets: {},
      }
    })

    // Find current version number for this user to increment it
    const { data: existing } = await supabase
      .from('story_profiles')
      .select('version')
      .eq('user_id', user.id)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1

    const { data: inserted, error: insertError } = await supabase
      .from('story_profiles')
      .insert({
        user_id: user.id,
        version: nextVersion,
        goal_type: goalType,
        voice_track: 'personal',
        story_beats,
        compliance_flags: {},
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Mark this version as current
    await supabase.rpc('set_current_story', {
      p_user_id: user.id,
      p_story_id: inserted.id,
    })

    // Kick off server-side enhancement (fills enhanced_narrative +
    // derived_assets per beat) - fire and forget, UI moves on
    fetch('/api/enhance-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story_id: inserted.id }),
    }).catch(() => {})

    router.push('/dashboard')
  }

  return (
    <>
      <Head>
        <title>Build Your Story — NillaFlow Studio™</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void flex flex-col">
        <div className="fixed inset-0 bg-electric-glow pointer-events-none" />

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
              <span className="text-white text-xs font-bold">NF</span>
            </div>
            <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-lg font-medium">
              Build Story
            </span>
          </div>
          <span className="text-tertiary text-xs">
            Step {currentStepNum} of {totalSteps}
          </span>
        </nav>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 relative z-10">
          <div className="w-full max-w-lg">

            {/* ── GOAL TYPE ── */}
            {stage === 'goal' && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Before we start</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    What are you building toward?
                  </h1>
                  <p className="text-secondary text-sm">This shapes how your story gets used later - the same six answers can support different goals.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {GOAL_TYPES.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGoalType(g.id)}
                      className={`px-4 py-3 rounded-xl text-sm text-left transition-all duration-200 border ${
                        goalType === g.id
                          ? 'bg-electric/10 border-electric text-primary'
                          : 'bg-surface border-border text-secondary hover:border-electric/40'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STORY BEATS ── */}
            {currentBeat && (
              <div className="page-enter">
                <div className="text-center mb-6">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">{currentBeat.title}</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-2xl md:text-3xl text-primary font-light mb-4">
                    {currentBeat.question}
                  </h1>
                  <ul className="text-secondary text-sm space-y-1 mb-2">
                    {currentBeat.clues.map((clue, i) => (
                      <li key={i}>{clue}</li>
                    ))}
                  </ul>
                </div>

                <textarea
                  value={answers[currentBeat.key] || ''}
                  onChange={(e) => updateAnswer(e.target.value)}
                  placeholder="Take your time. The richer your answer, the stronger your story will be."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-primary text-sm resize-none focus:outline-none focus:border-electric"
                />
              </div>
            )}

            {/* ── REVIEW ── */}
            {stage === 'review' && (
              <div className="page-enter">
                <div className="text-center mb-8">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-3">Almost done</p>
                  <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-3">
                    Review your story
                  </h1>
                  <p className="text-secondary text-sm">You can edit any answer before saving. This becomes your Current Story.</p>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {BEATS.map((beat) => (
                    <div key={beat.key} className="bg-surface border border-border rounded-xl p-4">
                      <p className="text-electric-glow text-xs uppercase tracking-widest mb-1">{beat.title}</p>
                      <p className="text-tertiary text-xs mb-2">{beat.question}</p>
                      <textarea
                        value={answers[beat.key] || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [beat.key]: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm resize-none focus:outline-none focus:border-electric"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center mt-4">{error}</p>
            )}

            {/* Nav buttons */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goBack}
                disabled={stage === 'goal'}
                className="px-5 py-2.5 rounded-xl text-sm text-secondary disabled:opacity-0 transition-opacity"
              >
                Back
              </button>

              {stage === 'review' ? (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium bg-electric text-white disabled:opacity-60"
                >
                  {loading ? 'Saving...' : 'Save as Current Story'}
                </button>
              ) : (
                <button
                  onClick={goNext}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium bg-electric text-white"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
