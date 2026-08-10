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
  const [solutionStack, setSolutionStack] = useState([])
  const [creatorResponse, setCreatorResponse] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('caption_script')
    if (saved) {
      setScript(saved)
      localStorage.removeItem('caption_script')
    }
  }, [])
  const [captionStyle, setCaptionStyle] = useState('engaging')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [uploading, setUploading] = useState(false)
  const [assets, setAssets] = useState([])
  const [assetError, setAssetError] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [assetStoryNote, setAssetStoryNote] = useState('')
  const MAX_ASSETS = 6

  const [visualSynthesis, setVisualSynthesis] = useState(null)
  const [visuallyGrounded, setVisuallyGrounded] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [refining, setRefining] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refineHistory, setRefineHistory] = useState([])

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
      setIsPro(profileData?.subscription_tier === 'pro')
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
          user_id: user?.id,
          asset_ids: assets.map(a => a.id),
          asset_story_note: assetStoryNote.trim() || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Failed.'); setGenerating(false); return }
      setCaptions(data.caption)
      setSolutionStack(data.solution_stack || [])
      setCreatorResponse(data.creator_response || '')
      setVisualSynthesis(data.visual_story_synthesis || null)
      setVisuallyGrounded(data.visually_grounded ?? null)
      setSessionId(data.session_id || null)
      setRefineHistory([])
    } catch (err) {
      setError('Something went wrong.')
    }
    setGenerating(false)
  }

  const handleAssetUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setAssetError('')
    if (assets.length + files.length > MAX_ASSETS) {
      setAssetError(`You can attach up to ${MAX_ASSETS} images.`)
      return
    }
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
    setUploading(true)
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) { setAssetError('Please upload only JPEG, PNG, or WebP images.'); continue }
      if (file.size > 5 * 1024 * 1024) { setAssetError('Each image must be under 5 MB.'); continue }
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const uploadRes = await fetch('/api/upload-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id, file_base64: base64, mime_type: file.type,
            file_size_bytes: file.size, filename: file.name, asset_type: 'product_image',
          }),
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) { setAssetError(uploadData.error || 'Upload failed.'); continue }
        const previewUrl = URL.createObjectURL(file)
        setAssets(prev => [...prev, { id: uploadData.asset.id, previewUrl }])
        fetch('/api/analyze-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: uploadData.asset.id, user_id: user.id }),
        }).catch(() => {})
      } catch (err) {
        setAssetError('Something went wrong uploading one of the images.')
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  const removeAsset = (assetId) => {
    setAssets(prev => prev.filter(a => a.id !== assetId))
    setAssetError('')
  }

  const handleRefine = async () => {
    if (!refineInput.trim() || !sessionId) return
    setRefining(true)
    setError('')
    const feedbackText = refineInput.trim()
    setRefineHistory(prev => [...prev, { role: 'user', text: feedbackText }])
    setRefineInput('')
    try {
      const response = await fetch('/api/session-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_id: user?.id, feedback_message: feedbackText }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to revise.')
      } else {
        setCaptions(data.caption)
        setSolutionStack(data.solution_stack || [])
        setCreatorResponse(data.creator_response || '')
        setVisualSynthesis(data.visual_story_synthesis || null)
        setVisuallyGrounded(data.visually_grounded ?? null)
        setRefineHistory(prev => [...prev, { role: 'assistant', text: 'Updated the caption above based on your feedback.' }])
      }
    } catch (e) {
      setError('Something went wrong revising. Please try again.')
    }
    setRefining(false)
  }


  const saveCaption = async () => {
    if (!captions || !user) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('captions').insert({
        user_id: user.id,
        subtitle_text: captions,
        export_format: captionStyle,
        created_at: new Date().toISOString(),
      })
      if (!error) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      console.error('Save failed:', err)
    }
  }
  const copyCaption = () => {
    navigator.clipboard.writeText(captions)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="min-h-screen bg-void flex items-center justify-center"><div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" /></div>

  return (
    <>
      <Head><title>Captions — NillaFlow Studio™.</title></Head>
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

              <div className="mb-4">
                {!isPro ? (
                  <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-tertiary text-xs">✦ Add Asset — ground this caption in an image (Pro feature)</p>
                    <span className="text-electric-glow text-xs">Upgrade to unlock</span>
                  </div>
                ) : (
                  <div>
                    {assets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {assets.map((a) => (
                          <div key={a.id} className="relative">
                            <img src={a.previewUrl} alt="Uploaded asset" className="w-16 h-16 rounded-lg object-cover" />
                            <button onClick={() => removeAsset(a.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-void border border-border text-tertiary text-xs flex items-center justify-center">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {assets.length < MAX_ASSETS && (
                      <label className="glass border border-dashed border-border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer">
                        <span className="text-secondary text-xs">
                          {uploading ? 'Uploading & analyzing...' : assets.length === 0 ? `✦ Add Asset — ground this caption in an image (up to ${MAX_ASSETS})` : `Add another (${assets.length}/${MAX_ASSETS})`}
                        </span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleAssetUpload} disabled={uploading} className="hidden" />
                      </label>
                    )}
                  </div>
                )}
                {assetError && <p className="text-red-400 text-xs mt-1">{assetError}</p>}
                {assets.length > 0 && (
                  <textarea
                    value={assetStoryNote}
                    onChange={(e) => setAssetStoryNote(e.target.value)}
                    placeholder="Anything specific about this image? (optional)"
                    rows={2}
                    className="input-field w-full mt-2 px-3 py-2 rounded-lg text-sm resize-none"
                  />
                )}
              </div>

              <button onClick={generateCaptions} disabled={generating} className="btn-electric w-full py-4 rounded-xl text-sm font-medium disabled:opacity-50">
                {generating ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</span> : '✦ Generate Caption'}
              </button>
            </div>

            <div>
              {captions ? (
                <div className="page-enter">
                  <div className="flex items-center justify-between mb-4">
                    <h2 style={{fontFamily: 'var(--font-display)'}} className="text-xl text-primary font-light">Your Caption</h2>
                    <div className="flex items-center gap-2">
                      <button onClick={copyCaption} className={`px-3 py-1.5 rounded-lg text-xs transition-all ${copied ? 'bg-success/20 text-success' : 'btn-ghost'}`}>
                        {copied ? '✓ Copied!' : 'Copy'}
                      </button>
                      <button onClick={saveCaption} className={`px-3 py-1.5 rounded-lg text-xs transition-all ${saved ? 'bg-success/20 text-success' : 'btn-ghost'}`}>
                        {saved ? '✓ Saved!' : '✦ Save'}
                      </button>
                      <a href="/teleprompter" onClick={() => localStorage.setItem('teleprompter_script', captions)} className="px-3 py-1.5 rounded-lg text-xs btn-electric whitespace-nowrap">
                        ▶ Teleprompter
                      </a>
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-6">
                    <p className="text-primary text-sm leading-relaxed whitespace-pre-line">{captions}</p>
                  </div>

                  {visualSynthesis && (
                    <div className="glass rounded-2xl p-5 mt-4 border border-electric/30" style={{background: 'rgba(59,130,246,0.08)'}}>
                      <p className="text-electric-glow text-xs uppercase tracking-widest mb-1">What Nilla Saw in Your Image</p>
                      <p className="text-primary text-sm">{visualSynthesis}</p>
                      {visuallyGrounded === true && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">✓ Uses your image</span>
                      )}
                      {visuallyGrounded === false && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">Generic - not visually grounded</span>
                      )}
                    </div>
                  )}

                  {solutionStack && solutionStack.length > 0 && (
                    <div className="glass rounded-2xl p-5 mt-4 border border-electric/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Solution Stack</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {solutionStack.map((tool, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-electric/10 text-electric-glow text-xs border border-electric/20">{tool}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {creatorResponse && (
                    <div className="glass rounded-2xl p-5 mt-4 border border-gold/20 bg-gold/5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-mono uppercase tracking-widest" style={{color: "#C8A96E"}}>Creator Response</span>
                        <span className="text-tertiary text-xs">— send this when someone engages</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{creatorResponse}</p>
                    </div>
                  )}

                  {sessionId && (
                    <div className="glass rounded-2xl p-5 mt-4 border border-border">
                      <p className="text-secondary text-xs mb-2">Not quite right? Tell Nilla what to change - it'll revise this, not start over.</p>
                      {refineHistory.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {refineHistory.map((m, i) => (
                            <p key={i} className={`text-xs ${m.role === 'user' ? 'text-primary' : 'text-tertiary italic'}`}>
                              {m.role === 'user' ? `You: ${m.text}` : m.text}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !refining && handleRefine()}
                          placeholder="e.g. more casual, shorter, stronger CTA"
                          disabled={refining}
                          className="input-field flex-1 px-3 py-2 rounded-lg text-sm"
                        />
                        <button onClick={handleRefine} disabled={refining || !refineInput.trim()} className="px-4 py-2 rounded-lg text-xs font-medium bg-electric text-white disabled:opacity-50 shrink-0">
                          {refining ? 'Revising...' : 'Revise'}
                        </button>
                      </div>
                    </div>
                  )}
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