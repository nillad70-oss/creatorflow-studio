import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const OBJECTIVES = [
  { id: 'conversions', label: 'Conversions' },
  { id: 'lead_generation', label: 'Lead Generation' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'traffic', label: 'Traffic / Link Clicks' },
]

export default function AdCopy() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [topic, setTopic] = useState('')
  const [objective, setObjective] = useState('conversions')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState(null)

  const [editingContext, setEditingContext] = useState(false)
  const [customNiche, setCustomNiche] = useState('')
  const [customAudience, setCustomAudience] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profileData } = await supabase.from('users').select('*').eq('id', user.id).single()
      setProfile(profileData)
      setLoading(false)
    }
    load()
  }, [router])

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Please enter a topic.'); return }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const response = await fetch('/api/generate-adcopy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          niche: customNiche.trim() || profile?.niche,
          audience: customAudience.trim() || profile?.audience,
          platform: profile?.preferred_platform,
          objective,
          user_id: user?.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to generate ad copy.')
      } else {
        setResult(data)
      }
    } catch (e) {
      setError('Something went wrong. Please try again.')
    }
    setGenerating(false)
  }

  const copyText = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  return (
    <>
      <Head>
        <title>Ad Copy — NillaFlow Studio™</title>
      </Head>

      <div className="min-h-screen bg-void">
        <div className="fixed inset-0 bg-glow-radial pointer-events-none" />

        <nav className="relative z-10 px-6 py-5 flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-tertiary">Dashboard</Link>
          <span className="text-tertiary">|</span>
          <span className="text-primary font-medium">Ad Copy</span>
        </nav>

        <div className="relative z-10 px-6 pb-16 max-w-xl mx-auto">
          {loading ? (
            <p className="text-secondary text-sm text-center py-12">Loading...</p>
          ) : (
            <>
              <p className="text-tertiary text-xs mb-4">
                Generates Meta ad units (headline, primary text, description) - different from a video script, this is for actual Facebook/Instagram ad placements.
              </p>

              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's this ad for? e.g. free webinar registration, digital business intro"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-primary text-sm resize-none focus:outline-none focus:border-electric mb-4"
              />

              <div className="mb-4">
                <label className="text-secondary text-xs block mb-2">Ad Objective</label>
                <div className="grid grid-cols-2 gap-2">
                  {OBJECTIVES.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setObjective(o.id)}
                      className={`px-3 py-2 rounded-lg text-xs text-left border ${
                        objective === o.id
                          ? 'bg-electric/10 border-electric text-primary'
                          : 'bg-surface border-border text-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {profile?.niche && !editingContext && (
                <div className="text-center mb-4">
                  <p className="text-tertiary text-xs">
                    Generating for {customNiche.trim() || profile.niche} · {customAudience.trim() || profile.audience}
                  </p>
                  <button
                    onClick={() => {
                      setCustomNiche(customNiche || profile.niche || '')
                      setCustomAudience(customAudience || profile.audience || '')
                      setEditingContext(true)
                    }}
                    className="text-electric-glow text-xs underline mt-1"
                  >
                    Change for this ad
                  </button>
                </div>
              )}

              {editingContext && (
                <div className="glass rounded-xl p-4 mb-4 space-y-3">
                  <input
                    type="text"
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    placeholder="Niche for this ad"
                    className="w-full px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm focus:outline-none focus:border-electric"
                  />
                  <input
                    type="text"
                    value={customAudience}
                    onChange={(e) => setCustomAudience(e.target.value)}
                    placeholder="Audience for this ad"
                    className="w-full px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm focus:outline-none focus:border-electric"
                  />
                  <button onClick={() => setEditingContext(false)} className="text-xs px-4 py-2 rounded-lg bg-electric text-white">
                    Done
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-electric w-full py-4 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {generating ? 'Writing ad copy...' : '✦ Generate Ad Copy'}
              </button>

              {result && (
                <div className="mt-8 space-y-5">
                  {result.ad_boost_warning && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                      <p className="text-yellow-200 text-xs">⚠ {result.ad_boost_warning}</p>
                    </div>
                  )}

                  {result.variants?.map((v, i) => (
                    <div key={i} className="bg-surface border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-0.5 rounded-full bg-electric/20 text-electric-glow text-xs uppercase tracking-wide">
                          {v.hook_mechanic}
                        </span>
                        <button
                          onClick={() => copyText(`${v.video_hook}\n\n${v.primary_text}\n\n${v.headline}`, `v-${i}`)}
                          className="text-tertiary text-xs"
                        >
                          {copiedIdx === `v-${i}` ? 'Copied' : 'Copy all'}
                        </button>
                      </div>

                      <div className="mb-3">
                        <p className="text-tertiary text-xs uppercase tracking-widest mb-1">Video Hook (0-3 sec)</p>
                        <p className="text-primary text-base font-medium">{v.video_hook}</p>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-tertiary text-xs uppercase tracking-widest">Primary Text</p>
                          <span className={`text-xs ${v.primary_text?.length > 200 ? 'text-red-400' : 'text-tertiary'}`}>
                            {v.primary_text?.length || 0} chars
                          </span>
                        </div>
                        <p className="text-secondary text-sm">{v.primary_text}</p>
                      </div>

                      <div>
                        <p className="text-tertiary text-xs uppercase tracking-widest mb-1">Headline</p>
                        <p className="text-primary text-sm font-medium">{v.headline}</p>
                      </div>
                    </div>
                  ))}

                  {result.description && (
                    <div>
                      <h3 className="text-electric-glow text-xs uppercase tracking-widest mb-2">Description</h3>
                      <div className="bg-surface border border-border rounded-xl p-3 flex items-start justify-between gap-3">
                        <p className="text-secondary text-sm">{result.description}</p>
                        <button onClick={() => copyText(result.description, 'desc')} className="text-tertiary text-xs shrink-0">
                          {copiedIdx === 'desc' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {result.recommended_pairing && (
                    <p className="text-tertiary text-xs italic">💡 {result.recommended_pairing}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
