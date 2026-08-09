import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const BEAT_TITLES = {
  origin: 'Origin',
  rupture: 'The Turning Point',
  realization: 'The Realization',
  discovery: 'The Discovery',
  doubt: 'The Doubt',
  reassurance: 'The Reassurance',
}

const BEAT_ORDER = ['origin', 'rupture', 'realization', 'discovery', 'doubt', 'reassurance']

export default function MyStory() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('story_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('version', { ascending: false })

      if (!error && data) {
        setStories(data)
        const current = data.find(s => s.is_current)
        setExpandedId(current ? current.id : (data[0]?.id ?? null))
      }
      setLoading(false)
    }
    load()
  }, [router])

  const makeCurrent = async (storyId) => {
    setSwitching(true)
    const supabase = createClient()
    await supabase.rpc('set_current_story', {
      p_user_id: userId,
      p_story_id: storyId,
    })
    setStories(prev => prev.map(s => ({ ...s, is_current: s.id === storyId })))
    setSwitching(false)
  }

  const copyStory = (story) => {
    let text = `MY STORY — v${story.version}${story.is_current ? ' (Current)' : ''}\nGoal: ${story.goal_type || 'not set'}\n\n`
    BEAT_ORDER.forEach(key => {
      const beat = story.story_beats?.[key]
      if (!beat) return
      text += `${BEAT_TITLES[key].toUpperCase()}\n`
      text += `${beat.enhanced_narrative || beat.raw_answer || '(not answered)'}\n\n`
    })
    navigator.clipboard.writeText(text)
    setCopiedId(story.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <>
      <Head>
        <title>My Story — NillaFlow Studio™</title>
      </Head>

      <div className="min-h-screen bg-void">
        <div className="fixed inset-0 bg-electric-glow pointer-events-none" />

        <nav className="relative z-10 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
              <span className="text-white text-xs font-bold">NF</span>
            </div>
            <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-lg font-medium">
              My Story
            </span>
          </div>
          <Link href="/build-story" className="px-4 py-2 rounded-xl text-sm font-medium bg-electric text-white">
            + Build New Story
          </Link>
        </nav>

        <div className="relative z-10 px-6 py-8 max-w-2xl mx-auto">
          {loading && (
            <p className="text-secondary text-sm text-center py-12">Loading your stories...</p>
          )}

          {!loading && stories.length === 0 && (
            <div className="text-center py-16">
              <p className="text-secondary text-sm mb-6">You haven't built your story yet.</p>
              <Link href="/build-story" className="px-6 py-2.5 rounded-xl text-sm font-medium bg-electric text-white">
                Build Your Story
              </Link>
            </div>
          )}

          {!loading && stories.length > 0 && (
            <div className="space-y-4">
              {stories.map((story) => {
                const isExpanded = expandedId === story.id
                return (
                  <div key={story.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : story.id)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary text-sm font-medium">Story v{story.version}</span>
                          {story.is_current && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-electric/20 text-electric-glow">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-tertiary text-xs mt-1">
                          {story.goal_type?.replace(/_/g, ' ') || 'No goal set'} · {new Date(story.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-secondary text-xs">{isExpanded ? '−' : '+'}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                        {BEAT_ORDER.map((key) => {
                          const beat = story.story_beats?.[key]
                          if (!beat) return null
                          return (
                            <div key={key}>
                              <p className="text-electric-glow text-xs uppercase tracking-widest mb-1">
                                {BEAT_TITLES[key]}
                              </p>
                              <p className="text-primary text-sm leading-relaxed">
                                {beat.enhanced_narrative || beat.raw_answer || (
                                  <span className="text-tertiary italic">Not answered yet</span>
                                )}
                              </p>
                              {!beat.enhanced_narrative && beat.raw_answer && (
                                <p className="text-tertiary text-xs mt-1 italic">
                                  Still processing — refresh in a moment
                                </p>
                              )}
                            </div>
                          )
                        })}

                        <div className="flex items-center gap-3 pt-2">
                          {!story.is_current && (
                            <button
                              onClick={() => makeCurrent(story.id)}
                              disabled={switching}
                              className="px-4 py-2 rounded-lg text-xs font-medium bg-electric text-white disabled:opacity-60"
                            >
                              {switching ? 'Switching...' : 'Make This Current'}
                            </button>
                          )}
                          <button
                            onClick={() => copyStory(story)}
                            className="px-4 py-2 rounded-lg text-xs font-medium bg-void border border-border text-secondary"
                          >
                            {copiedId === story.id ? 'Copied!' : 'Copy Full Story'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
