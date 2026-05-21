import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const SCRIPT_MODES = [
  { id: 'educational', label: 'Educational', desc: 'Teach something valuable' },
  { id: 'storytelling', label: 'Story', desc: 'Share a personal experience' },
  { id: 'motivational', label: 'Motivational', desc: 'Inspire and uplift' },
  { id: 'promotional', label: 'Promotional', desc: 'Promote a product or service' },
  { id: 'controversial', label: 'Hot Take', desc: 'Share a bold opinion' },
  { id: 'listicle', label: 'List', desc: 'Top tips or steps' },
]

export default function Scripts() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedScripts, setSavedScripts] = useState([])

  // Form state
  const [topic, setTopic] = useState('')
  const [scriptMode, setScriptMode] = useState('educational')

  // Generated script
  const [generatedScript, setGeneratedScript] = useState(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      const { data: scripts } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setSavedScripts(scripts || [])
      setLoading(false)
    }
    load()
  }, [router])

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Please enter a topic.'); return }
    setError('')
    setGenerating(true)
    setGeneratedScript(null)

    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          niche: profile?.niche,
          audience: profile?.audience,
          tone: profile?.tone,
          platform: profile?.preferred_platform,
          script_mode: scriptMode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to generate script.')
        setGenerating(false)
        return
      }

      setGeneratedScript(data.script)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }

    setGenerating(false)
  }

  const handleSave = async () => {
    if (!generatedScript) return
    setSaving(true)

    const supabase = createClient()
    const { data, error: saveError } = await supabase
      .from('scripts')
      .insert({
        user_id: user.id,
        title: generatedScript.title || topic,
        topic,
        hook: generatedScript.hook,
        body: generatedScript.body,
        cta: generatedScript.cta,
        pacing: generatedScript.pacing,
        script_mode: scriptMode,
        platform: profile?.preferred_platform,
      })
      .select()
      .single()

    if (!saveError && data) {
      setSavedScripts(prev => [data, ...prev])
      setError('')
    }

    setSaving(false)
  }

  const handleOpenInTeleprompter = () => {
    if (!generatedScript) return
    const fullScript = `${generatedScript.hook}\n\n${generatedScript.body}\n\n${generatedScript.cta}`
    localStorage.setItem('teleprompter_script', fullScript)
    router.push('/teleprompter')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>AI Script Generator — CreatorFlow Studio™</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void">

        {/* Header */}
        <nav className="sticky top-0 z-40 bg-graphite border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-tertiary hover:text-secondary transition-colors text-sm">
              ← Dashboard
            </Link>
            <span className="text-border">|</span>
            <h1 className="text-primary text-sm font-medium">AI Script Generator</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-tertiary text-xs hidden md:block">
              {profile?.niche} · {profile?.tone}
            </span>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── Left — Generator ── */}
            <div>
              <div className="mb-6">
                <h2 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-light mb-1">
                  What's your topic?
                </h2>
                <p className="text-secondary text-sm">AI will write a natural script tailored to your voice.</p>
              </div>

              {/* Topic input */}
              <div className="mb-5">
                <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">
                  Your topic or idea
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => { setTopic(e.target.value); setError('') }}
                  placeholder="e.g. 3 signs you're experiencing nurse burnout and what to do about it"
                  rows={3}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none"
                />
              </div>

              {/* Script mode */}
              <div className="mb-6">
                <label className="block text-secondary text-xs mb-3 tracking-wide uppercase">
                  Script style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SCRIPT_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setScriptMode(mode.id)}
                      className={`px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        scriptMode === mode.id
                          ? 'bg-electric/20 border border-electric/50'
                          : 'glass hover:border-electric/20'
                      }`}
                    >
                      <p className={`text-xs font-medium ${scriptMode === mode.id ? 'text-primary' : 'text-secondary'}`}>
                        {mode.label}
                      </p>
                      <p className="text-tertiary text-xs mt-0.5">{mode.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-electric w-full py-4 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Writing your script...
                  </span>
                ) : (
                  '✦ Generate Script'
                )}
              </button>

              {/* Creator profile note */}
              {profile?.niche && (
                <p className="text-tertiary text-xs text-center mt-3">
                  Generating for {profile.niche} · {profile.audience}
                </p>
              )}

              {/* Saved scripts */}
              {savedScripts.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-secondary text-xs uppercase tracking-widest mb-3">Saved Scripts</h3>
                  <div className="space-y-2">
                    {savedScripts.map((script) => (
                      <div
                        key={script.id}
                        className="glass rounded-xl px-4 py-3 flex items-center justify-between group cursor-pointer hover:border-electric/20 transition-all"
                        onClick={() => setGeneratedScript({
                          title: script.title,
                          hook: script.hook,
                          body: script.body,
                          cta: script.cta,
                          pacing: script.pacing,
                        })}
                      >
                        <div>
                          <p className="text-primary text-xs font-medium">{script.title}</p>
                          <p className="text-tertiary text-xs">{new Date(script.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-tertiary text-xs group-hover:text-electric-glow transition-colors">Load →</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right — Generated Script ── */}
            <div>
              {generatedScript ? (
                <div className="page-enter">
                  <div className="flex items-center justify-between mb-4">
                    <h2 style={{fontFamily: 'var(--font-display)'}} className="text-xl text-primary font-light">
                      Your Script
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : '↓ Save'}
                      </button>
                      <button
                        onClick={handleOpenInTeleprompter}
                        className="btn-electric px-4 py-2 rounded-lg text-xs"
                      >
                        ▶ Teleprompter
                      </button>
                    </div>
                  </div>

                  {/* Hook */}
                  <div className="glass rounded-2xl p-5 mb-3 border-electric/20">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Hook</span>
                      <span className="text-tertiary text-xs">— stops the scroll</span>
                    </div>
                    <p className="text-primary text-sm leading-relaxed">{generatedScript.hook}</p>
                  </div>

                  {/* Body */}
                  <div className="glass rounded-2xl p-5 mb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Body</span>
                      <span className="text-tertiary text-xs">— core value</span>
                    </div>
                    <p className="text-primary text-sm leading-relaxed whitespace-pre-line">{generatedScript.body}</p>
                  </div>

                  {/* CTA */}
                  <div className="glass rounded-2xl p-5 mb-3 border-gold/20">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gold text-xs font-mono uppercase tracking-widest">CTA</span>
                      <span className="text-tertiary text-xs">— call to action</span>
                    </div>
                    <p className="text-primary text-sm leading-relaxed">{generatedScript.cta}</p>
                  </div>

                  {/* Pacing tips */}
                  {generatedScript.pacing && (
                    <div className="glass rounded-2xl p-5 bg-white/2">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-secondary text-xs font-mono uppercase tracking-widest">Delivery Tips</span>
                      </div>
                      <p className="text-secondary text-xs leading-relaxed">{generatedScript.pacing}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4 text-border">❋</div>
                    <p className="text-tertiary text-sm">Your script will appear here.</p>
                    <p className="text-tertiary text-xs mt-1">Enter a topic and click Generate.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}