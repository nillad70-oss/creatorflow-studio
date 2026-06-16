import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const CATEGORIES = [
  'Educational', 'Storytelling', 'Motivational', 
  'Behind the Scenes', 'Hot Take', 'Tips & Tricks',
  'Personal', 'Promotional'
]

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn']

export default function Planner() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [ideas, setIdeas] = useState([])
  const [calendarMeta, setCalendarMeta] = useState(null)
  const [savedIdeas, setSavedIdeas] = useState([])
  const [error, setError] = useState('')
  const [daysCount, setDaysCount] = useState(30)

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

      // Load saved ideas
      const { data: saved } = await supabase
        .from('content_calendar')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setSavedIdeas(saved || [])
      setLoading(false)
    }
    load()
  }, [router])

  const generateIdeas = async () => {
    setError('')
    setGenerating(true)
    setIdeas([])

    try {
      const response = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: profile?.niche,
          audience: profile?.audience,
          tone: profile?.tone,
          platform: profile?.preferred_platform,
          days: daysCount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to generate ideas.')
        setGenerating(false)
        return
      }

      if (data.calendar) {
        setIdeas(data.calendar.days || [])
        setCalendarMeta({
          competitors: data.calendar.competitors || [],
          strategy: data.calendar.strategy || {}
        })
      } else {
        setIdeas(data.ideas || [])
        setCalendarMeta(null)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }

    setGenerating(false)
  }

  const saveIdea = async (idea) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('content_calendar')
      .insert({
        user_id: user.id,
        topic: idea.title || idea.topic || '',
        hook: idea.hook || '',
        category: idea.category || idea.format || 'Content',
        platform: profile?.preferred_platform,
        content_type: idea.type || idea.format || 'video',
      })
      .select()
      .single()

    if (!error && data) {
      setSavedIdeas(prev => [data, ...prev])
    }
  }

  const generateScript = (idea) => {
    localStorage.setItem('script_topic', idea.title || idea.topic || '')
    localStorage.setItem('script_format', idea.format || '')
    localStorage.setItem('script_hook', idea.hook || '')
    localStorage.setItem('script_cta', idea.cta || '')
    localStorage.setItem('script_hashtags', idea.hashtags || '')
    localStorage.setItem('script_day', idea.day || '')
    localStorage.setItem('script_week', idea.week || '')
    if (calendarMeta) {
      localStorage.setItem('script_competitors', JSON.stringify(calendarMeta.competitors || []))
      localStorage.setItem('script_strategy', JSON.stringify(calendarMeta.strategy || {}))
    }
    router.push('/scripts')
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
        <title>Content Planner — NillaFlow Studio™.</title>
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
            <h1 className="text-primary text-sm font-medium">Content Planner</h1>
          </div>
          {profile?.niche && (
            <span className="text-tertiary text-xs hidden md:block">
              {profile.niche} · {profile.preferred_platform}
            </span>
          )}
        </nav>

        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">

          {/* Generator section */}
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-light mb-1">
                  Generate Content Ideas
                </h2>
                <p className="text-secondary text-sm">
                  AI-powered ideas tailored to your niche and audience.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={daysCount}
                  onChange={(e) => setDaysCount(Number(e.target.value))}
                  className="input-field px-4 py-2 rounded-xl text-sm"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>

                <button
                  onClick={generateIdeas}
                  disabled={generating}
                  className="btn-electric px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : '✦ Generate Ideas'}
                </button>
              </div>
            </div>

            {profile?.niche && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-tertiary">Generating for:</span>
                <span className="bg-electric/10 text-electric-glow text-xs px-3 py-1 rounded-full">{profile.niche}</span>
                <span className="bg-electric/10 text-electric-glow text-xs px-3 py-1 rounded-full">{profile.audience}</span>
                <span className="bg-electric/10 text-electric-glow text-xs px-3 py-1 rounded-full">{profile.tone} tone</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-6">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Generated ideas */}
          {ideas.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-secondary text-xs uppercase tracking-widest">
                  {ideas.length} Ideas Generated
                </h2>
                <button
                  onClick={() => {
                    ideas.forEach(idea => saveIdea(idea))
                  }}
                  className="text-electric-glow text-xs hover:underline"
                >
                  Save all →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ideas.map((idea, i) => (
                  <div key={i} className="glass rounded-2xl p-5 hover:border-electric/20 transition-all group">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-xs bg-electric/10 text-electric-glow px-2 py-1 rounded-full">
                        {idea.category || idea.format || 'Content'}
                      </span>
                      <span className="text-tertiary text-xs">Day {idea.day || i + 1}</span>
                    </div>

                    <h3 className="text-primary text-sm font-medium mb-2 leading-relaxed">
                      {idea.title || idea.topic}
                    </h3>

                    {idea.hook && (
                      <div className="mb-3">
                        <p className="text-tertiary text-xs uppercase tracking-wide mb-1">Hook</p>
                        <p className="text-secondary text-xs leading-relaxed italic">"{idea.hook}"</p>
                      </div>
                    )}

                    {idea.cta && (
                      <div className="mb-3">
                        <p className="text-tertiary text-xs uppercase tracking-wide mb-1">CTA</p>
                        <p className="text-secondary text-xs leading-relaxed">{idea.cta}</p>
                      </div>
                    )}

                    {idea.format && (
                      <div className="mb-3">
                        <p className="text-tertiary text-xs uppercase tracking-wide mb-1">Format</p>
                        <p className="text-secondary text-xs leading-relaxed">{idea.format}</p>
                      </div>
                    )}

                    {idea.hashtags && (
                      <div className="mb-3">
                        <p className="text-electric-glow text-xs leading-relaxed">{idea.hashtags}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveIdea(idea)}
                        className="btn-ghost px-3 py-1.5 rounded-lg text-xs"
                      >
                        + Save
                      </button>
                      <button
                        onClick={() => generateScript(idea)}
                        className="btn-electric px-3 py-1.5 rounded-lg text-xs"
                      >
                        Write Script →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved ideas */}
          {savedIdeas.length > 0 && (
            <div>
              <h2 className="text-secondary text-xs uppercase tracking-widest mb-4">
                Saved Ideas ({savedIdeas.length})
              </h2>
              <div className="space-y-3">
                {savedIdeas.map((idea) => (
                  <div key={idea.id} className="glass rounded-xl px-5 py-4 flex items-center justify-between group hover:border-electric/20 transition-all">
                    <div>
                      <p className="text-primary text-sm font-medium">{idea.topic}</p>
                      <p className="text-tertiary text-xs mt-0.5">{idea.category} · {new Date(idea.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => generateScript(idea)}
                      className="text-tertiary text-xs hover:text-electric-glow transition-colors"
                    >
                      Write Script →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {ideas.length === 0 && savedIdeas.length === 0 && !generating && (
            <div className="text-center py-20">
              <div className="text-4xl mb-4 text-border">◉</div>
              <p className="text-tertiary text-sm mb-2">No content ideas yet.</p>
              <p className="text-tertiary text-xs">Click Generate Ideas to get {daysCount} personalized content ideas.</p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}