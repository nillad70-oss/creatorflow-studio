import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const CREATOR_AGENTS = [
  { id: 'marketing_director', label: 'Marketing Director', desc: 'Campaign strategy & positioning' },
  { id: 'brand_strategist', label: 'Brand Strategist', desc: 'Voice, identity & authority' },
  { id: 'copywriter', label: 'Copywriter', desc: 'Tight, conversion-focused writing' },
  { id: 'storyteller', label: 'Storytelling Expert', desc: 'Narrative-driven emotional content' },
  { id: 'viral_creator', label: 'Viral Creator', desc: 'Scroll-stopping pattern interrupts' },
  { id: 'sales_consultant', label: 'Sales Consultant', desc: 'Desire building & CTA mastery' },
  { id: 'business_coach', label: 'Business Coach', desc: 'Mindset & transformation language' },
  { id: 'social_media_manager', label: 'Social Media Manager', desc: 'Platform-native community growth' },
  { id: 'research_analyst', label: 'Research Analyst', desc: 'Data-driven credibility building' },
  { id: 'content_strategist', label: 'Content Strategist', desc: 'Topic angles & audience journey' },
]

const SCRIPT_MODES = [
  { id: 'educational', label: 'Educational' },
  { id: 'storytelling', label: 'Story' },
  { id: 'motivational', label: 'Motivational' },
  { id: 'promotional', label: 'Promotional' },
  { id: 'controversial', label: 'Hot Take' },
  { id: 'listicle', label: 'List' },
]

const CONTENT_GOALS = [
  { id: 'engagement', label: 'Engagement', desc: 'Comments & shares' },
  { id: 'authority', label: 'Authority', desc: 'Build credibility' },
  { id: 'leads', label: 'Leads', desc: 'Generate interest' },
  { id: 'sales', label: 'Sales', desc: 'Drive conversions' },
  { id: 'community', label: 'Community', desc: 'Grow your tribe' },
]

const OFFER_TYPES = [
  'Product', 'Service', 'Consultation', 'Community', 'Membership',
  'Course', 'Event', 'Newsletter', 'Affiliate Opportunity', 'Business Opportunity', 'Other',
]

const AUDIENCE_PROBLEMS = [
  'Burnout', 'Time Constraints', 'Income Constraints', 'Career Growth',
  'Leadership Challenges', 'Business Growth', 'AI Confusion', 'Productivity',
  'Visibility', 'Client Acquisition', 'Other',
]

const CTA_OBJECTIVES = [
  'Comment', 'DM', 'Follow', 'Book Call', 'Apply',
  'Join Community', 'Download Resource', 'Register', 'Subscribe', 'Visit Website',
]

function MultiSelect({ options, selected, onChange, label }) {
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val))
    else onChange([...selected, val])
  }
  return (
    <div className="mb-4">
      <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
              selected.includes(opt) ? 'bg-electric/20 border border-electric/50 text-primary' : 'glass text-secondary hover:border-electric/20'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Scripts() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedScripts, setSavedScripts] = useState([])
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editingContext, setEditingContext] = useState(false)
  const [customNiche, setCustomNiche] = useState('')
  const [customAudience, setCustomAudience] = useState('')
  const [topic, setTopic] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("viral_creator")
  const [scriptMode, setScriptMode] = useState("promotional")
  const [contentGoal, setContentGoal] = useState("engagement")
  const [offerTypes, setOfferTypes] = useState([])
  const [audienceProblems, setAudienceProblems] = useState([])
  const [ctaObjectives, setCtaObjectives] = useState([])
  const [generatedScript, setGeneratedScript] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [assets, setAssets] = useState([])
  const [assetError, setAssetError] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [assetStoryNote, setAssetStoryNote] = useState('')
  const MAX_ASSETS = 6

  const [sessionId, setSessionId] = useState(null)
  const [refining, setRefining] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refineHistory, setRefineHistory] = useState([])

  // Safe null-guarded charCount — never crashes
  const hook = (generatedScript && generatedScript.hook) ? generatedScript.hook : ""
  const body = (generatedScript && generatedScript.body) ? generatedScript.body : ""
  const cta = (generatedScript && generatedScript.cta) ? generatedScript.cta : ""
  const charCount = generatedScript ? (hook + " " + body + " " + cta).length : 0

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUser(user)
      const { data: profileData } = await supabase.from("users").select("*").eq("id", user.id).single()
      setProfile(profileData)
      setIsPro(profileData?.subscription_tier === 'pro')
      const { data: scripts } = await supabase.from("scripts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
      setSavedScripts(scripts || [])
      setLoading(false)
      // Safe localStorage reads — all inside try-catch, all inside useEffect
      try {
        const savedTopic = localStorage.getItem("script_topic")
        if (savedTopic) { setTopic(savedTopic); localStorage.removeItem("script_topic") }
        const lastScript = localStorage.getItem("last_script")
        if (lastScript) {
          const parsed = JSON.parse(lastScript)
          if (parsed && typeof parsed === "object") setGeneratedScript(parsed)
        }
      } catch (e) {
        // Silent fail — localStorage not available or data corrupt
      }
    }
    load()
  }, [router])

  const handleGenerate = async () => {
    if (!topic.trim()) { setError("Please enter a topic."); return }
    setError("")
    setGenerating(true)
    setGeneratedScript(null)
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          niche: customNiche.trim() || profile?.niche,
          audience: customAudience.trim() || profile?.audience,
          tone: profile?.tone,
          platform: profile?.preferred_platform,
          script_mode: scriptMode,
          content_goal: contentGoal,
          creator_agent: selectedAgent,
          offer_types: offerTypes,
          audience_problems: audienceProblems,
          cta_objectives: ctaObjectives,
          user_id: user?.id,
          asset_ids: assets.map(a => a.id),
          asset_story_note: assetStoryNote.trim() || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Failed to generate script.")
        setGenerating(false)
        return
      }
      if (data.script) {
        setGeneratedScript(data.script)
        setSessionId(data.session_id || null)
        setRefineHistory([])
        // Persist last script safely
        try { localStorage.setItem("last_script", JSON.stringify(data.script)) } catch (e) {}
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
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
        setGeneratedScript(data)
        setRefineHistory(prev => [...prev, { role: 'assistant', text: 'Updated the script above based on your feedback.' }])
      }
    } catch (e) {
      setError('Something went wrong revising. Please try again.')
    }
    setRefining(false)
  }

  const handleClear = () => {
    setGeneratedScript(null)
    setTopic("")
    try { localStorage.removeItem("last_script") } catch (e) {}
  }

  const handleSave = async () => {
    if (!generatedScript) return
    setSaving(true)
    const supabase = createClient()
    const { data, error: saveError } = await supabase.from("scripts").insert({
      user_id: user.id,
      title: generatedScript.title || topic,
      topic,
      hook: generatedScript.hook || "",
      body: generatedScript.body || "",
      cta: generatedScript.cta || "",
      pacing: generatedScript.pacing || "",
      script_mode: scriptMode,
      platform: profile?.preferred_platform,
    }).select().single()
    if (!saveError && data) setSavedScripts(prev => [data, ...prev])
    setSaving(false)
  }

  const handleCopy = () => {
    if (!generatedScript) return
    const hashtags = generatedScript.hashtags
      ? (Array.isArray(generatedScript.hashtags) ? generatedScript.hashtags.join(" ") : generatedScript.hashtags)
      : ""
    const fullScript = [hook, body, cta, hashtags].filter(Boolean).join("\n\n")
    navigator.clipboard.writeText(fullScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenInTeleprompter = () => {
    if (!generatedScript) return
    try {
      localStorage.setItem("teleprompter_script", [hook, body, cta].filter(Boolean).join("\n\n"))
    } catch (e) {}
    router.push("/teleprompter")
  }

  if (loading) return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      <Head>
        <title>Creator Intelligence Studio™ — NillaFlow Studio.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div className="min-h-screen bg-void">
        <nav className="sticky top-0 z-40 bg-graphite border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-tertiary hover:text-secondary transition-colors text-sm">← Dashboard</Link>
            <span className="text-border">|</span>
            <h1 className="text-primary text-sm font-medium">Creator Intelligence Studio™</h1>
          </div>
          <span className="text-tertiary text-xs hidden md:block">{profile?.niche} · {profile?.tone}</span>
        </nav>

        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── Left Column — Input ── */}
            <div>
              <div className="mb-6">
                <h2 style={{fontFamily: "var(--font-display)"}} className="text-2xl text-primary font-light mb-1">Creator Intelligence Studio™</h2>
                <p className="text-secondary text-sm">Select your agent. Enter your topic. Generate elite content.</p>
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">Creator Agent</label>
                <div className="grid grid-cols-2 gap-2">
                  {CREATOR_AGENTS.map((agent) => (
                    <button key={agent.id} onClick={() => setSelectedAgent(agent.id)}
                      className={`px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        selectedAgent === agent.id ? "bg-electric/20 border border-electric/50" : "glass hover:border-electric/20"
                      }`}>
                      <p className={`text-xs font-medium ${selectedAgent === agent.id ? "text-primary" : "text-secondary"}`}>{agent.label}</p>
                      <p className="text-tertiary text-xs mt-0.5">{agent.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">Your topic or idea</label>
                <textarea
                  value={topic}
                  onChange={(e) => { setTopic(e.target.value); setError("") }}
                  placeholder="e.g. Why nurses should join an online digital business"
                  rows={3}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none"
                />
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-3 tracking-wide uppercase">Content Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {SCRIPT_MODES.map((mode) => (
                    <button key={mode.id} onClick={() => setScriptMode(mode.id)}
                      className={`px-3 py-2.5 rounded-xl text-center transition-all duration-200 ${
                        scriptMode === mode.id ? "bg-electric/20 border border-electric/50" : "glass hover:border-electric/20"
                      }`}>
                      <p className={`text-xs font-medium ${scriptMode === mode.id ? "text-primary" : "text-secondary"}`}>{mode.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-3 tracking-wide uppercase">Goal</label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTENT_GOALS.map((goal) => (
                    <button key={goal.id} onClick={() => setContentGoal(goal.id)}
                      className={`px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                        contentGoal === goal.id ? "bg-electric/20 border border-electric/50" : "glass hover:border-electric/20"
                      }`}>
                      <p className={`text-xs font-medium ${contentGoal === goal.id ? "text-primary" : "text-secondary"}`}>{goal.label}</p>
                      <p className="text-tertiary text-xs mt-0.5">{goal.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass border border-electric/20 hover:border-electric/50 transition-all duration-200 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-electric-glow text-sm">⚙</span>
                  <span className="text-primary text-xs font-medium tracking-wide">Advanced Settings</span>
                  {(offerTypes.length + audienceProblems.length + ctaObjectives.length) > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-electric/20 text-electric-glow text-xs">
                      {offerTypes.length + audienceProblems.length + ctaObjectives.length} selected
                    </span>
                  )}
                </div>
                <span className="text-electric-glow text-xs">{showAdvanced ? "▾ Hide" : "▸ Show"}</span>
              </button>

              {showAdvanced && (
                <div className="glass rounded-2xl p-4 mb-5">
                  <MultiSelect label="What are you promoting?" options={OFFER_TYPES} selected={offerTypes} onChange={setOfferTypes} />
                  <MultiSelect label="Audience Pain Points" options={AUDIENCE_PROBLEMS} selected={audienceProblems} onChange={setAudienceProblems} />
                  <MultiSelect label="Desired Audience Action" options={CTA_OBJECTIVES} selected={ctaObjectives} onChange={setCtaObjectives} />
                </div>
              )}

              {error && (
                <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              <div className="mb-4">
                {!isPro ? (
                  <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-tertiary text-xs">✦ Add Asset — ground this script in an image (Pro feature)</p>
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
                      <label className="bg-surface border border-dashed border-border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer">
                        <span className="text-secondary text-xs">
                          {uploading ? 'Uploading & analyzing...' : assets.length === 0 ? `✦ Add Asset — ground this script in an image (up to ${MAX_ASSETS}, JPEG/PNG/WebP, max 5MB)` : `Add another (${assets.length}/${MAX_ASSETS})`}
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
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm resize-none focus:outline-none focus:border-electric"
                  />
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-electric w-full py-4 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Writing your script...
                  </span>
                ) : "✦ Generate Script"}
              </button>

              {profile?.niche && !editingContext && (
                <div className="text-center mt-3">
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
                    Change for this script
                  </button>
                </div>
              )}

              {editingContext && (
                <div className="glass rounded-xl p-4 mt-3 space-y-3">
                  <div>
                    <label className="text-secondary text-xs block mb-1">Topic / niche for this script</label>
                    <input
                      type="text"
                      value={customNiche}
                      onChange={(e) => setCustomNiche(e.target.value)}
                      placeholder="e.g. digital business, nursing career, AI tools"
                      className="w-full px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm focus:outline-none focus:border-electric"
                    />
                  </div>
                  <div>
                    <label className="text-secondary text-xs block mb-1">Audience for this script</label>
                    <input
                      type="text"
                      value={customAudience}
                      onChange={(e) => setCustomAudience(e.target.value)}
                      placeholder="e.g. busy professionals, working parents"
                      className="w-full px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm focus:outline-none focus:border-electric"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditingContext(false)}
                      className="text-xs px-4 py-2 rounded-lg bg-electric text-white"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => { setCustomNiche(''); setCustomAudience(''); setEditingContext(false) }}
                      className="text-xs text-tertiary underline"
                    >
                      Reset to my default profile
                    </button>
                  </div>
                </div>
              )}

              {savedScripts.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-secondary text-xs uppercase tracking-widest mb-3">Saved Scripts</h3>
                  <div className="space-y-2">
                    {savedScripts.map((script) => (
                      <div
                        key={script.id}
                        onClick={() => setGeneratedScript({
                          title: script.title,
                          hook: script.hook || "",
                          body: script.body || "",
                          cta: script.cta || "",
                          pacing: script.pacing || "",
                        })}
                        className="glass rounded-xl px-4 py-3 flex items-center justify-between group cursor-pointer hover:border-electric/20 transition-all">
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

            {/* ── Right Column — Output ── */}
            <div>
              {generatedScript ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 style={{fontFamily: "var(--font-display)"}} className="text-xl text-primary font-light">Your Script</h2>
                      <p className={`text-xs mt-0.5 ${charCount > 600 ? "text-error" : "text-secondary"}`}>{charCount} / 600 characters</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleClear} className="btn-ghost px-3 py-2 rounded-lg text-xs">✕ Clear</button>
                      <button onClick={handleSave} disabled={saving} className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-50">{saving ? "Saving..." : "↓ Save"}</button>
                      <button onClick={handleOpenInTeleprompter} className="btn-electric px-4 py-2 rounded-lg text-xs">▶ Teleprompter</button>
                      <button onClick={handleCopy} className="btn-ghost px-3 py-2 rounded-lg text-xs">{copied ? "Copied!" : "Copy"}</button>
                    </div>
                  </div>

                  {generatedScript.visual_story_synthesis && (
                    <div className="glass rounded-2xl p-5 mb-3 border border-electric/30" style={{background: 'rgba(59,130,246,0.08)'}}>
                      <p className="text-electric-glow text-xs uppercase tracking-widest mb-1">What Nilla Saw in Your Image</p>
                      <p className="text-primary text-sm">{generatedScript.visual_story_synthesis}</p>
                      {generatedScript.visually_grounded === true && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">✓ Uses your image</span>
                      )}
                      {generatedScript.visually_grounded === false && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">Generic - not visually grounded</span>
                      )}
                    </div>
                  )}

                  {hook && (
                    <div className="glass rounded-2xl p-5 mb-3 border-electric/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Hook</span>
                        <span className="text-tertiary text-xs">— stops the scroll</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{hook}</p>
                    </div>
                  )}

                  {body && (
                    <div className="glass rounded-2xl p-5 mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Body</span>
                        <span className="text-tertiary text-xs">— core value</span>
                      </div>
                      <div className="text-primary text-sm leading-relaxed space-y-2">
                        {body.split("\n").map((line, i) => line.trim() ? <p key={i}>{line}</p> : null)}
                      </div>
                    </div>
                  )}

                  {cta && (
                    <div className="glass rounded-2xl p-5 mb-3 border-gold/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-gold text-xs font-mono uppercase tracking-widest">CTA</span>
                        <span className="text-tertiary text-xs">— call to action</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{cta}</p>
                    </div>
                  )}

                  {generatedScript.hashtags && (
                    <div className="glass rounded-2xl p-5 mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Hashtags</span>
                        <span className="text-tertiary text-xs">— exactly 5</span>
                      </div>
                      <p className="text-primary text-sm">
                        {Array.isArray(generatedScript.hashtags) ? generatedScript.hashtags.join(" ") : generatedScript.hashtags}
                      </p>
                    </div>
                  )}

                  {generatedScript.solution_stack && generatedScript.solution_stack.length > 0 && (
                    <div className="glass rounded-2xl p-5 mb-3 border border-electric/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Solution Stack</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generatedScript.solution_stack.map((tool, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-electric/10 text-electric-glow text-xs border border-electric/20">{tool}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedScript.creator_response && (
                    <div className="glass rounded-2xl p-5 mb-3 border border-gold/20 bg-gold/5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-mono uppercase tracking-widest" style={{color: "#C8A96E"}}>Creator Response</span>
                        <span className="text-tertiary text-xs">— send this when someone engages</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{generatedScript.creator_response}</p>
                    </div>
                  )}

                  {sessionId && (
                    <div className="glass rounded-2xl p-5 mb-3 border border-border">
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
                          placeholder="e.g. make the hook stronger, shorten the CTA"
                          disabled={refining}
                          className="flex-1 px-3 py-2 rounded-lg bg-void border border-border text-primary text-sm focus:outline-none focus:border-electric"
                        />
                        <button onClick={handleRefine} disabled={refining || !refineInput.trim()} className="px-4 py-2 rounded-lg text-xs font-medium bg-electric text-white disabled:opacity-50 shrink-0">
                          {refining ? 'Revising...' : 'Revise'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="glass rounded-2xl p-5 mt-3 border border-electric/20">
                    <p className="text-xs font-mono uppercase tracking-widest text-electric-glow mb-1">Post Preview</p>
                    <p className="text-tertiary text-xs mb-3">How your hook looks as a post</p>
                    <div className="rounded-xl p-4 mb-3" style={{background: "linear-gradient(135deg, #1a1200 0%, #2a1f08 100%)"}}>
                      <p className="text-xs uppercase tracking-widest mb-2" style={{color: "#C8A96E"}}>Hook</p>
                      <p className="text-white text-sm font-medium leading-relaxed">{hook}</p>
                    </div>
                    <div className="rounded-xl p-4" style={{background: "#111"}}>
                      <p className="text-xs uppercase tracking-widest mb-2 text-tertiary">Caption</p>
                      <p className="text-secondary text-xs leading-relaxed">{body ? body.substring(0, 120) + "..." : ""}</p>
                    </div>
                  </div>

                  <div className="glass rounded-2xl p-5 mt-3 border border-electric/20">
                    <p className="text-xs font-mono uppercase tracking-widest text-electric-glow mb-1">Publish</p>
                    <p className="text-tertiary text-xs mb-3">Schedule this post to all your platforms instantly</p>
                    <a href="https://blotato.com/?ref=leonilla" target="_blank" rel="noopener noreferrer" className="btn-electric w-full py-3 rounded-xl text-sm font-medium text-center block">Schedule with Blotato</a>
                  </div>

                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4 text-border">❋</div>
                    <p className="text-tertiary text-sm">Your script will appear here.</p>
                    <p className="text-tertiary text-xs mt-1">Select your agent and click Generate.</p>
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
