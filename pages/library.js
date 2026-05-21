import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

export default function Library() {
  const router = useRouter()
  const [scripts, setScripts] = useState([])
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('scripts')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: scriptsData } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: ideasData } = await supabase
        .from('content_calendar')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setScripts(scriptsData || [])
      setIdeas(ideasData || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Head><title>Library — CreatorFlow Studio™</title></Head>
      <div className="min-h-screen bg-void">
        <nav className="sticky top-0 z-40 bg-graphite border-b border-border px-4 md:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-tertiary hover:text-secondary transition-colors text-sm">← Dashboard</Link>
          <span className="text-border">|</span>
          <h1 className="text-primary text-sm font-medium">Creator Library</h1>
        </nav>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveTab('scripts')} className={`px-4 py-2 rounded-xl text-sm transition-all ${activeTab === 'scripts' ? 'bg-electric/20 text-electric-glow border border-electric/30' : 'text-secondary hover:text-primary'}`}>
              Scripts ({scripts.length})
            </button>
            <button onClick={() => setActiveTab('ideas')} className={`px-4 py-2 rounded-xl text-sm transition-all ${activeTab === 'ideas' ? 'bg-electric/20 text-electric-glow border border-electric/30' : 'text-secondary hover:text-primary'}`}>
              Ideas ({ideas.length})
            </button>
          </div>

          {activeTab === 'scripts' && (
            <div className="space-y-3">
              {scripts.length > 0 ? scripts.map((script) => (
                <div key={script.id} className="glass rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-primary text-sm font-medium mb-1">{script.title}</p>
                      <p className="text-secondary text-xs leading-relaxed line-clamp-2">{script.hook}</p>
                      <p className="text-tertiary text-xs mt-2">{new Date(script.created_at).toLocaleDateString()}</p>
                    </div>
                    <Link href={`/teleprompter`} onClick={() => localStorage.setItem('teleprompter_script', `${script.hook}\n\n${script.body}\n\n${script.cta}`)} className="btn-electric px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                      ▶ Use
                    </Link>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20">
                  <p className="text-tertiary text-sm mb-4">No scripts yet.</p>
                  <Link href="/scripts" className="btn-electric px-6 py-2.5 rounded-xl text-sm inline-block">Generate First Script</Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ideas' && (
            <div className="space-y-3">
              {ideas.length > 0 ? ideas.map((idea) => (
                <div key={idea.id} className="glass rounded-xl px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-primary text-sm font-medium">{idea.topic}</p>
                    <p className="text-tertiary text-xs mt-0.5">{idea.category} · {new Date(idea.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href="/scripts" onClick={() => localStorage.setItem('script_topic', idea.topic)} className="text-electric-glow text-xs hover:underline">
                    Write Script →
                  </Link>
                </div>
              )) : (
                <div className="text-center py-20">
                  <p className="text-tertiary text-sm mb-4">No ideas saved yet.</p>
                  <Link href="/planner" className="btn-electric px-6 py-2.5 rounded-xl text-sm inline-block">Generate Ideas</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}