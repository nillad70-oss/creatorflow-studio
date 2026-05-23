import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

export default function Captions() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [script, setScript] = useState('')
  const [captions, setCaptions] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('caption_script')
    if (saved) {
      setScript(saved)
      localStorage.removeItem('caption_script')
    }
  }, [])
  const [captionStyle, setCaptionStyle] = useState('engaging')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const STYLES = [
    { id: 'engaging', label: 'Engaging', desc: 'Hooks, emojis, hashtags' },
    { id: 'professional', label: 'Professional', desc: 'Clean, no emojis' },
    { id: 'storytelling', label: 'Story', desc: 'Narrative format' },
    { id: 'minimal', label: 'Minimal', desc: 'Short and punchy' },
  ]

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

  const generateCaptions = async () => {
    if (!script.trim()) { setError('Please paste your script first.'); return }
    setError('')
    setGenerating(true)
    setCaptions('')

    try {
      const response = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          style: captionStyle,
          niche: profile?.niche,
          platform: profile?.preferred_platform,
        }),
      })

      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Failed.'); setGenerating(false); return }
      setCaptions(data.caption)
    } catch (err) {
      setError('Something went wrong.')
    }
    setGenerating(false)
  }

  const copyCaption = () => {
    navigator.clipboard.writeText(captions)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="min-h-screen bg-void flex items-center justify-center"><div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" /></div>

  return (
    <>
      <Head><title>Captions — CreatorFlow Studio™</title></Head>
      <div className="min-h-screen bg-void">
        <nav className="sticky top-0 z-40 bg-graphite border-b border-border px-4 md:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-tertiary hover:text-secondary transition-colors text-sm">← Dashboard</Link>
          <span className="text-border">|</span>
          <h1 className="text-primary text-sm font-medium">Caption Generator</h1>
        </nav>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            <div>
              <h2 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-light mb-6">Generate Caption</h2>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-2 uppercase tracking-wide">Your Script</label>
                <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="Paste your script here..." rows={6} className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none" />
              </div>

              <div className="mb-6">
                <label className="block text-secondary text-xs mb-3 uppercase tracking-wide">Caption Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((style) => (
                    <button key={style.id} onClick={() => setCaptionStyle(style.id)} className={`px-4 py-3 rounded-xl text-left transition-all ${captionStyle === style.id ? 'bg-electric/20 border border-electric/50' : 'glass hover:border-electric/20'}`}>
                      <p className={`text-xs font-medium ${captionStyle === style.id ? 'text-primary' : 'text-secondary'}`}>{style.label}</p>
                      <p className="text-tertiary text-xs mt-0.5">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-4"><p className="text-error text-sm">{error}</p></div>}

              <button onClick={generateCaptions} disabled={generating} className="btn-electric w-full py-4 rounded-xl text-sm font-medium disabled:opacity-50">
                {generating ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</span> : '✦ Generate Caption'}
              </button>
            </div>

            <div>
              {captions ? (
                <div className="page-enter">
                  <div className="flex items-center justify-between mb-4">
                    <h2 style={{fontFamily: 'var(--font-display)'}} className="text-xl text-primary font-light">Your Caption</h2>
                    <button onClick={copyCaption} className={`px-4 py-2 rounded-lg text-xs transition-all ${copied ? 'bg-success/20 text-success' : 'btn-ghost'}`}>
                      {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="glass rounded-2xl p-6">
                    <p className="text-primary text-sm leading-relaxed whitespace-pre-line">{captions}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4 text-border">◇</div>
                    <p className="text-tertiary text-sm">Your caption will appear here.</p>
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